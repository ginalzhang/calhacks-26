import { describe, expect, it } from "vitest";
import { calibrateFaceTap, createFaceTap } from "./faceTap";

/** 30 fps samples of a score: rest level with tiny noise, plus open pulses [startMs, durMs]. */
function signal(totalMs: number, pulses: [number, number][], rest = 0.05, peak = 0.6) {
  const out: { t: number; v: number }[] = [];
  let seed = 7;
  const noise = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 0.02;
  };
  for (let t = 0; t <= totalMs; t += 1000 / 30) {
    const inPulse = pulses.some(([s, d]) => t >= s && t < s + d);
    out.push({ t, v: (inPulse ? peak : rest) + noise() });
  }
  return out;
}

const TH = { open: 0.35, close: 0.2 };

function run(samples: { t: number; v: number | null }[], suppressed: (t: number) => boolean = () => false) {
  const d = createFaceTap(TH);
  const taps: number[] = [];
  for (const s of samples) if (d.update(s.v, s.t, suppressed(s.t))) taps.push(s.t);
  return taps;
}

describe("face tap detector", () => {
  it("an open-and-close counts as exactly one tap", () => {
    const taps = run(signal(2000, [[500, 300]]));
    expect(taps.length).toBe(1);
    expect(taps[0]).toBeGreaterThanOrEqual(800);
  });

  it("holding the mouth open is never a tap", () => {
    expect(run(signal(4000, [[500, 2500]]))).toEqual([]);
  });

  it("a resting face with noise never taps", () => {
    expect(run(signal(10_000, []))).toEqual([]);
  });

  it("two separate taps count twice; a too-quick second one inside the refractory time does not", () => {
    expect(run(signal(3000, [[300, 250], [1500, 250]])).length).toBe(2);
    expect(run(signal(2000, [[300, 150], [500, 150]])).length).toBe(1);
  });

  it("flicker around one threshold does not produce taps (hysteresis)", () => {
    const s = [];
    for (let i = 0; i < 90; i++) s.push({ t: i * 33, v: i % 2 ? 0.3 : 0.25 }); // between close and open
    expect(run(s)).toEqual([]);
  });

  it("is suppressed while the mic is open and for the window after (caller decides)", () => {
    const sig = signal(3000, [[400, 300], [1800, 300]]);
    // Suppressed from 0..1000 ms: the first tap is ignored, the second counts.
    expect(run(sig, (t) => t < 1000).length).toBe(1);
    // A tap that STARTED while suppressed does not count even if it ends after.
    expect(run(signal(2000, [[400, 400]]), (t) => t < 500)).toEqual([]);
  });

  it("losing the face mid-open cancels the tap", () => {
    const sig: { t: number; v: number | null }[] = signal(2000, [[500, 300]]);
    for (const s of sig) if (s.t > 600 && s.t < 700) s.v = null;
    expect(run(sig)).toEqual([]);
  });
});

describe("face tap calibration (open your mouth comfortably twice)", () => {
  it("derives thresholds between rest and open from two opens", () => {
    const c = calibrateFaceTap(signal(5000, [[800, 600], [2800, 700]], 0.04, 0.55));
    expect(c).not.toBeNull();
    expect(c!.taps).toBe(2);
    expect(c!.open).toBeGreaterThan(c!.close);
    expect(c!.close).toBeGreaterThan(c!.baseline);
    expect(c!.open).toBeLessThan(c!.peak);
    // The derived thresholds detect a normal tap later.
    const d = createFaceTap(c!);
    let n = 0;
    for (const s of signal(2000, [[500, 300]], 0.04, 0.55)) if (d.update(s.v, s.t, false)) n++;
    expect(n).toBe(1);
  });

  it("rejects a recording with no clear movement or only one open", () => {
    expect(calibrateFaceTap(signal(5000, [], 0.05))).toBeNull();
    expect(calibrateFaceTap(signal(5000, [[1000, 600]]))).toBeNull();
    expect(calibrateFaceTap(signal(5000, [[800, 600], [2800, 600]], 0.05, 0.1))).toBeNull();
  });
});
