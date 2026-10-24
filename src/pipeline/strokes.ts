/**
 * Stroke finalisation, rendering outline, straight tool and eraser hit-testing (agent A).
 */
import { getStroke } from "perfect-freehand";
import simplify from "simplify-js";
import type { ColourName } from "@/actions";
import type { Rect, Stroke, TimedPoint, Vec2 } from "./types";

export const RDP_EPSILON = 1.5;
export const FREEHAND_OPTIONS = { thinning: 0, smoothing: 0.5, streamline: 0.4 } as const;

export function strokeBBox(points: Vec2[]): Rect {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** RDP simplification (simplify-js, high quality = pure Douglas–Peucker, no radial pre-pass). */
export function simplifyPoints(points: Vec2[], epsilon = RDP_EPSILON): Vec2[] {
  if (points.length <= 2) return points.map((p) => ({ x: p.x, y: p.y }));
  return simplify(
    points.map((p) => ({ x: p.x, y: p.y })),
    epsilon,
    true,
  ).map((p) => ({ x: p.x, y: p.y }));
}

/**
 * On pen-up: drop points with t >= trimFromT (the pen-up dwell period), then
 *  - nothing left → null (nothing to store);
 *  - bbox smaller than r_in in both dimensions → kind "dot": a single point at the anchor
 *    (the first point = the pen-down anchor), rendered as a dot of the stroke width;
 *  - otherwise RDP ε = 1.5 px, kind "free".
 */
export function finalizeStroke(
  points: TimedPoint[],
  o: { id: string; colour: ColourName; width: number; rIn: number; trimFromT?: number; raw?: Vec2[] },
): Stroke | null {
  const kept = o.trimFromT === undefined ? points : points.filter((p) => p.t < (o.trimFromT as number));
  if (!kept.length) return null;
  const bb = strokeBBox(kept);
  const base = { id: o.id, colour: o.colour, width: o.width, createdAt: Date.now(), ...(o.raw ? { raw: o.raw } : {}) };
  if (bb.w < o.rIn && bb.h < o.rIn) {
    return { ...base, kind: "dot", points: [{ x: kept[0].x, y: kept[0].y }] };
  }
  return { ...base, kind: "free", points: simplifyPoints(kept) };
}

/** A dot stroke at `p` (voice/typed "dot"). */
export function makeDot(p: Vec2, o: { id: string; colour: ColourName; width: number }): Stroke {
  return { id: o.id, kind: "dot", points: [{ x: p.x, y: p.y }], colour: o.colour, width: o.width, createdAt: Date.now() };
}

/** perfect-freehand outline polygon (size = width, thinning 0, smoothing 0.5, streamline 0.4). */
export function strokeOutline(points: Vec2[], width: number, last = true): Vec2[] {
  if (!points.length) return [];
  return getStroke(
    points.map((p) => [p.x, p.y]),
    { size: width, ...FREEHAND_OPTIONS, last },
  ).map(([x, y]) => ({ x, y }));
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Outline polygon → SVG path data usable with `new Path2D(d)` (quadratic smoothing through
 * edge midpoints, as in the perfect-freehand README). Falls back to a polygon below 4 points.
 */
export function outlineToPath2DString(outline: Vec2[]): string {
  const n = outline.length;
  if (n === 0) return "";
  if (n < 4) return `M${outline.map((p) => `${f2(p.x)},${f2(p.y)}`).join(" L")} Z`;
  const avg = (a: number, b: number) => (a + b) / 2;
  const [a, b, c] = outline;
  let d = `M${f2(a.x)},${f2(a.y)} Q${f2(b.x)},${f2(b.y)} ${f2(avg(b.x, c.x))},${f2(avg(b.y, c.y))} T`;
  for (let i = 2; i < n - 1; i++) {
    const p = outline[i];
    const q = outline[i + 1];
    d += `${f2(avg(p.x, q.x))},${f2(avg(p.y, q.y))} `;
  }
  return d + "Z";
}

/** Straight tool: the stroke so far becomes a line from its first to its last point. */
export function straighten(points: Vec2[]): Vec2[] {
  if (points.length === 0) return [];
  const a = points[0];
  const b = points[points.length - 1];
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: b.y },
  ];
}

/** Distance from p to segment ab. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
}

/** Distance from p to a stroke's centreline (polyline; closed shapes include their closing edge). */
export function distToStroke(p: Vec2, s: Stroke): number {
  const pts = s.points;
  if (!pts.length) return Infinity;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, distToSegment(p, pts[i], pts[i + 1]));
  return best;
}

/** Eraser: ids of strokes whose painted area (centreline ± width/2) is within `radius` of p. */
export function eraserHits(strokes: Stroke[], p: Vec2, radius: number): string[] {
  const out: string[] = [];
  for (const s of strokes) {
    const bb = strokeBBox(s.points);
    const pad = radius + s.width / 2;
    if (p.x < bb.x - pad || p.x > bb.x + bb.w + pad || p.y < bb.y - pad || p.y > bb.y + bb.h + pad) continue;
    if (distToStroke(p, s) <= pad) out.push(s.id);
  }
  return out;
}
