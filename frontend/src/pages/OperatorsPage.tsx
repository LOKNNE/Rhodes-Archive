import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSyncedJSON } from "../lib/cloudSync";

type Operator = { id: string; name: string; favorite: boolean; owned: boolean };
const KEY = "rhodes-operators-manual";

function loadItems(): Operator[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as Operator[]; } catch { return []; } }
function save(items: Operator[]) { setSyncedJSON(KEY, items); }

export default function OperatorsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Operator[]>(loadItems);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const refresh = () => setItems(loadItems());
    window.addEventListener("rhodes-cloud-hydrated", refresh);
    return () => window.removeEventListener("rhodes-cloud-hydrated", refresh);
  }, []);

  const filtered = useMemo(() => items.filter((x) => x.name.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const add = () => {
    const n = name.trim(); if (!n) return;
    const next = [...items, { id: crypto.randomUUID(), name: n, favorite: false, owned: true }];
    setItems(next); save(next); setName("");
  };
  const patch = (id: string, changes: Partial<Operator>) => {
    const next = items.map((x) => x.id === id ? { ...x, ...changes } : x); setItems(next); save(next);
  };
  const remove = (id: string) => { const next = items.filter((x) => x.id !== id); setItems(next); save(next); };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div><h1 style={s.title}>Operadores</h1><div style={s.subtitle}>Base inicial de tu roster. Se sincroniza con Rhodes Cloud cuando tienes una cuenta conectada.</div></div>
      </div>

      <div style={s.toolbar}>
        <input style={s.input} placeholder="Añadir operador manualmente" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button style={s.primary} onClick={add}>Añadir</button>
        <input style={s.input} placeholder="Buscar en mi roster..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={s.stats}>{items.length} operadores · {items.filter((x) => x.favorite).length} favoritos</div>
      <div style={s.list}>
        {filtered.length === 0 ? <div style={s.empty}>Añade tus primeros operadores para empezar a preparar My Rhodes.</div> : filtered.map((item) => (
          <div key={item.id} style={s.card}>
            <button style={s.star} onClick={() => patch(item.id, { favorite: !item.favorite })}>{item.favorite ? "★" : "☆"}</button>
            <div style={s.name}>{item.name}</div>
            <label style={s.owned}><input type="checkbox" checked={item.owned} onChange={(e) => patch(item.id, { owned: e.target.checked })} /> En mi cuenta</label>
            <button style={s.delete} onClick={() => remove(item.id)}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#101010", color: "#f5f5f5", padding: "28px", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", gap: "14px", alignItems: "center", marginBottom: "20px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#191919", color: "#fff", cursor: "pointer", fontSize: "20px" },
  title: { margin: 0 }, subtitle: { color: "#999", marginTop: "4px" },
  toolbar: { display: "grid", gridTemplateColumns: "2fr auto 2fr", gap: "8px", marginBottom: "12px" },
  input: { background: "#171717", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "10px" },
  primary: { border: 0, borderRadius: "8px", padding: "10px 14px", background: "#f4c430", color: "#111", fontWeight: 750, cursor: "pointer" },
  stats: { color: "#888", fontSize: "12px", marginBottom: "12px" },
  list: { display: "grid", gap: "8px" },
  card: { display: "flex", alignItems: "center", gap: "10px", background: "#171717", border: "1px solid #2d2d2d", borderRadius: "10px", padding: "11px 13px" },
  star: { background: "transparent", border: 0, color: "#f4c430", fontSize: "22px", cursor: "pointer" },
  name: { flex: 1, fontWeight: 700 }, owned: { color: "#aaa", fontSize: "12px" },
  delete: { background: "transparent", border: "1px solid #333", color: "#888", borderRadius: "7px", padding: "6px 8px", cursor: "pointer" },
  empty: { color: "#777", padding: "24px", border: "1px dashed #333", borderRadius: "10px", textAlign: "center" },
};
