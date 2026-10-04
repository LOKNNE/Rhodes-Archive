import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isDebugConsoleEnabled, setDebugPref, debugBuildDefault } from "../lib/debugSettings";
import { isHidePlayerBack, setHidePlayerBack } from "../lib/uiSettings";
import { isAndroid } from "../lib/platform";
import { getDownloadSettings, setDownloadSettings } from "../lib/predownload";
import { useDownload } from "../lib/DownloadContext";
import { useCompression } from "../lib/CompressionContext";
import type { Tier, CompressEstimate } from "../lib/CompressionContext";
import type { StoryIndex } from "../hooks/useStoryIndex";
import { collectEnvInfo, copyText } from "../lib/diagnostics";
import { confirmAction } from "../lib/dialogs";

interface CacheStatus {
  story_index_cached: boolean;
  asset_db_cached: boolean;
  cached_stories: string[];
  total_size_bytes: number;
}

interface ResourceDirInfo {
  current: string;
  is_custom: boolean;
  default_dir: string;
  fallback_dir: string;
  default_writable: boolean;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const hideResourceDir = isAndroid();
  const { start: startPredownload, busy: downloadBusy } = useDownload();
  const compression = useCompression();
  const [showCompress, setShowCompress] = useState(false);
  const [compressEst, setCompressEst] = useState<CompressEstimate | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [nickname, setNickname] = useState("Doctor");
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resDir, setResDir] = useState<ResourceDirInfo | null>(null);
  const [debugConsole, setDebugConsole] = useState(isDebugConsoleEnabled());
  const [hidePlayerBack, setHidePlayerBackState] = useState(isHidePlayerBack());
  // Download tuning: concurrency + bandwidth limit (shown in KB/s; 0 = unlimited).
  const [concurrency, setConcurrency] = useState(4);
  const [rateLimitKbps, setRateLimitKbps] = useState(0);
  const [envInfo, setEnvInfo] = useState("");
  const [storyLanguage, setStoryLanguageState] = useState<"es" | "en">(
    localStorage.getItem("rhodes-story-language") === "en" ? "en" : "es",
  );
  const [playerLanguage, setPlayerLanguageState] = useState<"es" | "en">(
    localStorage.getItem("rhodes-ui-language") === "en" ? "en" : "es",
  );

  useEffect(() => {
    const saved = localStorage.getItem("prts-nickname");
    if (saved) setNickname(saved);
    refreshCacheStatus();
    invoke<ResourceDirInfo>("get_resource_dir").then(setResDir).catch(() => {});
    getDownloadSettings()
      .then((s) => {
        setConcurrency(s.concurrency);
        setRateLimitKbps(Math.round(s.rateLimitBps / 1024));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDownloadSettings = async (nextConcurrency: number, nextKbps: number) => {
    const c = Math.max(1, Math.min(32, Math.round(nextConcurrency) || 1));
    const kbps = Math.max(0, Math.round(nextKbps) || 0);
    setConcurrency(c);
    setRateLimitKbps(kbps);
    try {
      await setDownloadSettings({ concurrency: c, rateLimitBps: kbps * 1024 });
      showMsg(kbps === 0 ? `Guardado: ${c} descargas simultáneas, sin límite de velocidad` : `Guardado: ${c} descargas simultáneas, límite ${kbps} KB/s`);
    } catch (e) {
      showMsg(`Error al guardar: ${e instanceof Error ? e.message : String(e)}`, 5000);
    }
  };


  const chooseResourceDir = async () => {
    try {
      const picked = await open({ directory: true, multiple: false, title: "Seleccionar carpeta de recursos" });
      if (typeof picked !== "string") return; // cancelled
      const info = await invoke<ResourceDirInfo>("set_resource_dir", { path: picked });
      setResDir(info);
      showMsg("Carpeta de recursos cambiada. Los recursos ya descargados no se moverán automáticamente; se recomienda reiniciar la aplicación.", 6000);
      refreshCacheStatus();
    } catch (e) {
      showMsg(`Error al cambiar: ${e instanceof Error ? e.message : String(e)}`, 5000);
    }
  };

  const resetResourceDir = async () => {
    try {
      const info = await invoke<ResourceDirInfo>("reset_resource_dir");
      setResDir(info);
      showMsg("Se ha restaurado la carpeta de recursos predeterminada. Se recomienda reiniciar la aplicación.", 5000);
      refreshCacheStatus();
    } catch (e) {
      showMsg(`Error al restaurar: ${e instanceof Error ? e.message : String(e)}`, 5000);
    }
  };

  const togglePlayerBack = () => {
    const next = !hidePlayerBack;
    setHidePlayerBack(next);
    setHidePlayerBackState(next);
    showMsg(next ? "Botón de volver del reproductor oculto" : "Botón de volver del reproductor visible");
  };

  const toggleDebugConsole = () => {
    const next = !debugConsole;
    setDebugPref(next ? "on" : "off");
    setDebugConsole(next);
    showMsg(next ? "Consola de depuración activada" : "Consola de depuración desactivada");
  };

  const refreshCacheStatus = useCallback(async () => {
    try {
      const status = await invoke<CacheStatus>("get_cache_status");
      setCacheStatus(status);
    } catch {
      // Ignore
    }
  }, []);

  const copyEnvInfo = async () => {
    try {
      const info = await collectEnvInfo();
      setEnvInfo(info);
      await copyText(info);
      showMsg("Información del sistema copiada al portapapeles");
    } catch (e) {
      showMsg(`Error al obtener la información: ${e instanceof Error ? e.message : String(e)}`, 5000);
    }
  };

  const showMsg = (msg: string, duration = 3000) => {
    setMessage(msg);
    if (duration > 0) setTimeout(() => setMessage(""), duration);
  };

  const saveNickname = () => {
    localStorage.setItem("prts-nickname", nickname);
    showMsg("Nombre guardado");
  };

  const setStoryLanguage = (value: "es" | "en") => {
    localStorage.setItem("rhodes-story-language", value);
    setStoryLanguageState(value);
    showMsg(value === "es" ? "Historias en español" : "Stories in English");
  };

  const setPlayerLanguage = (value: "es" | "en") => {
    localStorage.setItem("rhodes-ui-language", value);
    setPlayerLanguageState(value);
    showMsg(value === "es" ? "Mensajes del reproductor en español" : "Player messages in English");
  };

  // Cache the assets of EVERY story in the index (one big background download).
  const cacheAllStories = async () => {
    if (!await confirmAction("Se descargarán los recursos de todas las historias. Puede consumir mucho almacenamiento y datos. ¿Continuar?")) return;
    setBusy(true);
    showMsg("Obteniendo catálogo de historias...", 0);
    try {
      const idx = await invoke<StoryIndex>("fetch_story_index");
      const titles = idx.categories.flatMap((c) =>
        c.chapters.flatMap((ch) => ch.stories.map((s) => s.page_title))
      );
      startPredownload(titles);
      showMsg(`Se ha iniciado la descarga de ${titles.length} historias. Puedes ver el progreso en la barra superior.`);
    } catch (e) {
      showMsg(`Error: ${e instanceof Error ? e.message : String(e)}`, 5000);
    } finally {
      setBusy(false);
    }
  };

  const clearAllCache = async () => {
    if (!await confirmAction("¿Eliminar toda la caché? Se borrarán el motor actualizado y los recursos de historias; se reconstruirán al volver a conectarse.")) return;
    try {
      await invoke("clear_cache");
      showMsg("Caché eliminada");
      refreshCacheStatus();
    } catch (e) {
      showMsg(`Error: ${e instanceof Error ? e.message : String(e)}`, 5000);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Open the compression tier dialog (fetch the size estimate first).
  const openCompress = async () => {
    if (downloadBusy) {
      showMsg("Espera a que termine la descarga actual antes de comprimir recursos.", 4000);
      return;
    }
    setSelectedTier(null);
    setShowCompress(true);
    try {
      setCompressEst(await compression.estimate());
    } catch (e) {
      showMsg(`Error al calcular: ${e instanceof Error ? e.message : String(e)}`, 5000);
    }
  };

  const confirmCompress = async () => {
    if (!selectedTier) return;
    setShowCompress(false);
    try {
      await compression.start(selectedTier);
      showMsg("Compresión iniciada. El progreso aparecerá en la barra inferior.");
    } catch (e) {
      showMsg(`Error de compresión: ${e instanceof Error ? e.message : String(e)}`, 5000);
    }
  };

  const TIER_LABELS: Record<Tier, string> = {
    off: "Desactivado",
    lossless: "Sin pérdida",
    q90: "Alta calidad",
    q70: "Máxima compresión",
  };

  return (
    <div className="settings-page">
      <div className="settings-content">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button className="back-icon" onClick={() => navigate(-1)} aria-label="Volver">◀</button>
        <h1 style={{ margin: 0 }}>Ajustes</h1>
      </div>

      {/* Nickname */}
      <div className="setting-group">
        <label>Nombre del Doctor (sustituye &#{123;@nickname&#x125; en las historias)</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Doctor"
          />
          <button className="btn-primary" onClick={saveNickname}>Guardar</button>
        </div>
      </div>

      {/* Translation languages */}
      <div className="setting-group">
        <label>Idioma de las historias</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button className={storyLanguage === "es" ? "btn-primary" : "nav-btn"} onClick={() => setStoryLanguage("es")}>Español</button>
          <button className={storyLanguage === "en" ? "btn-primary" : "nav-btn"} onClick={() => setStoryLanguage("en")}>English</button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Las traducciones .txt personalizadas del mismo idioma tienen prioridad; si no existen, se usa la traducción automática.
          </span>
        </div>
      </div>

      <div className="setting-group">
        <label>Idioma de los mensajes del reproductor</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button className={playerLanguage === "es" ? "btn-primary" : "nav-btn"} onClick={() => setPlayerLanguage("es")}>Español</button>
          <button className={playerLanguage === "en" ? "btn-primary" : "nav-btn"} onClick={() => setPlayerLanguage("en")}>English</button>
        </div>
      </div>

      {/* Download tuning */}
      <div className="setting-group">
        <label>Descargas</label>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px" }}>Descargas simultáneas</span>
            <input
              type="number"
              min={1}
              max={32}
              value={concurrency}
              style={{ width: "72px" }}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              onBlur={() => saveDownloadSettings(concurrency, rateLimitKbps)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px" }}>Límite (KB/s)</span>
            <input
              type="number"
              min={0}
              step={64}
              value={rateLimitKbps}
              style={{ width: "96px" }}
              onChange={(e) => setRateLimitKbps(Number(e.target.value))}
              onBlur={() => saveDownloadSettings(concurrency, rateLimitKbps)}
            />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>0 = sin límite</span>
          </div>
        </div>
      </div>

      {/* Hide the reader's on-screen back button */}
      <div className="setting-group">
        <label>Botón de volver del reproductor</label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button className="nav-btn" onClick={togglePlayerBack}>
            {hidePlayerBack ? "Ocultar botón: Sí" : "Ocultar botón: No"}
          </button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {hidePlayerBack ? "No se mostrará el botón durante la reproducción." : "El botón aparecerá en la esquina superior izquierda."}
          </span>
        </div>
      </div>

      {/* Debug console */}
      <div className="setting-group">
        <label>Consola de depuración</label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button className="nav-btn" onClick={toggleDebugConsole}>
            {debugConsole ? "Registro de depuración Activado" : "Registro de depuración: Desactivado"}
          </button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {debugConsole
              ? "Muestra el botón de depuración y permite consultar errores del motor."
              : "Oculta el botón de depuración."}
             (predeterminado: {debugBuildDefault() ? "activado" : "desactivado"})
          </span>
        </div>
      </div>

      {/* Resource directory (desktop only — Android storage is fixed) */}
      {!hideResourceDir && (
        <div className="setting-group">
        <label>Carpeta de recursos</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          <button className="btn-primary" onClick={chooseResourceDir}>Cambiar carpeta…</button>
          {resDir?.is_custom && (
            <button className="nav-btn" onClick={resetResourceDir}>Restaurar predeterminada</button>
          )}
        </div>
        <div className="cache-info">
          {resDir ? (
            <>
              <div style={{ wordBreak: "break-all" }}>
                Ubicación actual: {resDir.current}
                {resDir.is_custom ? " (personalizada)" : " (predeterminada)"}
              </div>
              <div style={{ wordBreak: "break-all", color: "var(--text-secondary)" }}>
                Ubicación predeterminada: {resDir.default_dir}
                {resDir.default_writable ? "" :  — sin permisos de escritura; se usa una alternativa"}
              </div>
              <div style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                Cambiar la carpeta no moverá automáticamente los recursos ya descargados. Se recomienda reiniciar la aplicación.
                Si la ubicación no tiene permisos de escritura, Arkstage utilizará la carpeta de datos del sistema.
              </div>
            </>
          ) : (
            <div>Leyendo carpeta de recursos...</div>
          )}
        </div>
        </div>
      )}

      {/* Cache Management */}
      <div className="setting-group">
        <label>Caché</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            className="btn-primary"
            onClick={cacheAllStories}
            disabled={busy || compression.busy}
          >
            Descargar todas las historias
          </button>
          <button
            className="btn-primary"
            onClick={openCompress}
            disabled={busy || compression.busy || downloadBusy}
          >
            Comprimir recursos
          </button>
          <button className="btn-danger" onClick={clearAllCache} disabled={busy || compression.busy}>
            Eliminar toda la caché
          </button>
        </div>
        <div className="cache-info" style={{ marginTop: "12px" }}>
          {cacheStatus ? (
            <>
              <div>Historias en caché: {cacheStatus.cached_stories.length}</div>
              <div>Tamaño total: {formatBytes(cacheStatus.total_size_bytes)}</div>
            </>
          ) : (
            <div>Leyendo estado de la caché...</div>
          )}
          {compression.tier !== "off" && (
            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>
                Compresión automática activa ({TIER_LABELS[compression.tier as Tier] ?? compression.tier}). Las imágenes nuevas se comprimirán automáticamente.
              </span>
              {!compression.busy && (
                <button
                  className="nav-btn"
                  style={{ fontSize: "12px" }}
                  onClick={() => compression.disableRealtime()}
                >
                  Desactivar compresión automática
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compression tier dialog */}
      {showCompress && (
        <div className="dl-result-overlay" onClick={() => setShowCompress(false)}>
          <div className="dl-result" onClick={(e) => e.stopPropagation()}>
            <div className="dl-result-msg">Comprimir imágenes en caché</div>
            <div className="dl-result-sub" style={{ marginBottom: "10px" }}>
              Convertir las imágenes a WebP puede reducir mucho el espacio ocupado. Elige un nivel para comenzar. Durante la compresión no se podrán descargar nuevos recursos.
              {compression.tier !== "off" && " (Los archivos ya comprimidos no se procesarán de nuevo salvo que elijas un nivel más agresivo.)"}
            </div>
            <div className="cache-info" style={{ marginBottom: "10px" }}>
              Caché actual: {compressEst ? formatBytes(compressEst.totalBytes) : "Calculando…"}
              {compressEst && ` (imágenes: ${formatBytes(compressEst.imageBytes)})`}
            </div>
            {(["lossless", "q90", "q70"] as Tier[]).map((t) => {
              const est = compressEst
                ? t === "lossless"
                  ? compressEst.losslessBytes
                  : t === "q90"
                    ? compressEst.q90Bytes
                    : compressEst.q70Bytes
                : 0;
              const desc =
                t === "lossless"
                  ? "Sin pérdida · calidad original · ~50% menos"
                  : t === "q90"
                    ? "Alta calidad · diferencia imperceptible (SSIM≥0.99) · ~79% menos"
                    : "Máxima compresión · tamaño mínimo · ~89% menos";
              return (
                <label
                  key={t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: selectedTier === t ? "rgba(244,196,48,0.15)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="compress-tier"
                    checked={selectedTier === t}
                    onChange={() => setSelectedTier(t)}
                  />
                  <span style={{ flex: "1 1 auto" }}>
                    <div style={{ fontWeight: 600 }}>{TIER_LABELS[t]}</div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>{desc}</div>
                  </span>
                  <span style={{ flex: "0 0 auto", textAlign: "right" }}>
                    {compressEst ? `≈ ${formatBytes(est)}` : "—"}
                  </span>
                </label>
              );
            })}
            <div className="dl-result-actions" style={{ marginTop: "10px" }}>
              <button className="btn-primary" onClick={confirmCompress} disabled={!selectedTier}>
                Comenzar
              </button>
              <button className="nav-btn" onClick={() => setShowCompress(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About */}
      <div className="setting-group">
        <label>Acerca de</label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={() => navigate("/about")}>
            Acerca de Rhodes Archive
          </button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Versión, aviso legal, licencias y enlaces del proyecto.
          </span>
        </div>
      </div>

      {/* Environment / diagnostics */}
      <div className="setting-group">
        <label>Información del sistema</label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={copyEnvInfo}>
            Copiar información
          </button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Incluye versiones de la aplicación, sistema y WebView para facilitar el diagnóstico.
          </span>
        </div>
        {envInfo && (
          <pre
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "var(--bg-tertiary)",
              borderRadius: "6px",
              fontSize: "12px",
              lineHeight: "1.5",
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {envInfo}
          </pre>
        )}
      </div>

      {message && (
        <div
          style={{
            padding: "12px",
            background: "var(--bg-tertiary)",
            borderRadius: "4px",
            marginTop: "16px",
            color: message.startsWith("Error") ? "var(--error)" : "var(--success)",
          }}
        >
          {message}
        </div>
      )}
      </div>
    </div>
  );
}
