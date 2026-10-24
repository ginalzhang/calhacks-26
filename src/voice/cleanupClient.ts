/**
 * Browser client for /api/cleanup ("turn my writing into text", "clean this up", "label this").
 * Results are validated with the shared zod schema and must be shown as a ghost overlay; call
 * resolveClaudeCall(result.logId, "accepted" | "rejected") from the overlay's Accept / Reject.
 */
import { ApiErrorSchema, CleanupResponseSchema, type CleanupRequest, type CleanupResponse } from "./apiTypes";
import { logClaudeCall, resolveClaudeCall } from "./claudeLog";

export {
  logClaudeCall,
  resolveClaudeCall,
  getClaudeStats,
  getClaudeLog,
  clearClaudeLog,
  CLAUDE_LOG_KEY,
  CLAUDE_LOG_EVENT,
  type ClaudeLogEntry,
  type ClaudeLogResult,
  type ClaudeStats,
} from "./claudeLog";

/** Client-side ceiling: server timeout (15 s) + upload/overhead. */
export const CLEANUP_CLIENT_TIMEOUT_MS = 20_000;

export type CleanupErrorCode = "timeout" | "invalid" | "key-missing" | "bad-request" | "upstream" | "offline";

export class CleanupError extends Error {
  constructor(
    public code: CleanupErrorCode,
    message: string,
    public logId: string,
    public latencyMs: number,
    public mock: boolean,
  ) {
    super(message);
    this.name = "CleanupError";
  }
}

const USER_MESSAGES: Record<CleanupErrorCode, string> = {
  timeout: "Claude took too long. Nothing was changed; try again.",
  invalid: "Claude's answer didn't make sense. Nothing was changed.",
  "key-missing": "AI cleanup needs an Anthropic key. Nothing was changed.",
  "bad-request": "That selection couldn't be sent. Nothing was changed.",
  upstream: "AI cleanup failed. Nothing was changed; try again.",
  offline: "You're offline: AI cleanup is unavailable. Drawing and the typed box still work.",
};

const MODE_LABEL: Record<CleanupRequest["mode"], string> = {
  handwriting: "writing → text",
  cleanup: "clean up",
  label: "label",
};

function summarize(r: CleanupResponse): string {
  if (r.mode === "handwriting") return `"${r.text.slice(0, 60)}" (${Math.round(r.confidence * 100)}%)`;
  if (r.mode === "cleanup") return `${r.shapes.length} shapes replacing ${r.replaces.length} strokes`;
  return r.labels.map((l) => l.text).join(", ");
}

/**
 * POST the selection to /api/cleanup. Resolves with the validated response plus `logId`
 * (entry left "pending" until the user Accepts / Rejects). Rejects with a CleanupError
 * whose `message` is ready to show in the status bar.
 */
export async function requestCleanup(req: CleanupRequest): Promise<CleanupResponse & { logId: string }> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = () => Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);
  const logId = logClaudeCall({ route: "cleanup", mode: req.mode, summary: `${MODE_LABEL[req.mode]}: ${req.strokes.length} strokes` });
  const fail = (code: CleanupErrorCode, mock: boolean, detail?: string): never => {
    resolveClaudeCall(logId, code === "timeout" ? "timeout" : "error", { latencyMs: elapsed(), summary: `${MODE_LABEL[req.mode]}: ${code}${detail ? ` (${detail})` : ""}` });
    throw new CleanupError(code, USER_MESSAGES[code], logId, elapsed(), mock);
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) fail("offline", false);

  let res: Response;
  try {
    res = await fetch("/api/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(CLEANUP_CLIENT_TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as { name?: string }).name;
    return fail(name === "TimeoutError" || name === "AbortError" ? "timeout" : "offline", false);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return fail("invalid", false, `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const e = ApiErrorSchema.safeParse(body);
    return fail(e.success ? e.data.error : "upstream", e.success ? e.data.mock : false, e.success ? e.data.message : `HTTP ${res.status}`);
  }
  const parsed = CleanupResponseSchema.safeParse(body);
  if (!parsed.success || parsed.data.mode !== req.mode) return fail("invalid", false, "schema");
  const ids = new Set(req.strokes.map((s) => s.id));
  const data = parsed.data;
  // Never let a result replace strokes that weren't in the selection.
  if ("replaces" in data) data.replaces = data.replaces.filter((id) => ids.has(id));
  resolveClaudeCall(logId, "pending", {
    latencyMs: data.latencyMs || elapsed(),
    summary: `${MODE_LABEL[req.mode]}${data.mock ? " (mock)" : ""}: ${summarize(data)}`,
  });
  return { ...data, logId };
}
