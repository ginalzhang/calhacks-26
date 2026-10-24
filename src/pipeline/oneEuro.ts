/**
 * One Euro filter, one `1eurofilter` instance per axis (src/pipeline/oneEuro.ts, agent A).
 *
 * Runs on CAMERA px (design rule 3: filter before gain). Timestamps are injected in ms and
 * converted to seconds for the library, so the filter adapts to the real frame rate.
 *
 * Note on beta units: beta multiplies |speed| in the space the filter runs in (camera px/s).
 * The §2 acceptance targets are stated in canvas px at the default gain (3), so the tuned
 * beta below is the smallest value in 0.003..0.01 that passes all three targets there
 * (see oneEuro.test.ts and DECISIONS.md "[A] One Euro acceptance interpretation").
 */
import { OneEuroFilter } from "1eurofilter";
import type { FilterParams, Vec2 } from "./types";

/** Result of the §2/§9 beta sweep (smallest passing beta in 0.003..0.01 at mincutoff 0.6, gain 3). */
export const TUNED_BETA = 0.01;
/** DEFAULT_FILTER with the tuned beta. Use this until types.ts DEFAULT_FILTER is updated by the lead. */
export const TUNED_FILTER: FilterParams = { minCutoff: 0.6, beta: TUNED_BETA, dCutoff: 1.0 };

/** Nominal camera rate used only for the very first sample (afterwards timestamps drive the rate). */
const NOMINAL_HZ = 30;

export interface OneEuro2D {
  filter(p: Vec2, tMs: number): Vec2;
  reset(): void;
  setParams(p: FilterParams): void;
}

export function createOneEuro2D(params: FilterParams): OneEuro2D {
  let current = { ...params };
  const make = () => new OneEuroFilter(NOMINAL_HZ, current.minCutoff, current.beta, current.dCutoff);
  let fx = make();
  let fy = make();
  return {
    filter(p: Vec2, tMs: number): Vec2 {
      const ts = tMs / 1000;
      return { x: fx.filter(p.x, ts), y: fy.filter(p.y, ts) };
    },
    reset() {
      // Fresh instances also restore the nominal frequency estimate.
      fx = make();
      fy = make();
    },
    setParams(p: FilterParams) {
      current = { ...p };
      for (const f of [fx, fy]) {
        f.setMinCutoff(p.minCutoff);
        f.setBeta(p.beta);
        f.setDerivateCutoff(p.dCutoff);
      }
    },
  };
}
