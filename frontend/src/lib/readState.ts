import { setSyncedItem, setSyncedJSON } from "./cloudSync";

// Tracks which stories the user has opened in the player ("read"), so the
// bookshelf can distinguish read vs unread chapters. Persisted in localStorage.
const KEY = "arkstage-read-stories";

export function getReadStories(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markRead(pageTitle: string): void {
  try {
    const s = getReadStories();
    if (s.has(pageTitle)) return;
    s.add(pageTitle);
    setSyncedJSON(KEY, [...s]);
  } catch {
    /* storage unavailable — read state is best-effort */
  }
}

const LAST_KEY = "arkstage-last-watched";
const RECENTS_KEY = "arkstage-recent-stories";
const MAX_RECENTS = 6;

export function getLastWatched(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function getRecentStories(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export function setLastWatched(pageTitle: string): void {
  try {
    setSyncedItem(LAST_KEY, pageTitle);
    const recent = getRecentStories().filter((title) => title !== pageTitle);
    recent.unshift(pageTitle);
    setSyncedJSON(RECENTS_KEY, recent.slice(0, MAX_RECENTS));
  } catch {
    /* best-effort */
  }
}
