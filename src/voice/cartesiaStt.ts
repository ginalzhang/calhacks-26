/**
 * Cartesia Ink 2 streaming STT over the manual-endpoint WebSocket (no SDK; see PROMPT.md §5).
 * Verified against docs.cartesia.ai (2026-10-24): binary PCM frames in, text "finalize" ->
 * transcripts + `flush_done`; `transcript.text` is a delta and the full transcript is the
 * concatenation of chunks with is_final: true; keyterm repeated, <= 100 terms / 1200 chars.
 */
import { ACTIONS } from "@/actions";

export const CARTESIA_STT_URL = "wss://api.cartesia.ai/stt/websocket";
export const CARTESIA_VERSION = "2026-08-14";
export const STT_SAMPLE_RATE = 16000;
export const MAX_KEYTERMS = 100;
export const MAX_KEYTERM_CHARS = 1200;

/** Every voice phrase in the action table (table order, de-duplicated), capped to Cartesia's limits. */
export function commandKeyterms(extra: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let chars = 0;
  for (const p of [...ACTIONS.flatMap((a) => a.phrases), ...extra]) {
    const k = p.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    if (out.length >= MAX_KEYTERMS || chars + k.length > MAX_KEYTERM_CHARS) break;
    seen.add(k);
    out.push(k);
    chars += k.length;
  }
  return out;
}

export function buildSttUrl(token: string, mode: "command" | "dictation", extraKeyterms: string[] = []): string {
  const q = new URLSearchParams({
    model: "ink-2",
    encoding: "pcm_s16le",
    sample_rate: String(STT_SAMPLE_RATE),
    cartesia_version: CARTESIA_VERSION,
    access_token: token,
  });
  // Dictation is free text: no keyterm biasing.
  if (mode === "command") for (const k of commandKeyterms(extraKeyterms)) q.append("keyterm", k);
  return `${CARTESIA_STT_URL}?${q.toString()}`;
}

export type SttServerMessage =
  | { type: "transcript"; text: string; is_final: boolean; request_id?: string; duration?: number }
  | { type: "flush_done"; request_id?: string }
  | { type: "done"; request_id?: string }
  | { type: "error"; message?: string; title?: string; status_code?: number; error_code?: string };

export function parseSttMessage(data: unknown): SttServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    const m = JSON.parse(data) as { type?: unknown; text?: unknown; is_final?: unknown };
    if (m.type === "transcript") {
      return { ...(m as object), type: "transcript", text: typeof m.text === "string" ? m.text : "", is_final: m.is_final === true };
    }
    if (m.type === "flush_done" || m.type === "done" || m.type === "error") return m as SttServerMessage;
    return null;
  } catch {
    return null;
  }
}

/**
 * Assembles the transcript: final = concatenation of is_final deltas (whitespace kept, per the
 * docs); the current partial = final + the latest non-final delta.
 */
export function createTranscriptAssembler() {
  let finalText = "";
  let pending = "";
  return {
    push(text: string, isFinal: boolean): string {
      if (isFinal) {
        finalText += text;
        pending = "";
      } else {
        pending = text;
      }
      return (finalText + pending).replace(/\s+/g, " ").trim();
    },
    /** What to deliver as the final transcript (falls back to the last partial if nothing finalised). */
    final(): string {
      return (finalText || pending).replace(/\s+/g, " ").trim();
    },
    get hasText(): boolean {
      return (finalText + pending).trim().length > 0;
    },
    reset() {
      finalText = "";
      pending = "";
    },
  };
}
