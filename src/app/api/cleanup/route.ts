/**
 * POST /api/cleanup: AI cleanup on explicit request only (docs/API.md).
 * GET  /api/cleanup: key probe.
 */
import { connection } from "next/server";
import { CleanupRequestSchema, CleanupResponseSchema, type CleanupRequest, type CleanupResponse } from "@/voice/apiTypes";
import { anthropicKeyPresent, claudeCleanup } from "@/voice/server/claude";
import { mockCleanupShapes, mockHandwriting, mockLabels, mockLatency } from "@/voice/server/mocks";
import { apiError, json, readJson, sleep } from "@/voice/server/http";

export async function GET() {
  await connection();
  const keyPresent = anthropicKeyPresent();
  return json({ keyPresent, mock: !keyPresent });
}

/** Font size for recognised handwriting: roughly the written x-height, per line. */
function textSize(req: CleanupRequest, text: string): number {
  const lines = Math.max(1, text.split("\n").length);
  return Math.round(Math.min(64, Math.max(18, (req.bbox.h / lines) * 0.6)));
}

export async function POST(req: Request) {
  const mock = !anthropicKeyPresent();
  const parsed = CleanupRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError("bad-request", issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request body", mock, 400);
  }
  const body = parsed.data;
  if (body.imagePng.startsWith("data:")) return apiError("bad-request", "imagePng must not include a data: prefix", mock, 400);
  const ids = new Set(body.strokes.map((s) => s.id));
  const onlyKnown = (r: string[]) => [...new Set(r.filter((id) => ids.has(id)))];

  let out: CleanupResponse;
  if (mock) {
    const latencyMs = mockLatency(900, 1800);
    await sleep(latencyMs);
    if (body.mode === "handwriting") {
      const r = mockHandwriting(body);
      out = { mode: "handwriting", ...r, at: { x: body.bbox.x, y: body.bbox.y }, size: textSize(body, r.text), mock, latencyMs };
    } else if (body.mode === "cleanup") {
      out = { mode: "cleanup", ...mockCleanupShapes(body), mock, latencyMs };
    } else {
      out = { mode: "label", ...mockLabels(body), mock, latencyMs };
    }
  } else {
    const r = await claudeCleanup(body.mode, body);
    if (!r.ok) {
      console.warn(`[api/cleanup] ${body.mode} ${r.reason}: ${r.detail}`);
      if (r.reason === "timeout") return apiError("timeout", "Claude took longer than 15 s.", mock, 504);
      if (r.reason === "key-missing") return apiError("key-missing", "The Anthropic key was rejected.", mock, 503);
      if (r.reason === "invalid") return apiError("invalid", "Claude's answer did not match the expected shape.", mock, 502);
      return apiError("upstream", `Claude request failed: ${r.detail}`, mock, 502);
    }
    const v = r.value as Record<string, unknown>;
    if (body.mode === "handwriting") {
      const h = v as { text: string; confidence: number; replaces: string[] };
      const replaces = onlyKnown(h.replaces);
      out = {
        mode: "handwriting",
        text: h.text,
        confidence: h.confidence,
        replaces: replaces.length ? replaces : [...ids],
        at: { x: body.bbox.x, y: body.bbox.y },
        size: textSize(body, h.text),
        mock,
        latencyMs: r.latencyMs,
      };
    } else if (body.mode === "cleanup") {
      const c = v as Extract<CleanupResponse, { mode: "cleanup" }>;
      out = { mode: "cleanup", shapes: c.shapes, replaces: onlyKnown(c.replaces), mock, latencyMs: r.latencyMs };
    } else {
      const l = v as Extract<CleanupResponse, { mode: "label" }>;
      out = { mode: "label", labels: l.labels, mock, latencyMs: r.latencyMs };
    }
  }
  const checked = CleanupResponseSchema.safeParse(out);
  if (!checked.success) return apiError("invalid", "Result failed validation.", mock, 502);
  return json(checked.data);
}
