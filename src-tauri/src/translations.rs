use regex::Regex;
use serde::Serialize;
use std::{collections::BTreeSet, env, fs, path::{Path, PathBuf}, process::Command};

#[derive(Debug, Serialize)]
pub struct TranslationFileInfo {
    pub filename: String,
    pub page_title: String,
    pub bytes: u64,
    pub language: String,
    pub characters: Vec<String>,
}

fn project_root_from_cwd() -> Option<PathBuf> {
    let cwd = env::current_dir().ok()?;
    if cwd.join("package.json").is_file() {
        return Some(cwd);
    }
    if cwd.file_name().and_then(|s| s.to_str()) == Some("src-tauri") {
        if let Some(parent) = cwd.parent() {
            if parent.join("package.json").is_file() {
                return Some(parent.to_path_buf());
            }
        }
    }
    None
}

pub(crate) fn translations_dir() -> Result<PathBuf, String> {
    if let Ok(custom) = env::var("ARKSTAGE_TRANSLATIONS_DIR") {
        let path = PathBuf::from(custom);
        fs::create_dir_all(&path).map_err(|e| format!("No se pudo crear la carpeta de traducciones: {e}"))?;
        return Ok(path);
    }

    let base = if let Some(root) = project_root_from_cwd() {
        root
    } else {
        env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(Path::to_path_buf))
            .ok_or_else(|| "No se pudo localizar la carpeta de Arkstage".to_string())?
    };

    let dir = base.join("translations");
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta de traducciones: {e}"))?;
    Ok(dir)
}

fn parse_translation_file(path: &Path) -> Result<(String, String), String> {
    let raw = fs::read_to_string(path).map_err(|e| format!("No se pudo leer {}: {e}", path.display()))?;
    let normalized = raw.strip_prefix('\u{feff}').unwrap_or(&raw);
    let first = normalized.lines().next().unwrap_or("").trim();
    const PREFIX: &str = "#ARKSTAGE_TITLE=";

    if !first.starts_with(PREFIX) {
        return Err(format!("{} no empieza por {}", path.file_name().and_then(|s| s.to_str()).unwrap_or("archivo"), PREFIX));
    }

    let title = first[PREFIX.len()..].trim();
    if title.is_empty() {
        return Err("PAGE TITLE vacío".to_string());
    }

    let script = normalized
        .split_once('\n')
        .map(|(_, rest)| rest.strip_prefix('\r').unwrap_or(rest))
        .unwrap_or("")
        .to_string();

    Ok((title.to_string(), script))
}

fn translation_language(script: &str) -> String {
    for line in script.lines().take(12) {
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix("#LANG=") {
            let lang = value.trim().to_lowercase();
            if !lang.is_empty() {
                return lang;
            }
        }
    }
    "es".to_string()
}

fn translation_characters(script: &str) -> Vec<String> {
    let re = Regex::new(r#"(?i)\bname\s*=\s*[\"']([^\"']+)[\"']"#).unwrap();
    let mut names = BTreeSet::new();
    for captures in re.captures_iter(script) {
        if let Some(m) = captures.get(1) {
            let name = m.as_str().trim();
            if !name.is_empty() && name.len() <= 80 {
                names.insert(name.to_string());
            }
        }
    }
    names.into_iter().collect()
}

#[tauri::command]
pub fn translation_folder_path() -> Result<String, String> {
    Ok(translations_dir()?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_translation_files() -> Result<Vec<TranslationFileInfo>, String> {
    let dir = translations_dir()?;
    let mut out = Vec::new();

    for entry in fs::read_dir(&dir).map_err(|e| format!("No se pudo leer la carpeta: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("txt")) != Some(true) {
            continue;
        }

        if let Ok((page_title, script)) = parse_translation_file(&path) {
            let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(TranslationFileInfo {
                filename: entry.file_name().to_string_lossy().to_string(),
                page_title,
                bytes,
                language: translation_language(&script),
                characters: translation_characters(&script),
            });
        }
    }

    out.sort_by(|a, b| a.page_title.cmp(&b.page_title));
    Ok(out)
}

#[tauri::command]
pub fn import_translation_file(source_path: String) -> Result<String, String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("El archivo seleccionado no existe.".to_string());
    }
    if source.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("txt")) != Some(true) {
        return Err("Solo se pueden importar archivos .txt".to_string());
    }

    parse_translation_file(&source)?;

    let dir = translations_dir()?;
    let original_name = source.file_name().and_then(|s| s.to_str()).unwrap_or("traduccion.txt");
    let stem = source.file_stem().and_then(|s| s.to_str()).unwrap_or("traduccion");
    let ext = source.extension().and_then(|s| s.to_str()).unwrap_or("txt");
    let mut destination = dir.join(original_name);
    let mut n = 2usize;
    while destination.exists() {
        destination = dir.join(format!("{} ({n}).{}", stem, ext));
        n += 1;
    }

    fs::copy(&source, &destination)
        .map_err(|e| format!("No se pudo importar la traducción: {e}"))?;

    Ok(destination.file_name().and_then(|s| s.to_str()).unwrap_or(original_name).to_string())
}

#[tauri::command]
pub fn load_translation_for_title(
    page_title: String,
    language: Option<String>,
) -> Result<Option<String>, String> {
    let dir = translations_dir()?;
    let wanted_language = language.map(|v| v.trim().to_lowercase());

    for entry in fs::read_dir(&dir).map_err(|e| format!("No se pudo leer la carpeta: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("txt")) != Some(true) {
            continue;
        }
        if let Ok((title, script)) = parse_translation_file(&path) {
            if title != page_title {
                continue;
            }
            if let Some(ref wanted) = wanted_language {
                if translation_language(&script) != *wanted {
                    continue;
                }
            }
            return Ok(Some(script));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn open_translation_folder() -> Result<(), String> {
    let dir = translations_dir()?;
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(&dir).spawn().map_err(|e| format!("No se pudo abrir la carpeta: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(&dir).spawn().map_err(|e| format!("No se pudo abrir la carpeta: {e}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos"), not(target_os = "android")))]
    {
        Command::new("xdg-open").arg(&dir).spawn().map_err(|e| format!("No se pudo abrir la carpeta: {e}"))?;
    }
    Ok(())
}
