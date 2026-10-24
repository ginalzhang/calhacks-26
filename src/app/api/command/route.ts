/**
 * POST /api/command: Claude fallback for commands the local grammar could not match (docs/API.md).
 * GET  /api/command: key probe.
 */
import { connection } from "next/server";
import { CommandRequestSchema, CommandResponseSchema, type CommandResponse } from "@/voice/apiTypes";
import { anthropicKeyPresent, claudeCommand } from "@/voice/server/claude";
import { mockCommand, mockLatency } from "@/voice/server/mocks";
import { apiError, json, readJson, sleep } from "@/voice/server/http";

export async function GET() {
  await connection();
  const keyPresent = anthropicKeyPresent();
  return json({ keyPresent, mock: !keyPresent });
}

export async function POST(req: Request) {
  const mock = !anthropicKeyPresent();
  const body = CommandRequestSchema.safeParse(await readJson(req));
  if (!body.success) return apiError("bad-request", body.error.issues[0]?.message ?? "Invalid request body", mock, 400);
  const { transcript, context, dialogOpen } = body.data;

  // Dialogs are exact-match only (design rule 6); the client should never call us then.
  if (dialogOpen) return json({ kind: "none", reason: "no-match", mock, latencyMs: 0 } satisfies CommandResponse);

  let out: CommandResponse;
  if (mock) {
    const latencyMs = mockLatency(300, 700);
    await sleep(latencyMs);
    const r = mockCommand(transcript);
    out = r.kind === "none" ? { kind: "none", reason: "no-match", mock, latencyMs } : { ...r, mock, latencyMs };
  } else {
    const r = await claudeCommand(transcript, context);
    if (!r.ok) {
      console.warn(`[api/command] ${r.reason}: ${r.detail}`);
      const reason = r.reason === "upstream" ? "invalid" : r.reason;
      out = { kind: "none", reason, mock, latencyMs: r.latencyMs };
    } else if (r.value.kind === "none") {
      out = { kind: "none", reason: "no-match", mock, latencyMs: r.latencyMs };
    } else {
      out = { ...r.value, mock, latencyMs: r.latencyMs };
    }
  }
  // Belt and braces: never emit something the client schema would reject.
  const checked = CommandResponseSchema.safeParse(out);
  if (!checked.success) return json({ kind: "none", reason: "invalid", mock, latencyMs: out.latencyMs } satisfies CommandResponse);
  return json(checked.data);
}
