use crate::models::{StoryPlayerBundle, WidgetBundleData, WidgetDiagnostics};
use regex::Regex;
use scraper::{Html, Selector};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, VecDeque};
use std::sync::OnceLock;
use tokio::sync::Mutex;

const WIDGET_BASE: &str = "https://static.prts.wiki/widgets/production/";
const SIDECARS: [&str; 3] = [
    "https://torappu.prts.wiki/assets/avg/character.json",
    "https://torappu.prts.wiki/assets/avg/background.json",
    "https://torappu.prts.wiki/gamedata/latest/story/story_variables.json",
];

fn widget_url(url: &str) -> bool {
    url.strip_prefix(WIDGET_BASE).is_some_and(|name| {
        !name.is_empty()
            && name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c))
    })
}

fn entry_points(html: &str) -> Result<Option<(String, Vec<String>, Vec<String>)>, String> {
    let doc = Html::parse_document(html);
    let scripts = Selector::parse("script[type=module][src]").unwrap();
    let entry = doc
        .select(&scripts)
        .filter_map(|el| el.value().attr("src"))
        .find(|url| {
            url.rsplit('/')
                .next()
                .is_some_and(|name| name.starts_with("StoryPlayer.") && name.ends_with(".js"))
        });
    let Some(entry) = entry else { return Ok(None) };
    if !widget_url(entry) {
        return Err("Unsupported StoryPlayer module origin".into());
    }
    let links = Selector::parse("link[rel=stylesheet][href]").unwrap();
    let styles: Vec<_> = doc
        .select(&links)
        .filter_map(|el| el.value().attr("href"))
        .filter(|url| widget_url(url) && url.ends_with(".css"))
        .map(str::to_string)
        .collect();
    if styles.is_empty() {
        return Err("StoryPlayer stylesheet missing".into());
    }
    let prelude = doc
        .select(&scripts)
        .filter_map(|el| el.value().attr("src"))
        .filter(|url| {
            widget_url(url)
                && url
                    .rsplit('/')
                    .next()
                    .is_some_and(|name| name.starts_with("polyfills.") && name.ends_with(".js"))
        })
        .map(str::to_string)
        .collect();
    Ok(Some((entry.to_string(), styles, prelude)))
}

/// Include both static imports and Vite/Pixi lazy chunk tables. Restrict paths
/// to the widget directory; unrelated wiki widgets/analytics are never loaded.
fn module_dependencies(source: &str) -> Vec<String> {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    let pattern = PATTERN.get_or_init(|| {
        Regex::new(r#"["'`](?:\./)?([A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+\.js)["'`]"#).unwrap()
    });
    pattern
        .captures_iter(source)
        .map(|m| format!("{WIDGET_BASE}{}", &m[1]))
        .collect()
}

async fn fetch_text(url: &str) -> Result<String, String> {
    crate::net::ensure_online()?;

    // Normal path: use Arkstage's shared reqwest client.
    let primary = crate::net::client()
        .get(url)
        .header("Referer", "https://prts.wiki/")
        .send()
        .await;

    let bytes = match primary {
        Ok(response) => {
            let response = response
                .error_for_status()
                .map_err(|e| format!("StoryPlayer {url}: {e}"))?;

            if response
                .content_length()
                .is_some_and(|n| n > 16 * 1024 * 1024)
            {
                return Err(format!("StoryPlayer asset too large: {url}"));
            }

            response.bytes().await.map_err(|e| e.to_string())?.to_vec()
        }
        Err(reqwest_error) => {
            // Windows fallback: if reqwest cannot reach the PRTS static CDN but the
            // system browser can, try the built-in Windows curl.exe.
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;

                let output = Command::new("curl.exe")
                    .args([
                        "-L",
                        "--fail",
                        "--silent",
                        "--show-error",
                        "--connect-timeout",
                        "20",
                        "--max-time",
                        "120",
                        "--retry",
                        "2",
                        "--retry-delay",
                        "3",
                        "--retry-all-errors",
                        "-A",
                        "Mozilla/5.0",
                        "-e",
                        "https://prts.wiki/",
                        url,
                    ])
                    .output()
                    .map_err(|curl_error| {
                        format!(
                            "StoryPlayer {url}: reqwest failed ({reqwest_error}); curl.exe failed to start ({curl_error})"
                        )
                    })?;

                if !output.status.success() {
                    return Err(format!(
                        "StoryPlayer {url}: reqwest failed ({reqwest_error}); curl.exe exited with {}: {}",
                        output.status,
                        String::from_utf8_lossy(&output.stderr).trim()
                    ));
                }

                output.stdout
            }

            #[cfg(not(target_os = "windows"))]
            {
                return Err(format!("StoryPlayer {url}: {reqwest_error}"));
            }
        }
    };

    if bytes.is_empty() || bytes.len() > 16 * 1024 * 1024 {
        return Err(format!("Invalid StoryPlayer asset size: {url}"));
    }

    let text = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    if text.trim_start().starts_with('<') {
        return Err(format!("HTML returned for StoryPlayer asset: {url}"));
    }

    Ok(text)
}

async fn fetch_bundle(
    entry: String,
    style_urls: Vec<String>,
    prelude: Vec<String>,
) -> Result<StoryPlayerBundle, String> {
    let mut modules = BTreeMap::new();
    let mut pending = VecDeque::from([entry.clone()]);
    pending.extend(prelude.iter().cloned());
    let mut total_bytes = 0;
    while let Some(url) = pending.pop_front() {
        if modules.contains_key(&url) {
            continue;
        }
        if modules.len() >= 80 {
            return Err("StoryPlayer module graph exceeds limit".into());
        }
        let source = fetch_text(&url).await?;
        total_bytes += source.len();
        if total_bytes > 32 * 1024 * 1024 {
            return Err("StoryPlayer module graph too large".into());
        }
        pending.extend(module_dependencies(&source));
        modules.insert(url, source);
    }
    let mut styles = BTreeMap::new();
    for url in style_urls {
        styles.insert(url.clone(), fetch_text(&url).await?);
    }
    let mut data = BTreeMap::new();
    for url in SIDECARS {
        let value: serde_json::Value =
            serde_json::from_str(&fetch_text(url).await?).map_err(|e| e.to_string())?;
        let count = value.as_object().map_or(0, |o| o.len());
        let minimum = if url.ends_with("character.json") {
            100
        } else {
            10
        };
        if count < minimum {
            return Err(format!(
                "Incomplete StoryPlayer sidecar: {url} ({count} entries)"
            ));
        }
        data.insert(url.to_string(), value);
    }
    Ok(StoryPlayerBundle {
        entry,
        prelude,
        modules,
        styles,
        data,
    })
}

pub async fn from_html(html: &str) -> Result<Option<WidgetBundleData>, String> {
    let Some((entry, styles, prelude)) = entry_points(html)? else {
        return Ok(None);
    };
    // One fresh snapshot per entry+CSS generation per app session. A failed fetch
    // is not memoized; persisted last-known-good is managed by predownload.ts.
    static CACHE: OnceLock<Mutex<HashMap<String, StoryPlayerBundle>>> = OnceLock::new();
    let key = format!("{entry}|{}|{}", styles.join("|"), prelude.join("|"));
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .await;
    let player = if let Some(player) = cache.get(&key) {
        player.clone()
    } else {
        let player = fetch_bundle(entry, styles, prelude).await?;
        cache.insert(key, player.clone());
        player
    };
    drop(cache);
    let script = crate::parser::story_page::extract_story_script_for(html, None)
        .ok_or("StoryPlayer script missing")?
        .script;
    let revision = format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&player).map_err(|e| e.to_string())?)
    );
    Ok(Some(WidgetBundleData {
        story_player: Some(player),
        dom_html: "<div id=\"root\"></div>".into(),
        data_blocks_html: format!(
            "<pre id=\"datas_txt\" hidden>{}</pre>",
            html_escape::encode_text(&script)
        ),
        engine_scripts: vec![],
        revision,
        diagnostics: WidgetDiagnostics::default(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn detects_modern_player_without_legacy_dom_and_rejects_foreign_entry() {
        let html = format!("<script src='{WIDGET_BASE}StoryPlayer.hash.js' type='module'></script><link href='{WIDGET_BASE}style.hash.css' rel='stylesheet'>");
        let (entry, styles, prelude) = entry_points(&html).unwrap().unwrap();
        assert!(prelude.is_empty());
        assert!(entry.ends_with("StoryPlayer.hash.js"));
        assert_eq!(styles.len(), 1);
        assert!(entry_points(&html.replace(WIDGET_BASE, "https://example.com/")).is_err());
        assert!(entry_points("<script src='legacy.js'></script>")
            .unwrap()
            .is_none());
    }
    #[test]
    fn follows_static_and_lazy_chunks_without_unrelated_urls() {
        let deps = module_dependencies(
            r#"import './pixi.abc.js';import{a}from"./common.xyz.js";const chunks=["Canvas.def.js"];fetch('https://example.com/tracker.js')"#,
        );
        assert_eq!(deps.len(), 3);
        assert!(deps.iter().all(|url| widget_url(url)));
        assert!(deps[2].ends_with("Canvas.def.js"));
    }
}
