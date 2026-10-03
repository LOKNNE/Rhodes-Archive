import { useNavigate } from "react-router-dom";
import { cloudConfigured, getCloudSession } from "../lib/cloudSync";

const sections = [
  { icon: "📖", title: "Historias", text: "Biblioteca, traducciones, favoritos y progreso.", path: "/browse", ready: true },
  { icon: "👤", title: "Operadores", text: "Prepara tu roster y favoritos mientras integramos el catálogo completo.", path: "/operators", ready: true },
  { icon: "📅", title: "Banners", text: "Guarda próximos objetivos, fechas y servidor.", path: "/banners", ready: true },
  { icon: "🧮", title: "Planner", text: "Calculadora de pulls y planificación rápida.", path: "/planner", ready: true },
  { icon: "🏝️", title: "My Rhodes", text: "Tu perfil y tarjeta compartible.", path: "/my-rhodes", ready: true },
  { icon: "☁️", title: "Cloud Sync", text: "Conecta la app y la web con la misma cuenta.", path: "/cloud-sync", ready: true },
  { icon: "🛠️", title: "Herramientas", text: "Recruitment, materiales y más utilidades próximamente.", path: "", ready: false },
];

export default function CompanionHubPage() {
  const navigate = useNavigate();
  const session = getCloudSession();
  const syncText = !cloudConfigured() ? "Preparado · falta configurar servidor" : session ? `Sincronizado · ${session.user.email || "cuenta conectada"}` : "Disponible · inicia sesión";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div>
          <h1 style={s.title}>Rhodes Hub</h1>
          <div style={s.subtitle}>Tu centro de historias, operadores, banners y herramientas de Arknights.</div>
          <button style={s.syncStatus} onClick={() => navigate("/cloud-sync")}>☁ {syncText}</button>
        </div>
      </div>

      <div style={s.grid}>
        {sections.map((item) => (
          <button
            key={item.title}
            style={{ ...s.card, opacity: item.ready ? 1 : 0.55 }}
            onClick={() => item.ready && item.path && navigate(item.path)}
            disabled={!item.ready}
          >
            <div style={s.icon}>{item.icon}</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>{item.title}</div>
              <div style={s.cardText}>{item.text}</div>
            </div>
            <div style={s.badge}>{item.ready ? "Abrir" : "Próximamente"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#101010", color: "#f5f5f5", padding: "28px", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", gap: "14px", alignItems: "center", marginBottom: "24px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#191919", color: "#fff", cursor: "pointer", fontSize: "20px" },
  title: { margin: 0, fontSize: "30px" },
  subtitle: { color: "#999", marginTop: "4px" },
  syncStatus: { marginTop: "9px", border: "1px solid #343434", background: "#171717", color: "#b8b8b8", borderRadius: "999px", padding: "6px 10px", cursor: "pointer", fontSize: "11px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "14px" },
  card: { minHeight: "145px", display: "flex", alignItems: "center", gap: "14px", textAlign: "left", padding: "18px", borderRadius: "14px", border: "1px solid #2d2d2d", background: "#171717", color: "#fff", cursor: "pointer" },
  icon: { width: "48px", height: "48px", borderRadius: "12px", display: "grid", placeItems: "center", background: "#222", fontSize: "25px", flexShrink: 0 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: "18px", fontWeight: 750, marginBottom: "6px" },
  cardText: { color: "#999", fontSize: "13px", lineHeight: 1.45 },
  badge: { color: "#f4c430", fontSize: "12px", fontWeight: 700 },
};
