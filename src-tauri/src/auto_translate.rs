use serde_json::{json, Value};
use std::{env, fs};

use crate::{net, translations};

const DEFAULT_MODEL: &str = "gpt-6-sol";
const MAX_CHUNK_CHARS: usize = 12_000;

fn api_key() -> Result<String, String> {
    env::var("OPENAI_API_KEY")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "OPENAI_API_KEY no está configurada. Configúrala en Windows y reinicia Rhodes Archive."
                .to_string()
        })
}

fn model() -> String {
    env::var("OPENAI_MODEL")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string())
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

fn instructions() -> &'static str {
    "Traduce este guion de Arknights al español natural y fluido.\n\
REGLAS OBLIGATORIAS:\n\
1. Devuelve SOLO el guion traducido, sin Markdown ni explicaciones.\n\
2. Conserva exactamente comandos, etiquetas, IDs, corchetes, llaves, nombres de parámetros y estructura del StoryPlayer.\n\
3. Traduce únicamente texto natural visible para el lector.\n\
4. No inventes, resumas ni elimines contenido.\n\
5. Mantén coherencia de nombres propios y términos de Arknights.\n\
6. Conserva el mismo orden de líneas y, siempre que sea posible, el mismo número de líneas.\n\
7. No traduzcas nombres técnicos, rutas, claves ni identificadores internos.\n\
8. Usa español neutro y natural."
}

fn extract_output_text(value: &Value) -> Option<String> {
    let output = value.get("output")?.as_array()?;
    let mut parts = Vec::new();
    for item in output {
        if item.get("type").and_then(Value::as_str) != Some("message") {
            continue;
        }
        if let Some(content) = item.get("content").and_then(Value::as_array) {
            for piece in content {
                if piece.get("type").and_then(Value::as_str) == Some("output_text") {
                    if let Some(text) = piece.get("text").and_then(Value::as_str) {
                        parts.push(text.to_string());
                    }
                }
            }
        }
    }
    if parts.is_empty() { None } else { Some(parts.join("")) }
}

async fn translate_chunk(key: &str, model: &str, chunk: &str) -> Result<String, String> {
    net::ensure_online()?;

    let body = json!({
        "model": model,
        "instructions": instructions(),
        "input": chunk
    });

    let resp = net::client()
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Error al conectar con OpenAI: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("No se pudo leer la respuesta de OpenAI: {e}"))?;

    if !status.is_success() {
        let detail = serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|v| v.get("error")?.get("message")?.as_str().map(str::to_string))
            .unwrap_or(text);
        return Err(format!("OpenAI devolvió HTTP {}: {}", status.as_u16(), detail));
    }

    let value: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Respuesta de OpenAI no válida: {e}"))?;

    extract_output_text(&value)
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "OpenAI devolvió una traducción vacía.".to_string())
}

#[tauri::command]
pub fn auto_translation_configured() -> bool {
    api_key().is_ok()
}

#[tauri::command]
pub async fn auto_translate_and_save(page_title: String, script: String) -> Result<String, String> {
    let key = api_key()?;
    let model = model();
    let chunks = split_script(&script);
    let mut translated = String::new();

    for chunk in chunks {
        let part = translate_chunk(&key, &model, &chunk).await?;
        translated.push_str(&part);
        if !translated.ends_with('\n') && chunk.ends_with('\n') {
            translated.push('\n');
        }
    }

    let dir = translations::translations_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta de traducciones: {e}"))?;
    let filename = format!("AUTO - {}.txt", sanitize_filename(&page_title));
    let path = dir.join(filename);
    let contents = format!("#ARKSTAGE_TITLE={}\n{}", page_title, translated);
    fs::write(&path, contents)
        .map_err(|e| format!("No se pudo guardar la traducción automática: {e}"))?;

    Ok(translated)
}
