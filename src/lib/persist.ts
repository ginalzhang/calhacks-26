/** Tiny typed localStorage helpers. Every read is defensive (bad JSON → fallback). */
export const KEYS = {
  setup: "steady.setup",
  doc: "steady.doc",
  prefs: "steady.prefs",
  profiles: "steady.profiles",
  seenIntro: "steady.seenIntro",
} as const;

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode: autosave is best effort.
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
