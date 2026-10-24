/**
 * Active box: the small region of the camera frame (camera px, mirrored) that maps to the
 * whole canvas. Uniform scale on both axes (gain = canvas.w / box.w = canvas.h / box.h) so
 * circles stay circles.
 */
import type { Rect, Size, Vec2 } from "./types";

export const MIN_GAIN = 2;
export const MAX_GAIN = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Box of size canvas/gain centred on `centre` (camera px), shifted to stay inside the video when it fits. */
export function boxAt(centre: Vec2, video: Size, canvas: Size, gain: number): Rect {
  const g = gain > 0 ? gain : 3;
  const w = canvas.w / g;
  const h = canvas.h / g;
  let x = centre.x - w / 2;
  let y = centre.y - h / 2;
  if (w <= video.w) x = clamp(x, 0, video.w - w);
  if (h <= video.h) y = clamp(y, 0, video.h - h);
  return { x, y, w, h };
}

/** Centred box for an uncalibrated user: canvas size ÷ gain. */
export function defaultActiveBox(video: Size, canvas: Size, gain: number): Rect {
  return boxAt({ x: video.w / 2, y: video.h / 2 }, video, canvas, gain);
}

/** Linear box → canvas mapping. No clamping; callers decide. */
export function mapToCanvas(p: Vec2, box: Rect, canvas: Size): Vec2 {
  return { x: ((p.x - box.x) / box.w) * canvas.w, y: ((p.y - box.y) / box.h) * canvas.h };
}

/** Inverse of mapToCanvas (canvas px → camera px). */
export function mapToCamera(p: Vec2, box: Rect, canvas: Size): Vec2 {
  return { x: box.x + (p.x / canvas.w) * box.w, y: box.y + (p.y / canvas.h) * box.h };
}

/**
 * The box the engine actually uses: the calibrated box supplies the centre, the live gain
 * supplies the size (so the Gain slider edits the calibrated value live, §2).
 */
export function effectiveBox(activeBox: Rect | null, video: Size, canvas: Size, gain: number): Rect {
  if (!activeBox) return defaultActiveBox(video, canvas, gain);
  return boxAt({ x: activeBox.x + activeBox.w / 2, y: activeBox.y + activeBox.h / 2 }, video, canvas, gain);
}

function percentile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = clamp((sorted.length - 1) * q, 0, sorted.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Calibration step 2: the comfortable circle (camera px) → active box.
 * Robust bbox (2nd–98th percentile), padded by `pad` (0.2 → 20 % larger), expanded to the
 * canvas aspect ratio, gain = canvas.w ÷ box.w clamped 2..10. `tooSmall` when > 10× was needed.
 */
export function boxFromCircle(
  points: Vec2[],
  video: Size,
  canvas: Size,
  pad = 0.2,
): { box: Rect; gain: number; tooSmall: boolean } {
  if (points.length < 3) return { box: defaultActiveBox(video, canvas, 3), gain: 3, tooSmall: false };
  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  const ys = points.map((p) => p.y).sort((a, b) => a - b);
  const x0 = percentile(xs, 0.02);
  const x1 = percentile(xs, 0.98);
  const y0 = percentile(ys, 0.02);
  const y1 = percentile(ys, 0.98);
  const centre = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const aspect = canvas.w / canvas.h;
  const bw = (x1 - x0) * (1 + pad);
  const bh = (y1 - y0) * (1 + pad);
  const boxW = Math.max(bw, bh * aspect);
  const rawGain = boxW > 0 ? canvas.w / boxW : Infinity;
  const tooSmall = rawGain > MAX_GAIN;
  const gain = clamp(rawGain, MIN_GAIN, MAX_GAIN);
  return { box: boxAt(centre, video, canvas, gain), gain, tooSmall };
}
