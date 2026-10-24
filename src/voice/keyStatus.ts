/** Status-bar key probe: GET /api/cartesia-token and /api/command + navigator.onLine. */
import { KeyProbeSchema } from "./apiTypes";

export interface KeyStatus {
  /** CARTESIA_API_KEY is configured on the server (Ink 2 + Sonic usable). */
  cartesia: boolean;
  /** ANTHROPIC_API_KEY is configured on the server (Claude routes not mocked). */
  anthropic: boolean;
  /** navigator.onLine (false = grammar + typed box only). */
  online: boolean;
}

async function probe(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const body = KeyProbeSchema.safeParse(await res.json());
    return body.success && body.data.keyPresent;
  } catch {
    return false;
  }
}

export async function probeKeys(): Promise<KeyStatus> {
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  const [cartesia, anthropic] = await Promise.all([probe("/api/cartesia-token"), probe("/api/command")]);
  return { cartesia, anthropic, online };
}

/** Status-bar text for missing keys / offline, or null when everything is available. */
export function keyStatusMessage(s: KeyStatus): string | null {
  if (!s.online) return "Offline: voice and AI cleanup are off. Tiles, keys and the typed box still work.";
  const missing = [!s.cartesia && "Cartesia", !s.anthropic && "Anthropic"].filter(Boolean);
  if (!missing.length) return null;
  return `${missing.join(" and ")} key missing: using ${!s.cartesia ? "browser speech" : ""}${!s.cartesia && !s.anthropic ? " and " : ""}${!s.anthropic ? "mock AI" : ""}.`;
}
