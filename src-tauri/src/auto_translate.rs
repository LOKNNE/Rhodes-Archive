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
const MAX_CHUNK_CHARS: usize = 4_500;

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

fn split_script(script: &str) -> Vec<String> {
    if script.chars().count() <= MAX_CHUNK_CHARS {
        return vec![script.to_string()];
    }

    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut count = 0usize;

    for line in script.split_inclusive('\n') {
        let line_count = line.chars().count();
        if !current.is_empty() && count + line_count > MAX_CHUNK_CHARS {
            chunks.push(current);
            current = String::new();
            count = 0;
        }
        current.push_str(line);
        count += line_count;
    }

    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

fn local_ai_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        out.push(resource_dir.join("local-ai"));
        out.push(resource_dir.join("resources").join("local-ai"));
    }

    // Development path: src-tauri/resources/local-ai.
    out.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("local-ai"));
    out
}

fn find_local_ai_dir(app: &AppHandle) -> Result<PathBuf, String> {
    for dir in local_ai_candidates(app) {
        let server = dir.join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" });
        let model = dir.join(MODEL_NAME);
        if server.exists() && model.exists() {
            return Ok(dir);
        }
    }

    Err(
        "El traductor local no está incluido en esta compilación. Vuelve a compilar Rhodes Archive para preparar el modelo local."
            .to_string(),
    )
}

fn server_executable(dir: &Path) -> PathBuf {
    dir.join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" })
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
        // Do not flash a console window when the bundled inference server starts.
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
    "Eres el traductor integrado de Rhodes Archive. Traduce guiones de Arknights al español natural y neutro.\n\
No expliques nada y no muestres tu razonamiento. Devuelve únicamente el guion traducido.\n\
REGLAS OBLIGATORIAS:\n\
1. Conserva EXACTAMENTE los comandos del StoryPlayer, etiquetas, IDs, corchetes, llaves, parámetros, claves, rutas y nombres de recursos.\n\
2. Traduce únicamente el texto visible para el lector.\n\
3. No inventes, resumas ni elimines contenido.\n\
4. Mantén los nombres propios y términos de Arknights de forma coherente.\n\
5. Conserva el orden de las líneas y los saltos de línea.\n\
6. No uses Markdown ni bloques de código.\n\
7. Si una línea es solo un comando técnico, devuélvela idéntica."
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

fn technical_line_count(text: &str) -> usize {
    text.lines().filter(|line| line.trim_start().starts_with('[')).count()
}

fn validate_structure(original: &str, translated: &str) -> Result<(), String> {
    if translated.trim().is_empty() {
        return Err("El modelo local devolvió una traducción vacía.".to_string());
    }

    let before = technical_line_count(original);
    let after = technical_line_count(translated);
    let tolerance = ((before as f32) * 0.05).ceil() as usize + 2;
    if before.abs_diff(after) > tolerance {
        return Err(format!(
            "La traducción alteró demasiados comandos del StoryPlayer ({before} -> {after})."
        ));
    }
    Ok(())
}

async fn translate_chunk(client: &reqwest::Client, chunk: &str) -> Result<String, String> {
    let body = json!({
        "model": MODEL_NAME,
        "messages": [
            { "role": "system", "content": instructions() },
            { "role": "user", "content": format!("/no_think\nTraduce este fragmento:\n\n{chunk}") }
        ],
        "temperature": 0.1,
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
        return Err(format!("El traductor local devolvió HTTP {}: {}", status.as_u16(), text));
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

    validate_structure(chunk, &result)?;
    Ok(result)
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
    let chunks = split_script(&script);
    let mut translated = String::new();

    for chunk in chunks {
        let part = translate_chunk(&client, &chunk).await?;
        translated.push_str(&part);
        if !translated.ends_with('\n') && chunk.ends_with('\n') {
            translated.push('\n');
        }
    }

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
