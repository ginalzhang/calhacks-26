/**
 * Two-step calibration analysis (§2), pure.
 *  1. rest (3 s): One Euro output in canvas px at the CURRENT gain → rest-jitter RMS
 *     (linear drift removed per axis), rescaled to the NEW gain (the map is linear) and kept in
 *     canvas px so r_in = 3 × restJitterRms works after calibration.
 *  2. circle (4 s): raw mirrored camera px → active box (padded 20 %, canvas aspect), gain =
 *     canvas.w ÷ box.w clamped 2..10 (`circleTooSmall` when > 10× was needed), and the
 *     kinetic high-frequency residual: the circle mapped to canvas px at the new gain minus a
 *     local quadratic (Savitzky–Golay style, ±150 ms) fit, so the slow intended circle is
 *     removed without curvature bias and 4+ Hz tremor remains.
 * suggestedSteadiness = max(rest-based, kinetic-based), see steadiness.ts.
 * Hand: MediaPipe labels handedness assuming a mirrored (selfie) image; LandmarkFrame passes
 * the label for the UNMIRRORED frame, so "Left" means the user's right hand.
 */
import { boxFromCircle, mapToCanvas } from "./activeBox";
import { rms } from "./metrics";
import { suggestSteadiness } from "./steadiness";
import type { CalibrationResult, PipelineSettings, Size, TimedPoint, Vec2 } from "./types";

export const KINETIC_HALF_WINDOW_MS = 150;

/** RMS of 2D residuals after removing a least-squares linear trend in t from each axis. */
export function detrendedRms(points: TimedPoint[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const residuals = (vals: number[]) => {
    const ts = points.map((p) => p.t);
    const mt = ts.reduce((a, v) => a + v, 0) / n;
    const mv = vals.reduce((a, v) => a + v, 0) / n;
    let stt = 0;
    let stv = 0;
    for (let i = 0; i < n; i++) {
      stt += (ts[i] - mt) ** 2;
      stv += (ts[i] - mt) * (vals[i] - mv);
    }
    const slope = stt > 0 ? stv / stt : 0;
    return vals.map((v, i) => v - (mv + slope * (ts[i] - mt)));
  };
  const rx = residuals(points.map((p) => p.x));
  const ry = residuals(points.map((p) => p.y));
  return rms(rx.map((x, i) => Math.hypot(x, ry[i])));
}

/** Local quadratic fit value at t_i using samples within ±halfMs (per axis). */
function localQuadratic(ts: number[], vs: number[], i: number, halfMs: number): number {
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let j = 0; j < ts.length; j++) {
    const u = (ts[j] - ts[i]) / 1000;
    if (Math.abs(u) * 1000 > halfMs) continue;
    const u2 = u * u;
    s0 += 1;
    s1 += u;
    s2 += u2;
    s3 += u2 * u;
    s4 += u2 * u2;
    b0 += vs[j];
    b1 += vs[j] * u;
    b2 += vs[j] * u2;
  }
  // Solve [[s0 s1 s2][s1 s2 s3][s2 s3 s4]]·[a b c] = [b0 b1 b2] for a (value at u = 0).
  const det = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
  if (s0 < 4 || Math.abs(det) < 1e-18) return s0 > 0 ? b0 / s0 : vs[i];
  return (b0 * (s2 * s4 - s3 * s3) - s1 * (b1 * s4 - s3 * b2) + s2 * (b1 * s3 - s2 * b2)) / det;
}

/** High-frequency residual RMS (px) of a moving path, ends (one half-window) excluded. */
export function highFrequencyResidualRms(points: TimedPoint[], halfMs = KINETIC_HALF_WINDOW_MS): number {
  if (points.length < 8) return 0;
  const ts = points.map((p) => p.t);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const t0 = ts[0] + halfMs;
  const t1 = ts[ts.length - 1] - halfMs;
  const res: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (ts[i] < t0 || ts[i] > t1) continue;
    res.push(Math.hypot(xs[i] - localQuadratic(ts, xs, i, halfMs), ys[i] - localQuadratic(ts, ys, i, halfMs)));
  }
  return rms(res);
}

export function handFromLabel(label: "Left" | "Right" | null): "left" | "right" | "unknown" {
  if (label === "Left") return "right";
  if (label === "Right") return "left";
  return "unknown";
}

export function analyzeCalibration(input: {
  rest: TimedPoint[];
  circle: TimedPoint[];
  video: Size;
  canvas: Size;
  handedness: "Left" | "Right" | null;
  settings: PipelineSettings;
  /** Wall-clock for completedAt (defaults to Date.now()). */
  now?: number;
}): CalibrationResult {
  const { rest, circle, video, canvas, settings } = input;
  const { box, gain, tooSmall } = boxFromCircle(circle, video, canvas, 0.2);
  const oldGain = settings.gain > 0 ? settings.gain : 3;
  const restJitterRms = detrendedRms(rest) * (gain / oldGain);
  const circleCanvas: TimedPoint[] = circle.map((p) => {
    const c: Vec2 = mapToCanvas(p, box, canvas);
    return { x: c.x, y: c.y, t: p.t };
  });
  const kineticResidualRms = highFrequencyResidualRms(circleCanvas);
  // suggestFromRest assumes the rest jitter was measured at mincutoff 0.6; normalise.
  const mc = settings.filter.minCutoff > 0 ? settings.filter.minCutoff : 0.6;
  const restAtDefault = restJitterRms * (0.6 / mc);
  return {
    restJitterRms,
    kineticResidualRms,
    activeBox: box,
    gain,
    hand: handFromLabel(input.handedness),
    suggestedSteadiness: suggestSteadiness(restAtDefault, kineticResidualRms),
    circleTooSmall: tooSmall,
    completedAt: input.now ?? Date.now(),
  };
}
