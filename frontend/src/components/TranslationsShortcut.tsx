import { useLocation, useNavigate } from "react-router-dom";

export default function TranslationsShortcut() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname.startsWith("/play") || location.pathname === "/translations") return null;

  return (
    <button
      onClick={() => navigate("/translations")}
      style={{
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: 9000,
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: "10px",
        padding: "9px 13px",
        background: "rgba(20,20,20,0.92)",
        color: "#f3f3f3",
        cursor: "pointer",
        fontSize: "13px",
      }}
    >
      Traducciones
    </button>
  );
}
