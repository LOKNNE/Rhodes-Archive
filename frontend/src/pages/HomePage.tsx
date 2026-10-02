import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdate, type UpdateInfo } from "../lib/version";
import { openExternal } from "../lib/external";
import { getLastWatched, getRecentStories } from "../lib/readState";

export default function HomePage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [lastWatched, setLastWatchedState] = useState<string | null>(() => getLastWatched());
  const [recentStories, setRecentStories] = useState<string[]>(() => getRecentStories());

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    checkForUpdate()
      .then((u) => {
        if (u?.hasUpdate) setUpdate(u);
      })
      .catch(() => {});

    const refreshHistory = () => {
      setLastWatchedState(getLastWatched());
      setRecentStories(getRecentStories());
    };
    window.addEventListener("focus", refreshHistory);
    return () => window.removeEventListener("focus", refreshHistory);
  }, []);

  const play = (pageTitle: string) => navigate(`/play/${encodeURIComponent(pageTitle)}`);

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

      {lastWatched && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Continuar viendo</div>
          <button style={styles.continueCard} onClick={() => play(lastWatched)}>
            <span style={styles.continueIcon}>▶</span>
            <span style={styles.continueText}>
              <strong style={styles.continueLabel}>{lastWatched}</strong>
              <span style={styles.continueSub}>Volver a la última historia abierta</span>
            </span>
            <span style={styles.arrow}>›</span>
          </button>
        </section>
      )}

      {recentStories.length > 1 && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Recientes</div>
          <div style={styles.recentList}>
            {recentStories.slice(1, 5).map((title) => (
              <button key={title} style={styles.recentCard} onClick={() => play(title)}>
                <span style={styles.recentDot}>•</span>
                <span style={styles.recentTitle}>{title}</span>
                <span style={styles.recentArrow}>›</span>
              </button>
            ))}
          </div>
        </section>
      )}

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

const styles: Record<string, React.CSSProperties> = {
  section: {
    width: "min(640px, calc(100vw - 40px))",
    marginTop: "18px",
  },
  sectionTitle: {
    color: "#b7b7b7",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "8px",
  },
  continueCard: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #3b3b3b",
    background: "#171717",
    color: "#fff",
    cursor: "pointer",
  },
  continueIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "#f4c430",
    color: "#111",
    fontSize: "14px",
    flexShrink: 0,
  },
  continueText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    flex: 1,
  },
  continueLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "15px",
  },
  continueSub: {
    color: "#8d8d8d",
    fontSize: "12px",
  },
  arrow: {
    color: "#777",
    fontSize: "25px",
  },
  recentList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  recentCard: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "9px",
    border: "1px solid #2e2e2e",
    background: "#151515",
    color: "#ddd",
    cursor: "pointer",
    textAlign: "left",
  },
  recentDot: {
    color: "#f4c430",
    fontSize: "18px",
    lineHeight: 1,
  },
  recentTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    fontSize: "13px",
  },
  recentArrow: {
    color: "#666",
    fontSize: "18px",
  },
};
