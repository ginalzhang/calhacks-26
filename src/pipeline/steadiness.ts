/**
 * Steadiness slider 0..100 → (One Euro mincutoff Hz, lazy radius px), piecewise linear through
 * 0 → (1.2, 4), 50 → (0.6, 12), 100 → (0.3, 30). 50 is exactly the §2 tested configuration.
 */
const KNOTS: { s: number; minCutoff: number; lazyRadius: number }[] = [
  { s: 0, minCutoff: 1.2, lazyRadius: 4 },
  { s: 50, minCutoff: 0.6, lazyRadius: 12 },
  { s: 100, minCutoff: 0.3, lazyRadius: 30 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function steadinessToParams(s: number): { minCutoff: number; lazyRadius: number } {
  const v = clamp(Number.isFinite(s) ? s : 50, 0, 100);
  const i = v <= 50 ? 0 : 1;
  const a = KNOTS[i];
  const b = KNOTS[i + 1];
  const u = (v - a.s) / (b.s - a.s);
  return { minCutoff: a.minCutoff + (b.minCutoff - a.minCutoff) * u, lazyRadius: a.lazyRadius + (b.lazyRadius - a.lazyRadius) * u };
}

/**
 * Rest-based suggestion: smallest Steadiness whose dead zone hides the rest jitter.
 * `restRms` is the One Euro output jitter in canvas px measured at mincutoff 0.6 (calibration
 * runs at defaults); post-filter jitter scales ≈ linearly with mincutoff for tremor well above
 * the cutoff, and its peak is ≈ 2–3 × RMS, so we require lazyRadius(s) ≥ 4 × restRms × mc(s)/0.6.
 */
export function suggestFromRest(restRms: number): number {
  if (!(restRms > 0)) return 0;
  for (let s = 0; s <= 100; s++) {
    const p = steadinessToParams(s);
    if (p.lazyRadius >= 4 * restRms * (p.minCutoff / 0.6)) return s;
  }
  return 100;
}

/** Visible wobble we accept while moving (canvas px RMS at the One Euro output). */
export const KINETIC_TARGET_RMS = 0.5;
/** Representative tremor frequency for the attenuation estimate (internal only; never shown). */
const TREMOR_HZ = 6;

/**
 * Kinetic suggestion: while moving the dead zone does not help, so the One Euro alone must
 * attenuate the high-frequency residual measured during the calibration circle (raw, canvas px).
 * First-order attenuation at f ≫ fc is ≈ fc / f, so we need mc(s) ≤ TREMOR_HZ × target / kinetic.
 */
export function suggestFromKinetic(kineticRms: number): number {
  if (!(kineticRms > 0)) return 0;
  const maxCutoff = (TREMOR_HZ * KINETIC_TARGET_RMS) / kineticRms;
  for (let s = 0; s <= 100; s++) if (steadinessToParams(s).minCutoff <= maxCutoff) return s;
  return 100;
}

/** Suggested Steadiness = the larger of the rest- and kinetic-based suggestions (0..100, integer). */
export function suggestSteadiness(restRms: number, kineticRms: number): number {
  return Math.max(suggestFromRest(restRms), suggestFromKinetic(kineticRms));
}
