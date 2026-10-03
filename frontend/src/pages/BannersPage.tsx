import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSyncedJSON } from "../lib/cloudSync";

type BannerTarget = { id: string; name: string; date: string; server: "Global" | "CN"; note: string };
const KEY = "rhodes-banner-targets";

function loadTargets(): BannerTarget[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as BannerTarget[]; } catch { return []; }
}
function saveTargets(items: BannerTarget[]) { setSyncedJSON(KEY, items); }
function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`).getTime();
  const now = new Date();
  now.setHours(0,0,0,0);
  return Math.ceil((target - now.getTime()) / 86400000);
}

export default function BannersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<BannerTarget[]>(loadTargets);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [server, setServer] = useState<"Global" | "CN">("Global");
  const [note, setNote] = useState("");

  useEffect(() => {
    const refresh = () => setItems(loadTargets());
    window.addEventListener("rhodes-cloud-hydrated", refresh);
    return () => window.removeEventListener("rhodes-cloud-hydrated", refresh);
  }, []);

  const sorted = useMemo(() => [...items].sort((a,b) => (a.date || "9999").localeCompare(b.date || "9999")), [items]);
  const add = () => {
    if (!name.trim()) return;
    const next = [...items, { id: crypto.randomUUID(), name: name.trim(), date, server, note: note.trim() }];
    setItems(next); saveTargets(next); setName(""); setDate(""); setNote("");
  };
  const remove = (id: string) => { const next = items.filter((x) => x.id !== id); setItems(next); saveTargets(next); };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div><h1 style={s.title}>Banners</h1><div style={s.subtitle}>Guarda próximos objetivos, fechas y servidor. Con Cloud Sync aparecen igual en app y web.</div></div>
      </div>

      <div style={s.form}>
        <input style={s.input} placeholder="Operador o banner objetivo" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={s.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select style={s.input} value={server} onChange={(e) => setServer(e.target.value as "Global" | "CN")}><option>Global</option><option>CN</option></select>
        <input style={s.input} placeholder="Nota opcional" value={note} onChange={(e) => setNote(e.target.value)} />
        <button style={s.primary} onClick={add}>Añadir objetivo</button>
      </div>

      <div style={s.list}>
        {sorted.length === 0 ? <div style={s.empty}>Todavía no tienes banners guardados.</div> : sorted.map((item) => {
          const d = daysUntil(item.date);
          return <div key={item.id} style={s.card}>
            <div>
              <div style={s.name}>{item.name}</div>
              <div style={s.meta}>{item.server}{item.date ? ` · ${item.date}` : ""}{d !== null ? ` · ${d >= 0 ? `${d} días` : "fecha pasada"}` : ""}</div>
              {item.note && <div style={s.note}>{item.note}</div>}
            </div>
            <button style={s.delete} onClick={() => remove(item.id)}>Eliminar</button>
          </div>;
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#101010", color: "#f5f5f5", padding: "28px", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", gap: "14px", alignItems: "center", marginBottom: "20px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#191919", color: "#fff", cursor: "pointer", fontSize: "20px" },
  title: { margin: 0 }, subtitle: { color: "#999", marginTop: "4px" },
  form: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr auto", gap: "8px", marginBottom: "18px" },
  input: { minWidth: 0, background: "#171717", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "10px" },
  primary: { border: 0, borderRadius: "8px", padding: "10px 14px", background: "#f4c430", color: "#111", fontWeight: 750, cursor: "pointer" },
  list: { display: "grid", gap: "9px" },
  card: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", background: "#171717", border: "1px solid #2c2c2c", borderRadius: "12px", padding: "14px 16px" },
  name: { fontWeight: 750, fontSize: "16px" }, meta: { color: "#f4c430", fontSize: "12px", marginTop: "4px" }, note: { color: "#888", fontSize: "12px", marginTop: "4px" },
  delete: { background: "transparent", border: "1px solid #3b3b3b", color: "#aaa", borderRadius: "7px", padding: "7px 9px", cursor: "pointer" },
  empty: { color: "#777", padding: "24px", border: "1px dashed #333", borderRadius: "10px", textAlign: "center" },
};
