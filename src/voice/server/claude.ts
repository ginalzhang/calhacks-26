/**
 * Server-only Claude calls. Imported ONLY by src/app/api/** route handlers; never from client code
 * (it imports @anthropic-ai/sdk and reads ANTHROPIC_API_KEY).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { ACTIONS } from "@/actions";
import {
  ActionsSchema,
  CleanupSchema,
  type ClaudeActionsOutput,
  type CleanupMode,
  type CleanupRequest,
} from "../apiTypes";

export const COMMAND_MODEL = "claude-haiku-5-5";
export const CLEANUP_MODEL = "claude-sonnet-5-5";
export const COMMAND_TIMEOUT_MS = 2500;
export const CLEANUP_TIMEOUT_MS = 15_000;

export function anthropicKeyPresent(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function client(timeout: number): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout, maxRetries: 0 });
}

/**
 * zodOutputFormat() in @anthropic-ai/sdk 1.3.0 moves `enum`/`const` into the description
 * (as "{enum: [...]}") instead of sending them as constraints. The structured-outputs API
 * supports `enum` and `const`, so restore them: the decoder then cannot emit an unknown
 * action id. zod still re-validates everything (including stripped min/max) on parse.
 */
export function __resetSchemaFallbackForTests() {
  strictRejected = false;
}

export function strictOutputFormat<S extends z.ZodType>(schema: S) {
  const fmt = zodOutputFormat(schema);
  const restore = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(restore);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = restore(v);
    if (typeof out.description === "string" && out.type === "string") {
      const m = /^\{(enum|const): ([\s\S]*)\}$/.exec(out.description);
      if (m) {
        try {
          const val = JSON.parse(m[2]);
          if (m[1] === "enum" && Array.isArray(val)) out.enum = val;
          else if (m[1] === "const") out.enum = [val];
          if (out.enum) delete out.description;
        } catch {
          /* leave as description */
        }
      }
    }
    return out;
  };
  return { ...fmt, schema: restore(fmt.schema) as typeof fmt.schema };
}

/** Set if the API ever rejects the enum-restored schema with a 400: fall back to the SDK's own format. */
let strictRejected = false;

function outputFormat<S extends z.ZodType>(schema: S) {
  return strictRejected ? zodOutputFormat(schema) : strictOutputFormat(schema);
}

/** Run a parse() call; on a 400 with the strict schema, retry once with the SDK's default schema. */
async function withSchemaFallback<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!strictRejected && err instanceof Anthropic.BadRequestError) {
      console.warn("[claude] 400 with enum-restored schema; retrying with the SDK default format:", err.message);
      strictRejected = true;
      return run();
    }
    throw err;
  }
}

export type ClaudeOutcome<T> =
  | { ok: true; value: T; latencyMs: number }
  | { ok: false; reason: "timeout" | "invalid" | "key-missing" | "upstream"; latencyMs: number; detail: string };

function classifyError(err: unknown): { reason: "timeout" | "invalid" | "key-missing" | "upstream"; detail: string } {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return { reason: "timeout", detail: "Claude timed out" };
  if (err instanceof Anthropic.APIUserAbortError) return { reason: "timeout", detail: "aborted" };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
    return { reason: "key-missing", detail: `Anthropic rejected the key (${err.status})` };
  if (err instanceof Anthropic.APIError) return { reason: "upstream", detail: `${err.status ?? "network"}: ${err.message}` };
  // Non-API AnthropicError = the SDK's structured-output parse/zod validation failed.
  if (err instanceof Anthropic.AnthropicError) return { reason: "invalid", detail: err.message.slice(0, 300) };
  return { reason: "upstream", detail: err instanceof Error ? err.message : String(err) };
}

// ---------------------------------------------------------------- /api/command

const ACTION_LIST = ACTIONS.map(
  (a) => `- ${a.id}: "${a.label}" (says: ${a.phrases.map((p) => `"${p}"`).join(", ")})${a.destructive ? " [destructive, asks to confirm]" : ""}`,
).join("\n");

export const COMMAND_SYSTEM = `You map one spoken or typed request to actions in Steady, a drawing and note-taking app for people who draw with a webcam-tracked hand or their head and control it by voice, because holding a pen hurts or their hand shakes.

The local grammar already tried exact and near-exact phrase matching and failed, so the request is usually paraphrased, mis-heard by speech recognition, or wrapped in extra words. Speech recognition errors are common (accents, slurred or quiet speech); prefer the action whose phrase sounds most like what was heard.

Available actions (id: tile label (voice phrases)):
${ACTION_LIST}

Reply with exactly one of:
- {"kind":"actions","actions":[...]} when one intent is clear. Use 1 action normally; up to 4 only when the request clearly asks for several things in order (e.g. "make it a blue circle" -> ["shape.circle","colour.blue"]). "it"/"that"/"the last thing" refers to the selected or most recent stroke.
- {"kind":"clarify","question":"...","options":[...]} when two or three different actions are plausible. 2 or 3 options, each with a short label (under 30 characters, plain words, e.g. "Zoom in") and its actions. The question is short (e.g. "Bigger how?").
- {"kind":"none"} when the request is not a command for this app, is empty or unintelligible, or nothing fits. Never guess wildly.

Rules: never pick a destructive action (delete page, clear page, reset setup, next judge) unless the request plainly asks to delete, clear, erase everything, or reset; if in doubt use clarify. Never invent ids. Do not mention medical conditions.`;

export async function claudeCommand(
  transcript: string,
  context: unknown,
): Promise<ClaudeOutcome<ClaudeActionsOutput>> {
  const t0 = Date.now();
  try {
    const res = await withSchemaFallback(() =>
      client(Math.max(250, COMMAND_TIMEOUT_MS - (Date.now() - t0))).messages.parse({
      model: COMMAND_MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: outputFormat(ActionsSchema) },
      system: COMMAND_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Heard: ${JSON.stringify(transcript)}\nContext: ${JSON.stringify(context)}`,
        },
      ],
      }),
    );
    const latencyMs = Date.now() - t0;
    const parsed = res.parsed_output;
    if (parsed == null) return { ok: false, reason: "invalid", latencyMs, detail: `no parsed output (stop_reason ${res.stop_reason})` };
    const check = ActionsSchema.safeParse(parsed);
    if (!check.success) return { ok: false, reason: "invalid", latencyMs, detail: check.error.message.slice(0, 300) };
    return { ok: true, value: check.data, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, ...classifyError(err) };
  }
}

// ---------------------------------------------------------------- /api/cleanup

const CLEANUP_INSTRUCTIONS: Record<CleanupMode, string> = {
  handwriting:
    "The image is a crop of handwriting drawn with a shaky, webcam-tracked pointer, so letters are wobbly and may be joined. Read what it says. Return the text exactly as written (keep the user's words, fix nothing but obvious letter shapes; separate lines with \\n), your confidence 0..1, and the ids of the strokes that are part of the writing (normally all of them; leave out strokes that are clearly a drawing, not letters). If nothing is legible return an empty text and confidence 0.",
  cleanup:
    "The image is a crop of a rough sketch drawn with a shaky, webcam-tracked pointer. Redraw it as clean shapes: rect (x,y,w,h), circle (cx,cy,r), line (x1,y1,x2,y2; arrows are lines), triangle (3 points) and text (x = left, y = baseline, size in px) for any handwritten words. Use canvas pixel coordinates (the same space as the stroke points; the crop's top-left is the bbox x,y). Keep positions and sizes close to the original; straighten, align and equalise only what was clearly intended. Return the ids of the strokes your shapes replace.",
  label:
    "The image is a crop of a sketch drawn with a shaky, webcam-tracked pointer. Suggest 1-3 short labels (1-3 words each, e.g. \"Database\", \"Front door\") naming the main parts, placed next to (not on top of) what they name. x = left edge, y = text baseline, in canvas pixel coordinates (the crop's top-left is the bbox x,y); size 18-28 px.",
};

/** Round coordinates and downsample long strokes so the JSON stays small. */
export function compactStrokes(strokes: CleanupRequest["strokes"], maxPoints = 64) {
  return strokes.map((s) => {
    const step = Math.max(1, Math.ceil(s.points.length / maxPoints));
    const pts = s.points.filter((_, i) => i % step === 0 || i === s.points.length - 1);
    return { id: s.id, kind: s.kind, colour: s.colour, width: s.width, points: pts.map((p) => [Math.round(p.x), Math.round(p.y)]) };
  });
}

export type CleanupClaudeOutput<M extends CleanupMode> = z.infer<(typeof CleanupSchema)[M]>;

export async function claudeCleanup<M extends CleanupMode>(
  mode: M,
  req: CleanupRequest,
): Promise<ClaudeOutcome<CleanupClaudeOutput<M>>> {
  const t0 = Date.now();
  const schema = CleanupSchema[mode] as unknown as z.ZodType<CleanupClaudeOutput<M>>;
  const content: Anthropic.ContentBlockParam[] = [];
  if (req.imagePng) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: req.imagePng } });
  }
  content.push({
    type: "text",
    text: `${CLEANUP_INSTRUCTIONS[mode]}\n\nSelection bbox (canvas px): ${JSON.stringify(req.bbox)}\nStrokes (points are [x,y] canvas px):\n${JSON.stringify(compactStrokes(req.strokes))}`,
  });
  try {
    const res = await withSchemaFallback(() =>
      client(Math.max(250, CLEANUP_TIMEOUT_MS - (Date.now() - t0))).messages.parse({
        model: CLEANUP_MODEL,
        max_tokens: 8192,
        // Thinking cannot be disabled on Sonnet 5.5: omit `thinking` (adaptive) and steer with effort.
        output_config: { effort: mode === "handwriting" ? "low" : "medium", format: outputFormat(schema) },
        messages: [{ role: "user", content }],
      }),
    );
    const latencyMs = Date.now() - t0;
    const parsed = res.parsed_output;
    if (parsed == null) return { ok: false, reason: "invalid", latencyMs, detail: `no parsed output (stop_reason ${res.stop_reason})` };
    const check = schema.safeParse(parsed);
    if (!check.success) return { ok: false, reason: "invalid", latencyMs, detail: check.error.message.slice(0, 300) };
    return { ok: true, value: check.data, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, ...classifyError(err) };
  }
}
