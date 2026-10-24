/**
 * Command resolution for voice and the typed-command box (PROMPT.md §5):
 * (1) local grammar (exact, then fuzzy; exact-only while a dialog is open);
 * (2) if no match, POST the transcript text (never audio) + context to /api/command.
 * Dialog open -> no Claude call. Offline -> none/offline. Every outcome keeps `heard`
 * so the UI can say "Didn't catch that; I heard <transcript>" with the nearest tiles.
 */
import type { ActionId } from "@/actions";
import { matchCommand } from "@/pipeline/grammar";
import type { CommandContext, CommandResolution, GrammarOptions } from "@/pipeline/types";
import { CommandResponseSchema, type CommandRequest } from "./apiTypes";
import { logClaudeCall } from "./claudeLog";

/** Client-side ceiling for /api/command (server Claude timeout is 2.5 s). */
export const COMMAND_CLIENT_TIMEOUT_MS = 4000;

export async function resolveCommand(
  text: string,
  ctx: CommandContext,
  opts: GrammarOptions & { dialogOpen?: boolean } = {},
): Promise<CommandResolution> {
  const heard = text.trim();
  const exactOnly = Boolean(opts.exactOnly || opts.dialogOpen);
  const m = matchCommand(heard, { exactOnly, extra: opts.extra });

  if (m.kind === "exact" || m.kind === "fuzzy") {
    const r: CommandResolution = { kind: "actions", actions: [m.id], source: "grammar", heard };
    if (m.arg !== undefined) r.arg = m.arg;
    return r;
  }
  const nearest = m.nearest.map((n) => n.id);
  const none = (reason: Extract<CommandResolution, { kind: "none" }>["reason"]): CommandResolution => ({
    kind: "none",
    heard,
    nearest,
    reason,
  });

  if (!heard) return none("no-match");
  // Dialogs are exact-match only: never ask Claude to interpret a confirm.
  if (opts.dialogOpen) return none("no-match");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return none("offline");

  const body: CommandRequest = {
    transcript: heard.slice(0, 500),
    context: { ...ctx, lastActions: ctx.lastActions.slice(-3) },
    dialogOpen: false,
  };
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(COMMAND_CLIENT_TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as { name?: string }).name;
    const timeout = name === "TimeoutError" || name === "AbortError";
    logClaudeCall({ route: "command", mode: "command", summary: `"${heard}" → ${timeout ? "timeout" : "network error"}`, latencyMs: Date.now() - t0, result: timeout ? "timeout" : "error" });
    return none(timeout ? "timeout" : "offline");
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* handled below */
  }
  const parsed = CommandResponseSchema.safeParse(json);
  if (!res.ok || !parsed.success) {
    logClaudeCall({ route: "command", mode: "command", summary: `"${heard}" → invalid (HTTP ${res.status})`, latencyMs: Date.now() - t0, result: "error" });
    return none("invalid");
  }
  const r = parsed.data;
  const mock = r.mock;
  if (r.kind === "actions") {
    logClaudeCall({ route: "command", mode: "command", summary: `"${heard}" → ${r.actions.join(", ")}`, latencyMs: r.latencyMs, result: "accepted", mock });
    return { kind: "actions", actions: r.actions as ActionId[], source: "claude", heard };
  }
  if (r.kind === "clarify") {
    logClaudeCall({ route: "command", mode: "clarify", summary: `"${heard}" → ${r.options.map((o) => o.label).join(" / ")}`, latencyMs: r.latencyMs, result: "accepted", mock });
    return { kind: "clarify", question: r.question, options: r.options, heard };
  }
  logClaudeCall({ route: "command", mode: "command", summary: `"${heard}" → ${r.reason}`, latencyMs: r.latencyMs, result: r.reason === "timeout" ? "timeout" : "error", mock });
  return none(r.reason);
}
