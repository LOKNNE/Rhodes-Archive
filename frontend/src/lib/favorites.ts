const KEY = "rhodes_archive_favorites_v1";

export function getFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(values: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...values]));
  } catch {
    // Ignore storage failures; favorites are a convenience feature.
  }
}

export function toggleFavorite(key: string): Set<string> {
  const next = getFavorites();
  if (next.has(key)) next.delete(key);
  else next.add(key);
  saveFavorites(next);
  return next;
}
