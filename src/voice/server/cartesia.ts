/** Server-only Cartesia helpers (reads CARTESIA_API_KEY). Imported only by route handlers. */
export const CARTESIA_VERSION = "2026-08-14";
export const TOKEN_TTL_S = 3600;

export function cartesiaKeyPresent(): boolean {
  return Boolean(process.env.CARTESIA_API_KEY?.trim());
}

/**
 * Mint a short-lived access token. Verified against docs.cartesia.ai (2026-10-24):
 * POST https://api.cartesia.ai/access-token, headers Authorization: Bearer <key> + Cartesia-Version,
 * body { grants: { stt, tts }, expires_in (max 3600) }, response { token }.
 */
export async function mintAccessToken(): Promise<{ token: string; expiresAt: number }> {
  const t0 = Date.now();
  const res = await fetch("https://api.cartesia.ai/access-token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CARTESIA_API_KEY}`,
      "Cartesia-Version": CARTESIA_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grants: { stt: true, tts: true }, expires_in: TOKEN_TTL_S }),
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Cartesia access-token ${res.status}: ${text.slice(0, 200)}`), { status: res.status });
  }
  const data = (await res.json()) as { token?: unknown };
  if (typeof data.token !== "string" || !data.token) throw new Error("Cartesia access-token response had no token");
  // The response carries no expiry; track it ourselves (minus a small safety margin).
  return { token: data.token, expiresAt: t0 + TOKEN_TTL_S * 1000 - 30_000 };
}
