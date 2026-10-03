import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSyncedJSON } from "../lib/cloudSync";

type Profile = { doctor: string; level: string; favorite: string; nextTarget: string };
const KEY = "rhodes-my-profile";
const OPS_KEY = "rhodes-operators-manual";

function loadProfile(): Profile {
  try { return { doctor: "", level: "", favorite: "", nextTarget: "", ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Profile>) }; }
  catch { return { doctor: "", level: "", favorite: "", nextTarget: "" }; }
}
function operatorCount() {
  try { const items = JSON.parse(localStorage.getItem(OPS_KEY) || "[]") as Array<{ owned?: boolean }>; return items.filter((x) => x.owned !== false).length; }
  catch { return 0; }
}

export default function MyRhodesPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [count, setCount] = useState(() => operatorCount());

  useEffect(() => {
    const refresh = () => { setProfile(loadProfile()); setCount(operatorCount()); };
    window.addEventListener("rhodes-cloud-hydrated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rhodes-cloud-hydrated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const operatorLabel = useMemo(() => count === 1 ? "OPERATOR" : "OPERATORS", [count]);

  const set = (key: keyof Profile, value: string) => {
    const next = { ...profile, [key]: value };
    setProfile(next); setSyncedJSON(KEY, next);
  };

  const exportCard = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 675;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#101010"; ctx.fillRect(0,0,1200,675);
    ctx.fillStyle = "#f4c430"; ctx.fillRect(0,0,18,675);
    ctx.fillStyle = "#f5f5f5"; ctx.font = "700 56px system-ui"; ctx.fillText("MY RHODES", 70, 95);
    ctx.fillStyle = "#8f8f8f"; ctx.font = "24px system-ui"; ctx.fillText("Rhodes Archive profile", 72, 132);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 44px system-ui"; ctx.fillText(profile.doctor || "Doctor", 72, 220);
    ctx.fillStyle = "#aaaaaa"; ctx.font = "26px system-ui"; ctx.fillText(`Lv. ${profile.level || "—"}`, 72, 262);
    ctx.fillStyle = "#f4c430"; ctx.font = "700 82px system-ui"; ctx.fillText(String(count), 72, 380);
    ctx.fillStyle = "#999999"; ctx.font = "22px system-ui"; ctx.fillText(operatorLabel, 78, 415);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 28px system-ui"; ctx.fillText("Favourite", 470, 255);
    ctx.fillStyle = "#bcbcbc"; ctx.font = "26px system-ui"; ctx.fillText(profile.favorite || "—", 470, 295);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 28px system-ui"; ctx.fillText("Next target", 470, 385);
    ctx.fillStyle = "#bcbcbc"; ctx.font = "26px system-ui"; ctx.fillText(profile.nextTarget || "—", 470, 425);
    ctx.fillStyle = "#666666"; ctx.font = "20px system-ui"; ctx.fillText("Generated with Rhodes Archive", 72, 620);
    const a = document.createElement("a");
    a.download = "my-rhodes.png"; a.href = canvas.toDataURL("image/png"); a.click();
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div><h1 style={s.title}>My Rhodes</h1><div style={s.subtitle}>Tu perfil personal. Con Cloud Sync puedes tenerlo igual en la app y en la web.</div></div>
      </div>

      <div style={s.layout}>
        <div style={s.form}>
          <label style={s.label}>Nombre del Doctor</label><input style={s.input} value={profile.doctor} onChange={(e) => set("doctor", e.target.value)} placeholder="Doctor" />
          <label style={s.label}>Nivel</label><input style={s.input} value={profile.level} onChange={(e) => set("level", e.target.value)} placeholder="120" />
          <label style={s.label}>Operador favorito</label><input style={s.input} value={profile.favorite} onChange={(e) => set("favorite", e.target.value)} placeholder="Lappland" />
          <label style={s.label}>Próximo objetivo</label><input style={s.input} value={profile.nextTarget} onChange={(e) => set("nextTarget", e.target.value)} placeholder="Próximo operador/banner" />
        </div>

        <div style={s.card}>
          <div style={s.kicker}>MY RHODES</div>
          <div style={s.doctor}>{profile.doctor || "Doctor"}</div>
          <div style={s.level}>Lv. {profile.level || "—"}</div>
          <div style={s.metric}>{count}</div><div style={s.metricLabel}>{operatorLabel}</div>
          <div style={s.row}><span>Favourite</span><strong>{profile.favorite || "—"}</strong></div>
          <div style={s.row}><span>Next target</span><strong>{profile.nextTarget || "—"}</strong></div>
          <button style={s.primary} onClick={exportCard}>Exportar tarjeta PNG</button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#101010", color: "#f5f5f5", padding: "28px", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", gap: "14px", alignItems: "center", marginBottom: "22px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#191919", color: "#fff", cursor: "pointer", fontSize: "20px" },
  title: { margin: 0 }, subtitle: { color: "#999", marginTop: "4px" },
  layout: { display: "grid", gridTemplateColumns: "minmax(260px, 420px) minmax(320px, 1fr)", gap: "18px" },
  form: { display: "grid", gap: "8px", alignContent: "start", background: "#171717", border: "1px solid #2d2d2d", borderRadius: "14px", padding: "18px" },
  label: { color: "#999", fontSize: "12px", marginTop: "5px" }, input: { background: "#0f0f0f", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "10px" },
  card: { borderRadius: "18px", border: "1px solid #3a3a3a", background: "linear-gradient(135deg,#171717,#0c0c0c)", padding: "26px", minHeight: "350px" },
  kicker: { color: "#f4c430", fontWeight: 850, letterSpacing: "0.12em", fontSize: "13px" }, doctor: { fontSize: "34px", fontWeight: 850, marginTop: "14px" }, level: { color: "#999" },
  metric: { fontSize: "62px", fontWeight: 900, color: "#f4c430", marginTop: "20px" }, metricLabel: { color: "#888", fontSize: "12px", marginBottom: "18px" },
  row: { display: "flex", justifyContent: "space-between", gap: "16px", borderTop: "1px solid #292929", padding: "12px 0", color: "#aaa" },
  primary: { marginTop: "14px", border: 0, borderRadius: "8px", padding: "11px 14px", background: "#f4c430", color: "#111", fontWeight: 800, cursor: "pointer" },
};
