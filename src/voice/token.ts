/** Browser-side cache for the short-lived Cartesia access token minted by /api/cartesia-token. */
import { CartesiaTokenResponseSchema } from "./apiTypes";

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;
let lastMock: boolean | null = null;

/** Resolves to a valid token, or null when the key is missing / the route is unreachable. */
export function getCartesiaToken(): Promise<string | null> {
  if (cached && cached.expiresAt - Date.now() > 60_000) return Promise.resolve(cached.token);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/cartesia-token", { method: "POST", signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const body = CartesiaTokenResponseSchema.safeParse(await res.json());
      if (!body.success) return null;
      lastMock = body.data.mock;
      if (body.data.token === null) return null;
      cached = { token: body.data.token, expiresAt: body.data.expiresAt };
      return cached.token;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Drop the cached token (e.g. after the socket rejects it). */
export function invalidateCartesiaToken(): void {
  cached = null;
}

/** true when the last token request came back as a mock (key missing); null if never asked. */
export function cartesiaTokenWasMock(): boolean | null {
  return lastMock;
}
