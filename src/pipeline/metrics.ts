/** Demo-panel metric helpers (formulas documented in README). */
import type { Vec2 } from "./types";

export function rms(values: number[]): number {
  if (!values.length) return 0;
  let s = 0;
  for (const v of values) s += v * v;
  return Math.sqrt(s / values.length);
}

/** RMS Euclidean distance between paired points (truncated to the shorter array). */
export function rmsDeviation(a: Vec2[], b: Vec2[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i].x - b[i].x) ** 2 + (a[i].y - b[i].y) ** 2;
  return Math.sqrt(s / n);
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, v) => a + v, 0) / values.length : 0;
}

export function centroid(points: Vec2[]): Vec2 {
  if (!points.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** RMS distance of points from their centroid (2D jitter magnitude). */
export function rmsFromCentroid(points: Vec2[]): number {
  const c = centroid(points);
  return rms(points.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
}

/** Command success rate 0..1 (matched / total), 0 when no commands yet. */
export function successRate(matched: number, total: number): number {
  return total > 0 ? matched / total : 0;
}
