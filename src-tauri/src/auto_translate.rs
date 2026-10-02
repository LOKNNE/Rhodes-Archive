use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    time::Duration,
};
use tauri::{AppHandle, Manager};

use crate::translations;

const MODEL_NAME: &str = "Qwen3-0.6B-Q4_0.gguf";
const SERVER_PORT: u16 = 18080;
const MAX_BATCH_CHARS: usize = 2_800;
const MAX_BATCH_ITEMS: usize = 24;

static LOCAL_SERVER: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn server_slot() -> &'static Mutex<Option<Child>> {
    LOCAL_SERVER.get_or_init(|| Mutex::new(None))
}

fn sanitize_filename(title: &str) -> String {
    let mut out = String::with_capacity(title.len());
    for ch in title.chars() {
        if matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || ch.is_control() {
            out.push('_');
        } else {
            out.push(ch);
        }
    }
    let trimmed = out.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "translation".to_string()
    } else {
        trimmed.chars().take(120).collect()
    }
}

fn local_ai_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        out.push(resource_dir.join("local-ai"));
        out.push(resource_dir.join("resources").join("local-ai"));
    }
    out.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("local-ai"),
    );
    out
}

fn find_local_ai_dir(app: &AppHandle) -> Result<PathBuf, String> {
    for dir in local_ai_candidates(app) {
        let server = dir.join(if cfg!(windows) {
            "llama-server.exe"
        } else {
            "llama-server"
        });
        let model = dir.join(MODEL_NAME);
        if server.exists() && model.exists() {
            return Ok(dir);
        }
    }
    Err("El traductor local no está incluido en esta compilación. Vuelve a compilar Rhodes Archive para preparar el modelo local.".to_string())
}

fn server_executable(dir: &Path) -> PathBuf {
    dir.join(if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    })
}

fn local_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("No se pudo crear el cliente del traductor local: {e}"))
}

async fn health_ok(client: &reqwest::Client) -> bool {
    client
        .get(format!("http://127.0.0.1:{SERVER_PORT}/health"))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

fn start_server(app: &AppHandle) -> Result<(), String> {
    let dir = find_local_ai_dir(app)?;
    let exe = server_executable(&dir);
    let model = dir.join(MODEL_NAME);

    let mut slot = server_slot()
        .lock()
        .map_err(|_| "No se pudo bloquear el estado del traductor local".to_string())?;

    if let Some(child) = slot.as_mut() {
        match child.try_wait() {
            Ok(None) => return Ok(()),
            Ok(Some(_)) | Err(_) => *slot = None,
        }
    }

    let threads = std::thread::available_parallelism()
        .map(|n| n.get().saturating_sub(1).max(1))
        .unwrap_or(4)
        .to_string();

    let mut command = Command::new(exe);
    command
        .current_dir(&dir)
        .arg("--model")
        .arg(model)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(SERVER_PORT.to_string())
        .arg("--ctx-size")
        .arg("8192")
        .arg("--threads")
        .arg(threads)
        .arg("--n-gpu-layers")
        .arg("0")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let child = command
        .spawn()
        .map_err(|e| format!("No se pudo iniciar el traductor local: {e}"))?;
    *slot = Some(child);
    Ok(())
}

async fn ensure_server(app: &AppHandle) -> Result<reqwest::Client, String> {
    let client = local_client()?;
    if health_ok(&client).await {
        return Ok(client);
    }

    start_server(app)?;
    for _ in 0..80 {
        if health_ok(&client).await {
            return Ok(client);
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }

    Err("El modelo local tardó demasiado en arrancar.".to_string())
}

fn instructions() -> &'static str {
    "Eres el traductor integrado de Rhodes Archive. Traduce únicamente texto narrativo y diálogos de Arknights al español natural y neutro.\n\
Cada línea de entrada empieza por un identificador del tipo @@12@@.\n\
REGLAS OBLIGATORIAS:\n\
1. Devuelve exactamente una línea por identificador recibido.\n\
2. Empieza cada línea de salida con el mismo identificador @@N@@.\n\
3. Traduce solo el texto después del identificador.\n\
4. No añadas explicaciones, Markdown ni razonamiento.\n\
5. No inventes, resumas ni elimines contenido.\n\
6. Conserva literalmente marcadores como {@nbs}, {@nickname}, <i>, </i> y similares.\n\
7. No introduzcas saltos de línea dentro de una traducción."
}

fn strip_reasoning(text: &str) -> String {
    let mut s = text.trim().to_string();
    while let Some(start) = s.find("<think>") {
        if let Some(relative_end) = s[start..].find("</think>") {
            let end = start + relative_end + "</think>".len();
            s.replace_range(start..end, "");
        } else {
            break;
        }
    }
    if s.starts_with("```") {
        s = s.trim_start_matches("```").to_string();
        if let Some(pos) = s.find('\n') {
            s = s[pos + 1..].to_string();
        }
        s = s.trim_end_matches("```").trim().to_string();
    }
    s
}

/// Split a StoryPlayer line into an immutable technical prefix and visible text.
/// Example: [name="Amiya"]你好 -> ("[name=\"Amiya\"]", "你好")
/// Pure technical lines return an empty visible string and are never sent to AI.
fn split_technical_prefix(line: &str) -> (&str, &str) {
    let mut pos = 0usize;
    let bytes = line.as_bytes();

    while pos < bytes.len() && bytes[pos] == b'[' {
        let Some(relative_end) = line[pos..].find(']') else {
            break;
        };
        pos += relative_end + 1;
    }

    (&line[..pos], &line[pos..])
}

#[derive(Clone)]
struct LineParts {
    prefix: String,
    visible: String,
    newline: String,
}

fn parse_script(script: &str) -> Vec<LineParts> {
    script
        .split_inclusive('\n')
        .map(|raw| {
            let (body, newline) = if let Some(stripped) = raw.strip_suffix("\r\n") {
                (stripped, "\r\n")
            } else if let Some(stripped) = raw.strip_suffix('\n') {
                (stripped, "\n")
            } else {
                (raw, "")
            };
            let (prefix, visible) = split_technical_prefix(body);
            LineParts {
                prefix: prefix.to_string(),
                visible: visible.to_string(),
                newline: newline.to_string(),
            }
        })
        .collect()
}

async fn translate_batch(
    client: &reqwest::Client,
    items: &[(usize, String)],
) -> Result<Vec<(usize, String)>, String> {
    let mut prompt = String::from("/no_think\nTraduce estas líneas:\n");
    for (id, text) in items {
        prompt.push_str(&format!("@@{id}@@ {text}\n"));
    }

    let body = json!({
        "model": MODEL_NAME,
        "messages": [
            { "role": "system", "content": instructions() },
            { "role": "user", "content": prompt }
        ],
        "temperature": 0.0,
        "max_tokens": 4096,
        "stream": false
    });

    let resp = client
        .post(format!("http://127.0.0.1:{SERVER_PORT}/v1/chat/completions"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Error del traductor local: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("No se pudo leer la respuesta del traductor local: {e}"))?;

    if !status.is_success() {
        return Err(format!(
            "El traductor local devolvió HTTP {}: {}",
            status.as_u16(),
            text
        ));
    }

    let value: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Respuesta local no válida: {e}"))?;
    let result = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .map(strip_reasoning)
        .ok_or_else(|| "El traductor local no devolvió texto.".to_string())?;

    let mut translated = Vec::new();
    for line in result.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("@@") {
            continue;
        }
        let rest = &trimmed[2..];
        let Some(end) = rest.find("@@") else {
            continue;
        };
        let Ok(id) = rest[..end].parse::<usize>() else {
            continue;
        };
        let value = rest[end + 2..].trim_start().to_string();
        if !value.is_empty() {
            translated.push((id, value));
        }
    }

    Ok(translated)
}

async fn translate_script(client: &reqwest::Client, script: &str) -> Result<String, String> {
    let mut lines = parse_script(script);
    let mut pending: Vec<(usize, String)> = lines
        .iter()
        .enumerate()
        .filter_map(|(i, line)| {
            if line.visible.trim().is_empty() {
                None
            } else {
                Some((i, line.visible.clone()))
            }
        })
        .collect();

    while !pending.is_empty() {
        let mut batch = Vec::new();
        let mut chars = 0usize;
        while !pending.is_empty() && batch.len() < MAX_BATCH_ITEMS {
            let next_chars = pending[0].1.chars().count();
            if !batch.is_empty() && chars + next_chars > MAX_BATCH_CHARS {
                break;
            }
            let item = pending.remove(0);
            chars += item.1.chars().count();
            batch.push(item);
        }

        let translated = translate_batch(client, &batch).await?;
        // Missing/garbled model outputs deliberately keep the original visible text.
        // The StoryPlayer command structure can therefore never be damaged by AI.
        for (id, value) in translated {
            if let Some(line) = lines.get_mut(id) {
                line.visible = value;
            }
        }
    }

    let mut out = String::with_capacity(script.len());
    for line in lines {
        out.push_str(&line.prefix);
        out.push_str(&line.visible);
        out.push_str(&line.newline);
    }
    Ok(out)
}

#[tauri::command]
pub fn auto_translation_configured(app: AppHandle) -> bool {
    find_local_ai_dir(&app).is_ok()
}

#[tauri::command]
pub async fn auto_translate_and_save(
    app: AppHandle,
    page_title: String,
    script: String,
) -> Result<String, String> {
    let client = ensure_server(&app).await?;
    let translated = translate_script(&client, &script).await?;

    let dir = translations::translations_dir()?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de traducciones: {e}"))?;
    let filename = format!("AUTO - {}.txt", sanitize_filename(&page_title));
    let path = dir.join(filename);
    let contents = format!("#ARKSTAGE_TITLE={}\n{}", page_title, translated);
    fs::write(&path, contents)
        .map_err(|e| format!("No se pudo guardar la traducción automática: {e}"))?;

    Ok(translated)
}
