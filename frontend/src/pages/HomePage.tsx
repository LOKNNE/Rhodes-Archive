import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdate, type UpdateInfo } from "../lib/version";
import { openExternal } from "../lib/external";

export default function HomePage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    checkForUpdate()
      .then((u) => {
        if (u?.hasUpdate) setUpdate(u);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="home-page">
      <img className="home-logo" src="/logo.png" alt="Rhodes Archive" />
      <h1 className="home-title">Rhodes Archive</h1>
      <p className="home-tagline">Archivo fan de historias de Arknights</p>

      <button className="home-help" onClick={() => navigate("/help")}>
        Ayuda
      </button>

      <div className="home-actions">
        <button className="btn-primary" onClick={() => navigate("/browse")}>
          Historias
        </button>
        <button className="nav-btn" onClick={() => navigate("/translations")}>
          Traducciones
        </button>
        <button className="nav-btn" onClick={() => navigate("/settings")}>
          Ajustes
        </button>
      </div>

      {update ? (
        <button
          className="home-version has-update"
          onClick={() => openExternal(update.url)}
          title={`Abrir ${update.channel === "jsd" ? "jsDelivr" : "GitHub"} para descargar v${update.latest}`}
        >
          v{version} · <span className="blink">Actualización v{update.latest} ›</span>
        </button>
      ) : (
        <span className="home-version">v{version || "…"}</span>
      )}
    </div>
  );
}
