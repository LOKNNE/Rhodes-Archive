const SESSION_KEY = "rhodes-cloud-session-v1";

export const SYNC_KEYS = [
  "rhodes-operators-manual",
  "rhodes-banner-targets",
  "rhodes-my-profile",
  "rhodes-planner-v1",
  "rhodes_archive_favorites_v1",
  "arkstage-read-stories",
  "arkstage-last-watched",
  "arkstage-recent-stories",
] as const;

type SupabaseUser = { id: string; email?: string };
type CloudSession = {
  access_token: string;
  refresh_token?: string;
  user: SupabaseUser;
};

type AuthResponse = CloudSession & { error?: string; msg?: string };

const DEFAULT_SUPABASE_URL = "https://kdvubzitbaynuhrktlek.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_chmDIGAu8n1_zCXDE8xd-A_mu86u_vh";

const supabaseUrl = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export function cloudConfigured() {
  return Boolean(supabaseUrl && anonKey);
}

export function getCloudSession(): CloudSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as CloudSession | null;
  } catch {
    return null;
  }
}

function saveSession(session: CloudSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("rhodes-cloud-status"));
}

async function authRequest(path: string, body: Record<string, unknown>) {
  if (!cloudConfigured()) throw new Error("Cloud Sync todavía no está configurado.");
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as AuthResponse;
  if (!response.ok) throw new Error(data.msg || data.error || "No se pudo iniciar sesión.");
  return data;
}

export async function signInCloud(email: string, password: string) {
  const data = await authRequest("/auth/v1/token?grant_type=password", { email, password });
  if (!data.access_token || !data.user?.id) throw new Error("Respuesta de inicio de sesión incompleta.");
  saveSession(data);
  await hydrateFromCloud();
  return data;
}

export async function signUpCloud(email: string, password: string) {
  const data = await authRequest("/auth/v1/signup", { email, password });
  if (data.access_token && data.user?.id) {
    saveSession(data);
    await pushCloudSnapshot();
  }
  return data;
}

export function signOutCloud() {
  saveSession(null);
}

function authHeaders(session: CloudSession) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

function snapshotLocal(): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const key of SYNC_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) payload[key] = value;
  }
  return payload;
}

export async function pushCloudSnapshot() {
  const session = getCloudSession();
  if (!cloudConfigured() || !session) return false;
  const response = await fetch(`${supabaseUrl}/rest/v1/user_state?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...authHeaders(session),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      payload: snapshotLocal(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Error al subir datos (${response.status}).`);
  window.dispatchEvent(new Event("rhodes-cloud-status"));
  return true;
}

export async function hydrateFromCloud() {
  const session = getCloudSession();
  if (!cloudConfigured() || !session) return false;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_state?select=payload&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    { headers: authHeaders(session) },
  );
  if (!response.ok) throw new Error(`Error al descargar datos (${response.status}).`);
  const rows = (await response.json()) as Array<{ payload?: Record<string, string> }>;
  if (rows.length === 0) {
    await pushCloudSnapshot();
    return true;
  }
  const payload = rows[0]?.payload || {};
  for (const key of SYNC_KEYS) {
    const value = payload[key];
    if (typeof value === "string") localStorage.setItem(key, value);
  }
  window.dispatchEvent(new Event("rhodes-cloud-hydrated"));
  return true;
}

let pushTimer: number | undefined;
export function scheduleCloudPush() {
  if (!cloudConfigured() || !getCloudSession()) return;
  if (pushTimer !== undefined) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = undefined;
    void pushCloudSnapshot().catch((error) => console.warn("Rhodes Cloud Sync:", error));
  }, 450);
}

export function setSyncedItem(key: string, value: string) {
  localStorage.setItem(key, value);
  scheduleCloudPush();
}

export function setSyncedJSON(key: string, value: unknown) {
  setSyncedItem(key, JSON.stringify(value));
}
