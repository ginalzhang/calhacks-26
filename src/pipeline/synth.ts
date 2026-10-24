/**
 * Synthetic signal helpers for tests and fixture synthesis (pure, seedable).
 */
import { mulberry32 } from "./tremor";
import type { Vec2 } from "./types";

/** Seeded standard-normal generator (Box–Muller). */
export function gaussian(seed: number): () => number {
  const rnd = mulberry32(seed);
  return () => {
    const u = Math.max(rnd(), 1e-12);
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/** Sample times in ms for `seconds` at `fps`, starting at t0Ms. */
export function frameTimes(seconds: number, fps: number, t0Ms = 0): number[] {
  const n = Math.round(seconds * fps);
  return Array.from({ length: n }, (_, i) => t0Ms + (i * 1000) / fps);
}

/** Amplitude of the `hz` component of (t, v) samples by least-squares lock-in (sin+cos projection). */
export function lockInAmplitude(ts: number[], vs: number[], hz: number): number {
  let ss = 0;
  let cc = 0;
  let sc = 0;
  let vs1 = 0;
  let vc1 = 0;
  for (let i = 0; i < ts.length; i++) {
    const w = 2 * Math.PI * hz * (ts[i] / 1000);
    const s = Math.sin(w);
    const c = Math.cos(w);
    ss += s * s;
    cc += c * c;
    sc += s * c;
    vs1 += vs[i] * s;
    vc1 += vs[i] * c;
  }
  const det = ss * cc - sc * sc;
  if (Math.abs(det) < 1e-12) return 0;
  const a = (vs1 * cc - vc1 * sc) / det;
  const b = (vc1 * ss - vs1 * sc) / det;
  return Math.hypot(a, b);
}

/** Frequency (Hz) of the largest DFT bin (excluding DC) of uniformly sampled values. */
export function dominantFrequency(vs: number[], fps: number): number {
  const n = vs.length;
  const m = vs.reduce((a, v) => a + v, 0) / n;
  let best = 0;
  let bestK = 1;
  for (let k = 1; k <= Math.floor(n / 2); k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const w = (2 * Math.PI * k * i) / n;
      re += (vs[i] - m) * Math.cos(w);
      im -= (vs[i] - m) * Math.sin(w);
    }
    const p = re * re + im * im;
    if (p > best) {
      best = p;
      bestK = k;
    }
  }
  return (bestK * fps) / n;
}

/** Points on a circle (closed: last point repeats the first when `closed`). */
export function circlePoints(c: Vec2, r: number, n: number, closed = true): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  if (closed) out.push({ ...out[0] });
  return out;
}

/** Densely sampled polyline through `vertices` (spacing ≈ `step` px). */
export function densify(vertices: Vec2[], step = 3): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  out.push({ ...vertices[vertices.length - 1] });
  return out;
}

/** Add seeded gaussian noise of `sigma` px to each point. */
export function jitter(points: Vec2[], sigma: number, seed = 7): Vec2[] {
  const g = gaussian(seed);
  return points.map((p) => ({ x: p.x + sigma * g(), y: p.y + sigma * g() }));
}
