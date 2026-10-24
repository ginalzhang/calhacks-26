/**
 * Face tap (§3 P3), pure: a blendshape score (jawOpen, or browInnerUp as the alternative)
 * crossing an "open" threshold and coming back under a "close" threshold within a short time
 * is ONE tap. Holding it open is never a tap (no sustained effort required, and a long open
 * mouth while thinking or speaking does nothing). Hysteresis between the two thresholds stops
 * flicker. Suppression (mic open, 500 ms after the mic closes, paused, dialogs) is decided by
 * the caller and passed in per sample.
 */

export interface FaceTapThresholds {
  /** Score that counts as "open". */
  open: number;
  /** Score that counts as "closed again" (< open). */
  close: number;
}

export interface FaceTapOptions extends FaceTapThresholds {
  /** Shortest open→close that counts (filters single-frame noise). */
  minTapMs?: number;
  /** Longest open→close that counts; longer is a hold and is ignored. */
  maxTapMs?: number;
  /** Dead time after a tap before the next can start. */
  refractoryMs?: number;
}

export const FACE_TAP_DEFAULTS = { minTapMs: 80, maxTapMs: 900, refractoryMs: 400 } as const;
/** Mic suppression window after it closes (§3). */
export const MIC_SUPPRESS_MS = 500;

type Phase = "closed" | "open" | "holding";

export interface FaceTapDetector {
  /** Feed one sample. Returns true on the sample where a tap completes. */
  update(score: number | null, tMs: number, suppressed: boolean): boolean;
  reset(): void;
  readonly phase: Phase;
}

export function createFaceTap(opts: FaceTapOptions): FaceTapDetector {
  const o = { ...FACE_TAP_DEFAULTS, ...opts };
  let phase: Phase = "closed";
  let openedAt = 0;
  let lastTapAt = -Infinity;
  /** A sample while suppressed poisons the current open until the face closes again. */
  let tainted = false;

  return {
    get phase() {
      return phase;
    },
    reset() {
      phase = "closed";
      tainted = false;
    },
    update(score, t, suppressed) {
      if (score === null || !Number.isFinite(score)) {
        // Face lost: forget any half-finished tap; it must be seen closed before the next one.
        phase = "holding";
        tainted = false;
        return false;
      }
      if (suppressed) tainted = true;
      switch (phase) {
        case "closed":
          if (score >= o.open) {
            if (suppressed || t - lastTapAt < o.refractoryMs) {
              phase = "holding"; // must close again before anything counts
              tainted = true;
            } else {
              phase = "open";
              openedAt = t;
              tainted = false;
            }
          } else if (!suppressed) {
            tainted = false;
          }
          return false;
        case "open":
          if (t - openedAt > o.maxTapMs) {
            phase = "holding";
            return false;
          }
          if (score <= o.close) {
            phase = "closed";
            const dur = t - openedAt;
            if (!tainted && dur >= o.minTapMs) {
              lastTapAt = t;
              return true;
            }
          }
          return false;
        case "holding":
          if (score <= o.close) {
            phase = "closed";
            tainted = suppressed;
          }
          return false;
      }
    },
  };
}

export interface FaceTapCalibration extends FaceTapThresholds {
  baseline: number;
  peak: number;
  /** Taps the measured thresholds find in the calibration recording. */
  taps: number;
}

/** Smallest open-vs-rest difference we accept as a deliberate movement. */
export const MIN_FACE_RANGE = 0.12;

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

/**
 * "Open your mouth comfortably twice": derive thresholds from ~5 s of scores.
 * baseline = 20th percentile (rest), peak = 95th percentile (the two opens);
 * open = baseline + 55 % of the range, close = baseline + 30 %. Accepted only if the range is
 * large enough and the derived detector finds at least two taps in the recording (the opens may
 * be slow, so the check allows up to 1.5 s per open).
 */
export function calibrateFaceTap(samples: { t: number; v: number }[]): FaceTapCalibration | null {
  const vals = samples.map((s) => s.v).filter((v) => Number.isFinite(v));
  if (vals.length < 20) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const baseline = quantile(sorted, 0.2);
  const peak = quantile(sorted, 0.95);
  const range = peak - baseline;
  if (range < MIN_FACE_RANGE) return null;
  const open = baseline + 0.55 * range;
  const close = baseline + 0.3 * range;
  const det = createFaceTap({ open, close, maxTapMs: 1500, minTapMs: 60, refractoryMs: 200 });
  let taps = 0;
  for (const s of samples) if (det.update(s.v, s.t, false)) taps++;
  if (taps < 2) return null;
  return { open, close, baseline, peak, taps };
}
