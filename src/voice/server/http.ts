/** Tiny JSON helpers shared by the route handlers (server-only by usage). */
import type { ApiError } from "../apiTypes";

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(error: ApiError["error"], message: string, mock: boolean, status: number): Response {
  return json({ error, message, mock } satisfies ApiError, status);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return undefined;
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
