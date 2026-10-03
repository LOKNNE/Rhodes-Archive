import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSyncedJSON } from "../lib/cloudSync";

const KEY = "rhodes-planner-v1";
type PlannerState = { orundum: number; originite: number; tickets: number };
function loadPlanner(): PlannerState {
  try { return { orundum: 0, originite: 0, tickets: 0, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<PlannerState>) }; }
  catch { return { orundum: 0, originite: 0, tickets: 0 }; }
}

export default function PlannerPage() {
  const navigate = useNavigate();
  const initial = loadPlanner();
  const [orundum, setOrundum] = useState(initial.orundum);
  const [originite, setOriginite] = useState(initial.originite);
  const [tickets, setTickets] = useState(initial.tickets);

  useEffect(() => {
    const refresh = () => {
      const next = loadPlanner();
      setOrundum(next.orundum); setOriginite(next.originite); setTickets(next.tickets);
    };
    window.addEventListener("rhodes-cloud-hydrated", refresh);
    return () => window.removeEventListener("rhodes-cloud-hydrated", refresh);
  }, []);

  const save = (next: PlannerState) => setSyncedJSON(KEY, next);
  const changeOrundum = (value: number) => { setOrundum(value); save({ orundum: value, originite, tickets }); };
  const changeOriginite = (value: number) => { setOriginite(value); save({ orundum, originite: value, tickets }); };
  const changeTickets = (value: number) => { setTickets(value); save({ orundum, originite, tickets: value }); };

  const result = useMemo(() => {
    const fromOrundum = Math.floor(Math.max(0, orundum) / 600);
    const fromOriginite = Math.floor(Math.max(0, originite) * 180 / 600);
    return { fromOrundum, fromOriginite, total: fromOrundum + fromOriginite + Math.max(0, tickets) };
  }, [orundum, originite, tickets]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div>
          <h1 style={s.title}>Planner</h1>
          <div style={s.subtitle}>Calculadora rápida de pulls, guardada y sincronizable.</div>
        </div>
      </div>

      <div style={s.card}>
        <label style={s.label}>Orundum</label>
        <input style={s.input} type="number" min={0} value={orundum} onChange={(e) => changeOrundum(Number(e.target.value))} />
        <label style={s.label}>Originite Prime</label>
        <input style={s.input} type="number" min={0} value={originite} onChange={(e) => changeOriginite(Number(e.target.value))} />
        <label style={s.label}>Tickets de Headhunting</label>
        <input style={s.input} type="number" min={0} value={tickets} onChange={(e) => changeTickets(Number(e.target.value))} />
      </div>

      <div style={s.result}>
        <div style={s.resultLabel}>Pulls disponibles</div>
        <div style={s.resultNumber}>{result.total}</div>
        <div style={s.breakdown}>{result.fromOrundum} por Orundum · {result.fromOriginite} por Originite · {Math.max(0, tickets)} por tickets</div>
      </div>

      <div style={s.future}>Próximamente: materiales para E2/M3/módulos, objetivos y rutas de farmeo.</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#101010", color: "#f5f5f5", padding: "28px", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", gap: "14px", alignItems: "center", marginBottom: "24px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#191919", color: "#fff", cursor: "pointer", fontSize: "20px" },
  title: { margin: 0 }, subtitle: { color: "#999", marginTop: "4px" },
  card: { maxWidth: "620px", display: "grid", gap: "8px", background: "#171717", border: "1px solid #2d2d2d", borderRadius: "14px", padding: "18px" },
  label: { color: "#aaa", fontSize: "12px", marginTop: "5px" },
  input: { background: "#0d0d0d", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "11px 12px", fontSize: "15px" },
  result: { maxWidth: "620px", marginTop: "14px", padding: "22px", borderRadius: "14px", border: "1px solid #6b5a18", background: "#1b190f", textAlign: "center" },
  resultLabel: { color: "#c7b86b", textTransform: "uppercase", fontSize: "12px", fontWeight: 700 },
  resultNumber: { fontSize: "54px", fontWeight: 850, color: "#f4c430", margin: "4px 0" },
  breakdown: { color: "#999", fontSize: "12px" },
  future: { maxWidth: "620px", color: "#777", fontSize: "13px", marginTop: "16px" },
};
