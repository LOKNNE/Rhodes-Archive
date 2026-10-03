import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cloudConfigured,
  getCloudSession,
  hydrateFromCloud,
  pushCloudSnapshot,
  signInCloud,
  signOutCloud,
  signUpCloud,
} from "../lib/cloudSync";

export default function CloudSyncPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState(() => getCloudSession()?.user.email || "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = cloudConfigured();

  useEffect(() => {
    const refresh = () => setSessionEmail(getCloudSession()?.user.email || "");
    window.addEventListener("rhodes-cloud-status", refresh);
    return () => window.removeEventListener("rhodes-cloud-status", refresh);
  }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setStatus("");
    try { await fn(); setStatus(ok); setSessionEmail(getCloudSession()?.user.email || ""); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Ha ocurrido un error."); }
    finally { setBusy(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div>
          <h1 style={s.title}>Rhodes Cloud Sync</h1>
          <div style={s.subtitle}>Sincroniza My Rhodes, operadores, banners, planner, favoritos y progreso entre la app y la web.</div>
        </div>
      </div>

      {!configured ? (
        <div style={s.warning}>
          <strong>Cloud Sync preparado, pero falta conectar Supabase.</strong>
          <div style={s.small}>La interfaz y el sistema ya están instalados. Cuando añadamos las claves del proyecto, esta misma pantalla empezará a sincronizar.</div>
        </div>
      ) : sessionEmail ? (
        <div style={s.card}>
          <div style={s.kicker}>CONECTADO</div>
          <div style={s.email}>{sessionEmail}</div>
          <div style={s.actions}>
            <button style={s.primary} disabled={busy} onClick={() => run(hydrateFromCloud, "Datos descargados desde la nube.")}>Descargar cambios</button>
            <button style={s.button} disabled={busy} onClick={() => run(pushCloudSnapshot, "Datos subidos a la nube.")}>Subir ahora</button>
            <button style={s.button} onClick={() => { signOutCloud(); setSessionEmail(""); setStatus("Sesión cerrada."); }}>Cerrar sesión</button>
          </div>
          <div style={s.small}>Los cambios nuevos se suben automáticamente mientras tengas la sesión iniciada.</div>
        </div>
      ) : (
        <div style={s.card}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@example.com" />
          <label style={s.label}>Contraseña</label>
          <input style={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <div style={s.actions}>
            <button style={s.primary} disabled={busy || !email || !password} onClick={() => run(() => signInCloud(email, password), "Sesión iniciada y datos sincronizados.")}>Iniciar sesión</button>
            <button style={s.button} disabled={busy || !email || !password} onClick={() => run(() => signUpCloud(email, password), "Cuenta creada. Si Supabase pide confirmar el email, revisa tu correo.")}>Crear cuenta</button>
          </div>
        </div>
      )}

      {status && <div style={s.status}>{status}</div>}

      <div style={s.info}>
        <strong>Qué se sincroniza</strong>
        <div style={s.small}>Operadores manuales · banners guardados · My Rhodes · planner · favoritos · historias leídas · continuar viendo.</div>
        <strong style={{ marginTop: 12 }}>Qué sigue siendo local</strong>
        <div style={s.small}>Caché de historias, archivos .txt de traducción y archivos descargados del ordenador.</div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#101010", color: "#f5f5f5", padding: "28px", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", gap: "14px", alignItems: "center", marginBottom: "22px" },
  back: { width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #333", background: "#191919", color: "#fff", cursor: "pointer", fontSize: "20px" },
  title: { margin: 0 }, subtitle: { color: "#999", marginTop: "4px", maxWidth: "760px" },
  card: { maxWidth: "620px", display: "grid", gap: "9px", padding: "20px", background: "#171717", border: "1px solid #303030", borderRadius: "14px" },
  warning: { maxWidth: "620px", padding: "18px", borderRadius: "12px", background: "#211d0e", border: "1px solid #69591b", color: "#f4c430" },
  kicker: { color: "#71d28a", fontWeight: 850, fontSize: "12px", letterSpacing: "0.12em" }, email: { fontSize: "20px", fontWeight: 750 },
  label: { color: "#aaa", fontSize: "12px", marginTop: "4px" }, input: { background: "#0d0d0d", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "11px" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" },
  primary: { border: 0, borderRadius: "8px", padding: "10px 14px", background: "#f4c430", color: "#111", fontWeight: 800, cursor: "pointer" },
  button: { border: "1px solid #3b3b3b", borderRadius: "8px", padding: "10px 14px", background: "#202020", color: "#ddd", fontWeight: 700, cursor: "pointer" },
  small: { color: "#999", fontSize: "13px", lineHeight: 1.5, marginTop: "6px" }, status: { maxWidth: "620px", color: "#d7d7d7", marginTop: "12px" },
  info: { maxWidth: "620px", display: "grid", marginTop: "18px", padding: "16px", border: "1px solid #292929", borderRadius: "12px", background: "#141414" },
};
