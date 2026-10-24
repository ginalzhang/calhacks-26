/**
 * Realistic mock responses used by the API routes when no API key is configured.
 * Pure (no SDK, no DOM) so it is unit-tested; only imported by route handlers.
 */
import { ACTIONS, COLOURS, type ActionId } from "@/actions";
import type { ClaudeActionsOutput, CleanShape, CleanupRequest, CleanupSchema } from "../apiTypes";
import { normalize } from "@/pipeline/grammar";
import type { z } from "zod";

type Clarify = Extract<ClaudeActionsOutput, { kind: "clarify" }>;

const COLOUR_WORDS: Record<string, ActionId> = {
  sky: "colour.blue",
  ocean: "colour.blue",
  sea: "colour.blue",
  navy: "colour.blue",
  grass: "colour.green",
  leaf: "colour.green",
  leaves: "colour.green",
  lime: "colour.green",
  sun: "colour.yellow",
  lemon: "colour.yellow",
  banana: "colour.yellow",
  gold: "colour.yellow",
  fire: "colour.red",
  blood: "colour.red",
  cherry: "colour.red",
  rose: "colour.red",
  tomato: "colour.red",
  violet: "colour.purple",
  lavender: "colour.purple",
  grape: "colour.purple",
  pumpkin: "colour.orange",
  carrot: "colour.orange",
  coal: "colour.black",
  ink: "colour.black",
  snow: "colour.white",
  chalk: "colour.white",
};
for (const c of COLOURS) COLOUR_WORDS[c] = `colour.${c}` as ActionId;

/** Ordered keyword rules: first rule with any matching word wins. */
const RULES: { words: string[]; result: ClaudeActionsOutput }[] = [
  { words: ["ball", "round", "ring", "circle", "oval", "wheel"], result: { kind: "actions", actions: ["shape.circle"] } },
  { words: ["box", "rectangle", "square", "frame"], result: { kind: "actions", actions: ["shape.square"] } },
  { words: ["triangle", "pyramid", "arrowhead"], result: { kind: "actions", actions: ["shape.triangle"] } },
  { words: ["straighten", "ruler", "line"], result: { kind: "actions", actions: ["shape.line"] } },
  { words: ["oops", "mistake", "back"], result: { kind: "actions", actions: ["undo"] } },
  { words: ["rubber", "erase", "rub"], result: { kind: "actions", actions: ["tool.eraser"] } },
  { words: ["fatter", "bolder", "wider", "heavier"], result: { kind: "actions", actions: ["width.thicker"] } },
  { words: ["finer", "skinnier", "narrower", "lighter"], result: { kind: "actions", actions: ["width.thinner"] } },
  {
    words: ["bigger", "larger", "enlarge"],
    result: {
      kind: "clarify",
      question: "Bigger how?",
      options: [
        { label: "Zoom in", actions: ["zoom.in"] },
        { label: "Thicker pen", actions: ["width.thicker"] },
      ],
    },
  },
  {
    words: ["smaller", "tiny", "shrink"],
    result: {
      kind: "clarify",
      question: "Smaller how?",
      options: [
        { label: "Zoom out", actions: ["zoom.out"] },
        { label: "Thinner pen", actions: ["width.thinner"] },
      ],
    },
  },
  {
    words: ["save", "download", "keep"],
    result: {
      kind: "clarify",
      question: "Save it as what?",
      options: [
        { label: "Picture (PNG)", actions: ["export.png"] },
        { label: "Drawing (SVG)", actions: ["export.svg"] },
        { label: "Print or PDF", actions: ["export.pdf"] },
      ],
    },
  },
  { words: ["shaky", "wobbly", "jittery", "shaking", "wobble"], result: { kind: "actions", actions: ["steadier"] } },
  { words: ["write", "writing", "jot", "dictate"], result: { kind: "actions", actions: ["dictate"] } },
  { words: ["read", "aloud", "say"], result: { kind: "actions", actions: ["readback"] } },
  { words: ["tidy", "neaten", "neater"], result: { kind: "actions", actions: ["ai.cleanup"] } },
  { words: ["stop", "hold", "freeze"], result: { kind: "actions", actions: ["pause.toggle"] } },
  { words: ["instructions", "confused", "how"], result: { kind: "actions", actions: ["help"] } },
];

/** Keyword matcher standing in for claude-haiku-5-5 when ANTHROPIC_API_KEY is missing. */
export function mockCommand(transcript: string): ClaudeActionsOutput {
  const words = normalize(transcript).split(" ").filter(Boolean);
  const colours = [...new Set(words.map((w) => COLOUR_WORDS[w]).filter(Boolean))];
  let shape: ClaudeActionsOutput | null = null;
  for (const r of RULES) {
    if (r.words.some((w) => words.includes(w))) {
      shape = r.result;
      break;
    }
  }
  if (colours.length > 1 && !shape) {
    const options = colours.slice(0, 3).map((id) => ({ label: `Make it ${ACTION_LABEL[id]}`, actions: [id] }));
    return { kind: "clarify", question: "Which colour?", options } as Clarify;
  }
  if (shape && shape.kind === "actions" && colours.length === 1) {
    // "make the last thing a red ball" -> shape then colour.
    return { kind: "actions", actions: [...shape.actions, colours[0]].slice(0, 4) };
  }
  if (shape) return shape;
  if (colours.length === 1) return { kind: "actions", actions: [colours[0]] };
  return { kind: "none" };
}

const ACTION_LABEL: Record<string, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.id, a.id.startsWith("colour.") ? a.label.toLowerCase() : a.label]),
);

/** Simulated model latency, ms. */
export function mockLatency(minMs: number, maxMs: number): number {
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

// ---------------------------------------------------------------- cleanup

type Pt = { x: number; y: number };

function bboxOf(points: Pt[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Crude per-stroke classifier standing in for Claude's "clean this up". */
export function guessShape(points: Pt[]): CleanShape | null {
  if (points.length === 0) return null;
  const b = bboxOf(points);
  const diag = Math.hypot(b.w, b.h);
  if (diag < 4) return { kind: "circle", cx: r1(b.x), cy: r1(b.y), r: 3 };
  const first = points[0];
  const last = points[points.length - 1];
  const closed = Math.hypot(last.x - first.x, last.y - first.y) < 0.2 * diag;
  if (!closed || Math.min(b.w, b.h) < 0.15 * Math.max(b.w, b.h)) {
    return { kind: "line", x1: r1(first.x), y1: r1(first.y), x2: r1(last.x), y2: r1(last.y) };
  }
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const mean = radii.reduce((s, r) => s + r, 0) / radii.length;
  const sd = Math.sqrt(radii.reduce((s, r) => s + (r - mean) ** 2, 0) / radii.length);
  // A rectangle reaches all four bbox corners; a circle stays ~0.15 diag away from them.
  const corners = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
  const cornerGap = Math.max(...corners.map((c) => Math.min(...points.map((p) => Math.hypot(p.x - c.x, p.y - c.y)))));
  const boxy = cornerGap < 0.08 * diag;
  if (!boxy && mean > 0 && sd / mean < 0.15) return { kind: "circle", cx: r1(cx), cy: r1(cy), r: r1(mean) };
  // Triangle if the top is much narrower than the bottom.
  const topBand = points.filter((p) => p.y < b.y + b.h * 0.2);
  const topW = topBand.length ? bboxOf(topBand).w : b.w;
  if (topW < b.w * 0.35) {
    return {
      kind: "triangle",
      points: [
        { x: r1(cx), y: r1(b.y) },
        { x: r1(b.x + b.w), y: r1(b.y + b.h) },
        { x: r1(b.x), y: r1(b.y + b.h) },
      ],
    };
  }
  return { kind: "rect", x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h) };
}

const MOCK_PHRASES = ["notes", "buy milk", "call mom", "meeting at 3", "hello world", "draw more cats", "pick up the kids"];

type HW = z.infer<(typeof CleanupSchema)["handwriting"]>;
type CL = z.infer<(typeof CleanupSchema)["cleanup"]>;
type LB = z.infer<(typeof CleanupSchema)["label"]>;

export function mockHandwriting(req: CleanupRequest): HW {
  const { w, h } = req.bbox;
  const aspect = h > 0 ? w / h : 3;
  // Longer, flatter selections get longer phrases.
  const byLen = [...MOCK_PHRASES].sort((a, b) => a.length - b.length);
  const idx = Math.max(0, Math.min(byLen.length - 1, Math.round((aspect - 1) * 1.2)));
  return { text: byLen[idx], confidence: 0.62, replaces: req.strokes.map((s) => s.id) };
}

export function mockCleanupShapes(req: CleanupRequest): CL {
  const shapes: CleanShape[] = [];
  const replaces: string[] = [];
  for (const s of req.strokes) {
    const g = guessShape(s.points);
    if (!g) continue;
    shapes.push(g);
    replaces.push(s.id);
  }
  return { shapes, replaces };
}

export function mockLabels(req: CleanupRequest): LB {
  const names: Record<CleanShape["kind"], string> = {
    circle: "Circle",
    rect: "Box",
    line: "Arrow",
    triangle: "Triangle",
    text: "Note",
  };
  const labels: LB["labels"] = [];
  for (const s of req.strokes.slice(0, 3)) {
    const g = guessShape(s.points);
    if (!g) continue;
    const b = bboxOf(s.points);
    labels.push({ text: names[g.kind], x: r1(b.x), y: r1(b.y + b.h + 26), size: 22 });
  }
  if (!labels.length) {
    labels.push({ text: "Diagram", x: req.bbox.x, y: req.bbox.y + req.bbox.h + 26, size: 22 });
  }
  return { labels };
}
