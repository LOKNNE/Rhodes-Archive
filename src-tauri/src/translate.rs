use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
struct TranslationCache {
    source_hash: String,
    script: String,
}

fn cache_dir() -> PathBuf {
    crate::data_root::data_root().join("translations")
}

fn title_key(title: &str) -> String {
    let mut h = Sha256::new();
    h.update(title.as_bytes());
    format!("{:x}", h.finalize())
}

fn source_hash(script: &str) -> String {
    let mut h = Sha256::new();
    h.update(script.as_bytes());
    format!("{:x}", h.finalize())
}

fn cache_path(title: &str) -> PathBuf {
    cache_dir().join(format!("{}.json", title_key(title)))
}

#[tauri::command]
pub fn translation_cache_get(title: String, source_script: String) -> Result<Option<String>, String> {
    let path = cache_path(&title);
    let raw = match fs::read_to_string(path) {
        Ok(v) => v,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("No se pudo leer la caché de traducción: {e}")),
    };

    let cached: TranslationCache =
        serde_json::from_str(&raw).map_err(|e| format!("Caché de traducción inválida: {e}"))?;

    if cached.source_hash == source_hash(&source_script) {
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
) -> Result<(), String> {
    let dir = cache_dir();
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de traducciones: {e}"))?;

    let cached = TranslationCache {
        source_hash: source_hash(&source_script),
        script: translated_script,
    };
    let raw = serde_json::to_string(&cached)
        .map_err(|e| format!("No se pudo serializar la traducción: {e}"))?;

    fs::write(cache_path(&title), raw)
        .map_err(|e| format!("No se pudo guardar la traducción: {e}"))
}

fn extract_output_text(value: &Value) -> Option<String> {
    let output = value.get("output")?.as_array()?;
    for item in output {
        let content = item.get("content")?.as_array()?;
        for part in content {
            if part.get("type").and_then(Value::as_str) == Some("output_text") {
                if let Some(text) = part.get("text").and_then(Value::as_str) {
                    return Some(text.to_string());
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn translate_segments(
    title: String,
    segments: Vec<String>,
) -> Result<Vec<String>, String> {
    if segments.is_empty() {
        return Ok(Vec::new());
    }

    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "Falta OPENAI_API_KEY. Cierra Arkstage y vuelve a abrirlo después de configurar la variable de entorno.".to_string())?;

    let model = std::env::var("OPENAI_TRANSLATION_MODEL")
        .unwrap_or_else(|_| "gpt-5.6-luna".to_string());

    let glossary = r#"
GLOSARIO OBLIGATORIO:
结城理 = Makoto Yuki
岳羽由加莉 = Yukari Takeba
天田乾 = Ken Amada
虎狼丸 = Koromaru
山岸風花 / 山岸风花 / 风花 = Fuuka Yamagishi
アイギス / 埃癸斯 = Aigis
拉特兰 = Laterano
萨科塔 = Sankta
黎博利 = Liberi
塔尔塔罗斯 = Tártaro
影时间 = Hora Oscura
暗影 = Sombra / Sombras según el contexto
S.E.E.S. = S.E.E.S.
裘里奥 = Giulio
吉阿达 = Giada
公证所 = Salón Notarial
执行者 = Ejecutor
{@nickname} = LOKNNE
"#;

    let instructions = format!(
        r#"Eres el traductor integrado de Arkstage para historias de Arknights.
Traduce chino a español natural de España, manteniendo el tono de una visual novel.
No añadas explicaciones.
No inventes información.
Conserva signos especiales, variables entre llaves y separadores como ';' cuando aparezcan.
Los nombres y términos del glosario deben escribirse EXACTAMENTE como se indica.
Si una entrada es solo un nombre propio, devuelve solo el nombre traducido.
Si una entrada ya está en español o no necesita traducción, devuélvela sin cambios.
El orden de salida debe coincidir exactamente con el orden de entrada.

Título interno de la historia: {title}

{glossary}"#
    );

    let body = json!({
        "model": model,
        "store": false,
        "instructions": instructions,
        "input": serde_json::to_string(&segments)
            .map_err(|e| format!("No se pudieron preparar los textos: {e}"))?,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "arkstage_translation",
                "strict": true,
                "schema": {
                    "type": "object",
                    "properties": {
                        "translations": {
                            "type": "array",
                            "items": { "type": "string" }
                        }
                    },
                    "required": ["translations"],
                    "additionalProperties": false
                }
            }
        }
    });

    let response = crate::net::client()
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("No se pudo conectar con OpenAI: {e}"))?;

    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|e| format!("Respuesta de OpenAI no válida: {e}"))?;

    if !status.is_success() {
        let message = value
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("Error desconocido de OpenAI");
        return Err(format!("OpenAI HTTP {}: {}", status.as_u16(), message));
    }

    let output_text = extract_output_text(&value)
        .ok_or_else(|| "OpenAI no devolvió texto traducido.".to_string())?;

    let parsed: Value = serde_json::from_str(&output_text)
        .map_err(|e| format!("OpenAI devolvió un formato inesperado: {e}"))?;

    let translated = parsed
        .get("translations")
        .and_then(Value::as_array)
        .ok_or_else(|| "Falta 'translations' en la respuesta de OpenAI.".to_string())?
        .iter()
        .map(|v| v.as_str().unwrap_or_default().to_string())
        .collect::<Vec<_>>();

    if translated.len() != segments.len() {
        return Err(format!(
            "OpenAI devolvió {} textos, pero se enviaron {}.",
            translated.len(),
            segments.len()
        ));
    }

    Ok(translated)
}
