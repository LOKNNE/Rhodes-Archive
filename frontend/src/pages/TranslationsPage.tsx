import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getTranslationsFolder,
  importTranslation,
  listTranslations,
  openTranslationsFolder,
  type TranslationFileInfo,
} from "../lib/translationsFolder";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TranslationsPage() {
  const navigate = useNavigate();
  const [folder, setFolder] = useState("");
  const [items, setItems] = useState<TranslationFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [path, files] = await Promise.all([
        getTranslationsFolder(),
        listTranslations(),
      ]);
      setFolder(path);
      setItems(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Traducción Rhodes Archive", extensions: ["txt"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const filename = await importTranslation(selected);
      setNotice(`Importada: ${filename}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div>
          <h1 style={s.title}>Traducciones</h1>
          <div style={s.subtitle}>Rhodes Archive detecta automáticamente los .txt de esta carpeta.</div>
        </div>
      </div>

      <div style={s.toolbar}>
        <button style={s.primary} onClick={() => void handleImport()}>Importar .txt</button>
        <button style={s.secondary} onClick={() => void openTranslationsFolder()}>Abrir carpeta</button>
        <button style={s.secondary} onClick={() => void refresh()}>Actualizar lista</button>
      </div>

      <div style={s.box}>
        <div style={s.label}>Carpeta</div>
        <code style={s.path}>{folder || "Cargando..."}</code>
      </div>

      <div style={s.help}>
        Cada .txt debe empezar por:
        <code style={s.example}>#ARKSTAGE_TITLE=SR-1_月出/BEG</code>
        Para indicar idioma puedes añadir justo debajo, por ejemplo:
        <code style={s.example}>#LANG=es</code>
        Si no hay #LANG, Rhodes Archive considera español para mantener compatibilidad con los archivos actuales. Los nombres de personaje se detectan automáticamente desde las líneas del guion.
      </div>

      {notice && <div style={s.notice}>{notice}</div>}
      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}>Leyendo traducciones...</div>
      ) : items.length === 0 ? (
        <div style={s.empty}>No hay traducciones válidas todavía.</div>
      ) : (
        <div style={s.list}>
          {items.map((item) => (
            <div key={`${item.page_title}-${item.filename}`} style={s.card}>
              <div style={s.cardMain}>
                <div style={s.ok}>✓</div>
                <div>
                  <div style={s.pageTitle}>{item.page_title}</div>
                  <div style={s.filename}>
                    {item.filename} · {item.language.toUpperCase()} · {item.characters.length} personajes
                  </div>
                </div>
              </div>
              <div style={s.actions}>
                <span style={s.size}>{formatBytes(item.bytes)}</span>
                <button
                  style={s.openStory}
                  onClick={() => navigate(`/play/${encodeURIComponent(item.page_title)}`)}
                >
                  Abrir capítulo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#111", color: "#f5f5f5", padding: "28px", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "22px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#1b1b1b", color: "#fff", cursor: "pointer", fontSize: "21px" },
  title: { margin: 0, fontSize: "28px" },
  subtitle: { color: "#999", marginTop: "4px", fontSize: "14px" },
  toolbar: { display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" },
  primary: { border: 0, borderRadius: "8px", padding: "10px 16px", background: "#f4c430", color: "#111", fontWeight: 700, cursor: "pointer" },
  secondary: { border: "1px solid #3a3a3a", borderRadius: "8px", padding: "10px 16px", background: "#1b1b1b", color: "#eee", cursor: "pointer" },
  box: { background: "#171717", border: "1px solid #292929", borderRadius: "10px", padding: "13px 15px", marginBottom: "12px" },
  label: { fontSize: "11px", color: "#888", textTransform: "uppercase", marginBottom: "5px" },
  path: { color: "#ddd", overflowWrap: "anywhere" },
  help: { background: "#171717", border: "1px solid #292929", borderRadius: "10px", padding: "13px 15px", color: "#aaa", lineHeight: 1.5, marginBottom: "18px" },
  example: { display: "block", marginTop: "8px", color: "#f4c430", background: "#0c0c0c", padding: "8px 10px", borderRadius: "6px" },
  notice: { padding: "12px", borderRadius: "8px", background: "#17351f", border: "1px solid #2c6d3b", marginBottom: "14px", color: "#9ee9ae" },
  error: { padding: "12px", borderRadius: "8px", background: "#3a1717", border: "1px solid #6b2525", marginBottom: "14px" },
  empty: { padding: "28px", textAlign: "center", color: "#777", border: "1px dashed #333", borderRadius: "10px" },
  list: { display: "flex", flexDirection: "column", gap: "9px" },
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", background: "#171717", border: "1px solid #292929", borderRadius: "10px", padding: "13px 15px" },
  cardMain: { display: "flex", alignItems: "center", gap: "11px" },
  ok: { width: "26px", height: "26px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#1e4129", color: "#7ee39b" },
  pageTitle: { fontSize: "15px", fontWeight: 650 },
  filename: { fontSize: "12px", color: "#888", marginTop: "3px" },
  actions: { display: "flex", alignItems: "center", gap: "12px" },
  size: { color: "#777", fontSize: "12px" },
  openStory: { border: "1px solid #3a3a3a", borderRadius: "7px", padding: "7px 10px", background: "#202020", color: "#eee", cursor: "pointer" },
};
