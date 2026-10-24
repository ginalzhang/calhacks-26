/**
 * POST /api/cartesia-token: mint a short-lived Cartesia access token (STT + TTS grants).
 * GET  /api/cartesia-token: key probe. The browser never sees CARTESIA_API_KEY.
 */
import { connection } from "next/server";
import type { CartesiaTokenResponse } from "@/voice/apiTypes";
import { cartesiaKeyPresent, mintAccessToken } from "@/voice/server/cartesia";
import { apiError, json } from "@/voice/server/http";

export async function GET() {
  await connection();
  const keyPresent = cartesiaKeyPresent();
  return json({ keyPresent, mock: !keyPresent });
}

export async function POST() {
  if (!cartesiaKeyPresent()) {
    return json({ token: null, expiresAt: null, mock: true } satisfies CartesiaTokenResponse);
  }
  try {
    const { token, expiresAt } = await mintAccessToken();
    return json({ token, expiresAt, mock: false } satisfies CartesiaTokenResponse);
  } catch (err) {
    const status = (err as { status?: number }).status;
    console.warn(`[api/cartesia-token] ${(err as Error).message}`);
    if (status === 401 || status === 403) return apiError("key-missing", "Cartesia rejected the API key.", false, 503);
    if ((err as Error).name === "TimeoutError") return apiError("timeout", "Cartesia did not answer in 5 s.", false, 504);
    return apiError("upstream", "Could not mint a Cartesia token.", false, 502);
  }
}
