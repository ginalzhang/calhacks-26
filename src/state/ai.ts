/**
 * AI cleanup on explicit request only (§4): PNG crop + stroke list → C's requestCleanup →
 * ghost overlay with Accept (Enter) / Reject (Esc, Backspace, Z). Nothing is replaced until Accept.
 */
import { requestCleanup, resolveClaudeCall, getClaudeStats, CleanupError } from "@/voice/cleanupClient";
import type { CleanShape, CleanupMode, CleanupResponse } from "@/voice/apiTypes";
import { newId } from "@/pipeline/document";
import { strokeBBox } from "@/pipeline/strokes";
import type { Rect, Stroke, TextBlock } from "@/pipeline/types";
import { renderPageCanvas } from "@/lib/render";
import { commit, page } from "./docOps";
import { runtime } from "./runtime";
import { getState, setState, setStatus } from "./store";
import { say } from "./voice";

let requestSeq = 0;

const BUSY: Record<CleanupMode, string> = {
  handwriting: "Reading your writing…",
  cleanup: "Tidying your drawing…",
  label: "Thinking of labels…",
};

export function refreshClaudeMetrics() {
  try {
    const c = getClaudeStats();
    const m = getState().metrics;
    setState({ metrics: { ...m, claudeCalls: c.calls, claudeAccepted: c.accepted, claudeRejected: c.rejected, claudeTimeouts: c.timeouts } });
  } catch {
    /* stats are best effort */
  }
}

export async function startCleanup(mode: CleanupMode): Promise<void> {
  const st = getState();
  if (st.overlay) {
    setStatus("Finish the open panel first: Accept or Cancel.");
    return;
  }
  if (!st.online) {
    setStatus("AI cleanup needs the internet, which is down. Drawing, undo and the typed box still work.");
    return;
  }
  const p = page();
  const pool = mode === "handwriting" ? p.strokes.filter((s) => s.kind === "free" || s.kind === "dot") : p.strokes;
  if (!pool.length) {
    setStatus(mode === "handwriting" ? "There is no handwriting on this page yet." : "There is nothing on this page to work with yet.");
    return;
  }
  const bbox = padRect(unionBBox(pool), 12, runtime.canvasSize);
  let imagePng = "";
  try {
    const crop = renderPageCanvas(p, runtime.canvasSize, bbox);
    imagePng = crop.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  } catch {
    imagePng = "";
  }
  const seq = ++requestSeq;
  setState({ overlay: { kind: "busy", text: BUSY[mode] } });
  setStatus(BUSY[mode]);
  const t0 = performance.now();
  let res: (CleanupResponse & { logId: string }) | null = null;
  try {
    res = (await requestCleanup({
      mode,
      imagePng,
      bbox,
      strokes: pool.map((s) => ({ id: s.id, kind: s.kind, colour: s.colour, width: s.width, points: s.points.map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 })) })),
    }));
  } catch (e) {
    refreshClaudeMetrics();
    if (seq !== requestSeq) return;
    const timeout = e instanceof CleanupError ? e.code === "timeout" : /timeout|timed out|abort/i.test(String((e as Error)?.message));
    // CleanupError messages are written for the status bar by agent C.
    const msg = e instanceof CleanupError ? e.message : timeout ? "The AI helper took too long. Nothing changed." : "AI cleanup failed. Nothing was changed.";
    setState({ overlay: null });
    setStatus(msg);
    say(timeout ? "That took too long. Nothing changed." : "That didn't work. Nothing changed.");
    refreshClaudeMetrics();
    return;
  }
  if (seq !== requestSeq || getState().overlay?.kind !== "busy") {
    // User cancelled while waiting.
    if (res?.logId) resolveClaudeCall(res.logId, "rejected");
    refreshClaudeMetrics();
    return;
  }
  const logId = res.logId;
  void t0;
  const ghost = toGhost(res, pool);
  if (!ghost.strokes.length && !ghost.texts.length) {
    resolveClaudeCall(logId, "rejected");
    setState({ overlay: null });
    setStatus(mode === "handwriting" ? "I couldn't read any words there. Nothing changed." : "The AI helper had no suggestion. Nothing changed.");
    refreshClaudeMetrics();
    return;
  }
  setState({ overlay: { kind: "ghost", mode, logId, replaces: ghost.replaces, strokes: ghost.strokes, texts: ghost.texts, summary: summarize(res) } });
  setStatus(`Suggestion: ${summarize(res)}. Accept with Enter, reject with Esc.${res.mock ? " (sample answer: AI key missing)" : ""}`);
  say(mode === "handwriting" && res.mode === "handwriting" ? `I read: ${res.text}. Accept or reject?` : "Here's a suggestion. Accept or reject?");
  refreshClaudeMetrics();
}

export function acceptGhost() {
  const ov = getState().overlay;
  if (ov?.kind !== "ghost") return;
  const p = page();
  const existing = new Set(p.strokes.map((s) => s.id));
  const now = Date.now();
  const texts: TextBlock[] = ov.texts.map((t) => ({ id: newId("t"), x: t.x, y: t.y, text: t.text, size: t.size, colour: getState().colour === "white" && p.background === "light" ? "black" : getState().colour, createdAt: now }));
  commit(ov.mode === "handwriting" ? "writing to text" : ov.mode === "cleanup" ? "clean up" : "labels", [
    { type: "replace-strokes", pageId: p.id, removeIds: ov.replaces.filter((id) => existing.has(id)), add: ov.strokes, addTexts: texts },
  ]);
  resolveClaudeCall(ov.logId, "accepted");
  setState({ overlay: null, lastTextId: texts[texts.length - 1]?.id ?? getState().lastTextId });
  setStatus("Accepted. Undo goes back.");
  say("Accepted");
  refreshClaudeMetrics();
}

export function rejectGhost() {
  const ov = getState().overlay;
  if (ov?.kind === "busy") {
    requestSeq++;
    setState({ overlay: null });
    setStatus("Cancelled. Nothing changed.");
    return;
  }
  if (ov?.kind !== "ghost") return;
  resolveClaudeCall(ov.logId, "rejected");
  setState({ overlay: null });
  setStatus("Rejected. Nothing changed.");
  refreshClaudeMetrics();
}

function summarize(r: CleanupResponse): string {
  if (r.mode === "handwriting") return r.text ? `“${r.text}”` : "no words found";
  if (r.mode === "cleanup") return `${r.shapes.length} tidy ${r.shapes.length === 1 ? "shape" : "shapes"}`;
  return r.labels.map((l) => `“${l.text}”`).join(", ");
}

function toGhost(r: CleanupResponse, pool: Stroke[]) {
  const colour = getState().colour;
  const width = getState().width;
  const strokes: Stroke[] = [];
  const texts: { x: number; y: number; text: string; size: number }[] = [];
  const valid = new Set(pool.map((s) => s.id));
  let replaces: string[] = [];
  if (r.mode === "handwriting") {
    if (r.text.trim()) texts.push({ x: r.at.x, y: r.at.y, text: r.text, size: clamp(r.size, 18, 96) });
    replaces = r.replaces.filter((id) => valid.has(id));
  } else if (r.mode === "cleanup") {
    for (const sh of r.shapes) {
      const s = shapeToStroke(sh, colour, width);
      if (s) strokes.push(s);
      else if (sh.kind === "text") texts.push({ x: sh.x, y: sh.y, text: sh.text, size: clamp(sh.size, 18, 96) });
    }
    replaces = r.replaces.filter((id) => valid.has(id));
  } else {
    for (const l of r.labels) texts.push({ x: l.x, y: l.y, text: l.text, size: clamp(l.size, 18, 72) });
  }
  return { strokes, texts, replaces };
}

function shapeToStroke(sh: CleanShape, colour: Stroke["colour"], width: number): Stroke | null {
  const base = { id: newId("s"), colour, width, createdAt: Date.now() };
  switch (sh.kind) {
    case "rect":
      return { ...base, kind: "rect", points: [{ x: sh.x, y: sh.y }, { x: sh.x + sh.w, y: sh.y }, { x: sh.x + sh.w, y: sh.y + sh.h }, { x: sh.x, y: sh.y + sh.h }, { x: sh.x, y: sh.y }] };
    case "circle": {
      const pts = Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2;
        return { x: sh.cx + sh.r * Math.cos(a), y: sh.cy + sh.r * Math.sin(a) };
      });
      return { ...base, kind: "circle", points: pts };
    }
    case "line":
      return { ...base, kind: "line", points: [{ x: sh.x1, y: sh.y1 }, { x: sh.x2, y: sh.y2 }] };
    case "triangle":
      return { ...base, kind: "triangle", points: [...sh.points, sh.points[0]] };
    default:
      return null;
  }
}

function unionBBox(strokes: Stroke[]): Rect {
  const all = strokes.flatMap((s) => s.points);
  return strokeBBox(all);
}

function padRect(r: Rect, pad: number, size: { w: number; h: number }): Rect {
  const x = Math.max(0, Math.floor(r.x - pad));
  const y = Math.max(0, Math.floor(r.y - pad));
  const x2 = Math.min(size.w, Math.ceil(r.x + r.w + pad));
  const y2 = Math.min(size.h, Math.ceil(r.y + r.h + pad));
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}
