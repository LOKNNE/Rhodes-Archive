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
        filters: [{ name: "Traducción personalizada Rhodes Archive", extensions: ["txt"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const filename = await importTranslation(selected);
      setNotice(`Traducción personalizada importada: ${filename}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refresh]);

  const handleEdit = useCallback(async (filename: string) => {
    setError(null);
    setNotice(null);
    try {
      await openTranslationsFolder();
      setNotice(`Edita ${filename} con tu editor de texto y pulsa “Actualizar lista” al terminar.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div>
          <h1 style={s.title}>Traducciones personalizadas</h1>
          <div style={s.subtitle}>
            Importa y edita archivos .txt para corregir o reemplazar la traducción automática.
          </div>
        </div>
      </div>

      <div style={s.priorityBox}>
        <strong style={{ color: "#f4c430" }}>Prioridad de traducción</strong>
        <div style={{ marginTop: "6px" }}>
          Si existe una traducción personalizada compatible para un capítulo, Rhodes Archive la usa antes que la traducción automática.
          Si no existe, la aplicación puede usar la traducción automática disponible.
        </div>
      </div>

      <div style={s.toolbar}>
        <button style={s.primary} onClick={() => void handleImport()}>Importar .txt personalizado</button>
        <button style={s.secondary} onClick={() => void openTranslationsFolder()}>Abrir carpeta</button>
        <button style={s.secondary} onClick={() => void refresh()}>Actualizar lista</button>
      </div>

      <div style={s.box}>
        <div style={s.label}>Carpeta de traducciones personalizadas</div>
        <code style={s.path}>{folder || "Cargando..."}</code>
      </div>

      <div style={s.help}>
        Cada .txt personalizado debe empezar por:
        <code style={s.example}>#ARKSTAGE_TITLE=SR-1_月出/BEG</code>
        Para indicar idioma puedes añadir justo debajo, por ejemplo:
        <code style={s.example}>#LANG=es</code>
        También puedes usar <code>#LANG=en</code> para una traducción inglesa. Si no hay #LANG, Rhodes Archive considera español para mantener compatibilidad con los archivos actuales.
        <div style={{ marginTop: "10px" }}>
          Puedes modificar el texto y los nombres, pero evita cambiar comandos, identificadores o parámetros del guion: hacerlo puede romper la reproducción del capítulo.
        </div>
      </div>

      {notice && <div style={s.notice}>{notice}</div>}
      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}>Leyendo traducciones personalizadas...</div>
      ) : items.length === 0 ? (
        <div style={s.empty}>
          No hay traducciones personalizadas todavía. La traducción automática seguirá disponible cuando corresponda.
        </div>
      ) : (
        <div style={s.list}>
          {items.map((item) => (
            <div key={`${item.page_title}-${item.filename}`} style={s.card}>
              <div style={s.cardMain}>
                <div style={s.ok}>✓</div>
                <div>
                  <div style={s.pageTitle}>{item.page_title}</div>
                  <div style={s.filename}>
                    Personalizada · {item.filename} · {item.language.toUpperCase()} · {item.characters.length} personajes
                  </div>
                </div>
              </div>
              <div style={s.actions}>
                <span style={s.size}>{formatBytes(item.bytes)}</span>
                <button
                  style={s.edit}
                  onClick={() => void handleEdit(item.filename)}
                  title={`Editar ${item.filename}`}
                >
                  Editar .txt
                </button>
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
  header: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#1b1b1b", color: "#fff", cursor: "pointer", fontSize: "21px" },
  title: { margin: 0, fontSize: "28px" },
  subtitle: { color: "#999", marginTop: "4px", fontSize: "14px" },
  priorityBox: { background: "#18160d", border: "1px solid #51451a", borderRadius: "10px", padding: "13px 15px", color: "#d8d0aa", lineHeight: 1.5, marginBottom: "16px" },
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
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", background: "#171717", border: "1px solid #292929", borderRadius: "10px", padding: "13px 15px", flexWrap: "wrap" },
  cardMain: { display: "flex", alignItems: "center", gap: "11px", minWidth: 0 },
  ok: { width: "26px", height: "26px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#1e4129", color: "#7ee39b", flexShrink: 0 },
  pageTitle: { fontSize: "15px", fontWeight: 650 },
  filename: { fontSize: "12px", color: "#888", marginTop: "3px", overflowWrap: "anywhere" },
  actions: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  size: { color: "#777", fontSize: "12px" },
  edit: { border: "1px solid #665718", borderRadius: "7px", padding: "7px 10px", background: "#29230e", color: "#f4c430", cursor: "pointer" },
  openStory: { border: "1px solid #3a3a3a", borderRadius: "7px", padding: "7px 10px", background: "#202020", color: "#eee", cursor: "pointer" },
};
