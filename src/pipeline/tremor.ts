/**
 * Demo "Simulate tremor" (§7): band-limited 4–10 Hz noise added to RAW camera px before the
 * One Euro filter. Per axis it is a sum of four sinusoids with seeded random frequencies in
 * 4..10 Hz, random phases and slowly wandering amplitude weights, normalised so the peak is
 * the envelope amplitude: ±4 px at rest rising linearly to ±8 px at ≥ 100 px/s (speed of the
 * clean input in camera px/s, lightly smoothed). Seedable and deterministic for tests.
 */
import type { Vec2 } from "./types";

export const TREMOR_REST_AMP = 4;
export const TREMOR_MOVING_AMP = 8;
export const TREMOR_FULL_SPEED = 100;
export const TREMOR_BAND: [number, number] = [4, 10];

/** mulberry32: small, fast, seedable PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Component {
  f: number; // Hz
  phase: number; // rad
  w: number; // weight
  wobbleF: number; // Hz, slow amplitude wander
  wobblePhase: number;
}

export interface TremorSimulator {
  apply(p: Vec2, t: number): Vec2;
  reset(): void;
  /** Current envelope amplitude, px (for tests / the Demo panel). */
  readonly amplitude: number;
}

export function createTremorSimulator(seed = 1): TremorSimulator {
  const N = 4;
  let comps: { x: Component[]; y: Component[] };
  let lastP: Vec2 | null = null;
  let lastT = 0;
  let speed = 0;
  let amp = TREMOR_REST_AMP;

  const init = () => {
    const rnd = mulberry32(seed);
    const make = (): Component[] =>
      Array.from({ length: N }, () => ({
        f: TREMOR_BAND[0] + rnd() * (TREMOR_BAND[1] - TREMOR_BAND[0]),
        phase: rnd() * Math.PI * 2,
        w: 0.5 + rnd(),
        wobbleF: 0.1 + rnd() * 0.3,
        wobblePhase: rnd() * Math.PI * 2,
      }));
    comps = { x: make(), y: make() };
    lastP = null;
    speed = 0;
    amp = TREMOR_REST_AMP;
  };
  init();

  const sample = (cs: Component[], ts: number) => {
    let s = 0;
    let wsum = 0;
    for (const c of cs) {
      const w = c.w * (0.75 + 0.25 * Math.sin(2 * Math.PI * c.wobbleF * ts + c.wobblePhase));
      s += w * Math.sin(2 * Math.PI * c.f * ts + c.phase);
      wsum += w;
    }
    return wsum > 0 ? s / wsum : 0; // |s| <= 1
  };

  return {
    apply(p: Vec2, t: number): Vec2 {
      if (lastP) {
        const dt = (t - lastT) / 1000;
        if (dt > 0) {
          const v = Math.hypot(p.x - lastP.x, p.y - lastP.y) / dt;
          const k = Math.min(1, dt / 0.15); // ~150 ms smoothing of the speed estimate
          speed += (v - speed) * k;
        }
      }
      lastP = { x: p.x, y: p.y };
      lastT = t;
      amp = TREMOR_REST_AMP + (TREMOR_MOVING_AMP - TREMOR_REST_AMP) * Math.min(1, speed / TREMOR_FULL_SPEED);
      const ts = t / 1000;
      return { x: p.x + amp * sample(comps.x, ts), y: p.y + amp * sample(comps.y, ts) };
    },
    reset: init,
    get amplitude() {
      return amp;
    },
  };
}
