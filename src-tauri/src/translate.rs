use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
struct TranslationCache {
    source_hash: String,
    target_language: String,
    script: String,
}

fn cache_dir() -> PathBuf {
    crate::data_root::data_root().join("translations")
}

fn title_key(title: &str, target_language: &str) -> String {
    let mut h = Sha256::new();
    h.update(title.as_bytes());
    h.update(b":");
    h.update(target_language.as_bytes());
    format!("{:x}", h.finalize())
}

fn source_hash(script: &str) -> String {
    let mut h = Sha256::new();
    h.update(script.as_bytes());
    format!("{:x}", h.finalize())
}

fn cache_path(title: &str, target_language: &str) -> PathBuf {
    cache_dir().join(format!("{}.json", title_key(title, target_language)))
}

#[tauri::command]
pub fn translation_cache_get(
    title: String,
    source_script: String,
    target_language: String,
) -> Result<Option<String>, String> {
    let path = cache_path(&title, &target_language);

    let raw = match fs::read_to_string(path) {
        Ok(v) => v,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("No se pudo leer la caché de traducción: {e}")),
    };

    let cached: TranslationCache =
        serde_json::from_str(&raw).map_err(|e| format!("Caché de traducción inválida: {e}"))?;

    if cached.source_hash == source_hash(&source_script)
        && cached.target_language == target_language
    {
        Ok(Some(cached.script))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn translation_cache_put(
    title: String,
    source_script: String,
    translated_script: String,
    target_language: String,
) -> Result<(), String> {
    let dir = cache_dir();

    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de traducciones: {e}"))?;

    let cached = TranslationCache {
        source_hash: source_hash(&source_script),
        target_language: target_language.clone(),
        script: translated_script,
    };

    let raw = serde_json::to_string(&cached)
        .map_err(|e| format!("No se pudo serializar la traducción: {e}"))?;

    fs::write(cache_path(&title, &target_language), raw)
        .map_err(|e| format!("No se pudo guardar la traducción: {e}"))
}

fn libretranslate_url() -> String {
    std::env::var("LIBRETRANSLATE_URL")
        .unwrap_or_else(|_| "https://rhodes-translate.onrender.com".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn translated_text(value: &Value) -> Option<String> {
    value
        .get("translatedText")
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

#[tauri::command]
pub async fn translate_segments(
    _title: String,
    segments: Vec<String>,
    target_language: String,
) -> Result<Vec<String>, String> {
    if segments.is_empty() {
        return Ok(Vec::new());
    }

    let target = match target_language.as_str() {
        "es" => "es",
        "en" => "en",
        _ => return Err(format!("Idioma de destino no compatible: {target_language}")),
    };

    let base_url = libretranslate_url();
    let endpoint = format!("{base_url}/translate");
    let client = crate::net::client();

    let mut out = Vec::with_capacity(segments.len());

    for (index, segment) in segments.iter().enumerate() {
        let body = json!({
            "q": segment,
            "source": "auto",
            "target": target,
            "format": "text"
        });

        let response = client
            .post(&endpoint)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                format!(
                    "No se pudo conectar con LibreTranslate en {base_url}. Comprueba que el servidor esté disponible. Detalle: {e}"
                )
            })?;

        let status = response.status();
        let value: Value = response
            .json()
            .await
            .map_err(|e| format!("LibreTranslate devolvió una respuesta no válida: {e}"))?;

        if !status.is_success() {
            let detail = value
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("Error desconocido de LibreTranslate");

            return Err(format!(
                "LibreTranslate HTTP {} en el segmento {}/{}: {}",
                status.as_u16(),
                index + 1,
                segments.len(),
                detail
            ));
        }

        let translated = translated_text(&value)
            .ok_or_else(|| "LibreTranslate no devolvió 'translatedText'.".to_string())?;

        out.push(translated);
    }

    Ok(out)
}
