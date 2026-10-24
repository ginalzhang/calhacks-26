/**
 * §2 / §9 acceptance targets at the One Euro output, in CANVAS px.
 *
 * Interpretation (DECISIONS.md "[A] One Euro acceptance interpretation"): the synthetic
 * signals are specified in canvas px (the same space the targets are measured in, so "0.75 px
 * = 15 % of ±5 px" and "32.5 px = 65 % of ±50 px" are coherent). Each sample is mapped into
 * camera px through the real default active box (gain 3, 640×480 video, 1280×720 canvas), run
 * through the real One Euro filter in camera px (filter before gain), and mapped back to
 * canvas px for measurement. Synthetic input at 30 fps; measurement starts after 1 s.
 */
import { describe, expect, it } from "vitest";
import { defaultActiveBox, mapToCamera, mapToCanvas } from "./activeBox";
import { createLazyBrush } from "./lazyBrush";
import { rms as metricsRms } from "./metrics";
import { createOneEuro2D, TUNED_BETA, TUNED_FILTER } from "./oneEuro";
import { dominantFrequency, frameTimes, lockInAmplitude } from "./synth";
import { DEFAULT_FILTER, DEFAULT_SETTINGS, type FilterParams, type Vec2 } from "./types";

const VIDEO = { w: 640, h: 480 };
const CANVAS = { w: 1280, h: 720 };
const FPS = 30;
const SECONDS = 6;
const Y0 = 360;

type Sample = { t: number; intended: Vec2; input: Vec2; out: Vec2 };

function runCanvasSignal(
  sig: (s: number) => { intended: Vec2; input: Vec2 },
  params: FilterParams,
  gain = DEFAULT_SETTINGS.gain,
  fps = FPS,
  seconds = SECONDS,
): Sample[] {
  const box = defaultActiveBox(VIDEO, CANVAS, gain);
  const f = createOneEuro2D(params);
  return frameTimes(seconds, fps).map((t) => {
    const { intended, input } = sig(t / 1000);
    const out = mapToCanvas(f.filter(mapToCamera(input, box, CANVAS), t), box, CANVAS);
    return { t, intended, input, out };
  });
}

const steady = (xs: Sample[]) => xs.filter((s) => s.t >= 1000);

// (a) 200 px/s ramp on x + 6 Hz ±5 px jitter on y.
const rampWithJitter = (s: number) => {
  const intended = { x: 100 + 200 * s, y: Y0 };
  return { intended, input: { x: intended.x, y: Y0 + 5 * Math.sin(2 * Math.PI * 6 * s) } };
};
// (b) 2 Hz ±50 px sinusoid on x.
const sinusoid = (s: number) => {
  const p = { x: 640 + 50 * Math.sin(2 * Math.PI * 2 * s), y: Y0 };
  return { intended: p, input: p };
};

function measureA(params: FilterParams, gain?: number): number {
  return metricsRms(steady(runCanvasSignal(rampWithJitter, params, gain)).map((s) => s.out.y - s.intended.y));
}
function measureB(params: FilterParams, gain?: number): number {
  const xs = steady(runCanvasSignal(sinusoid, params, gain)).map((s) => s.out.x);
  return (Math.max(...xs) - Math.min(...xs)) / 2; // peak amplitude (conservative vs. lock-in)
}
function measureC(params: FilterParams, gain?: number): number {
  const xs = steady(runCanvasSignal(rampWithJitter, params, gain));
  let best = 0;
  let bestErr = Infinity;
  for (let lag = 0; lag <= 500; lag += 1) {
    const err = metricsRms(xs.map((s) => s.out.x - (100 + 200 * ((s.t - lag) / 1000))));
    if (err < bestErr) {
      bestErr = err;
      best = lag;
    }
  }
  return best;
}
const passes = (p: FilterParams, gain?: number) => measureA(p, gain) <= 0.75 && measureB(p, gain) >= 32.5 && measureC(p, gain) <= 150;

describe("One Euro §2 acceptance (canvas px, default gain 3, 30 fps, after 1 s)", () => {
  const params = TUNED_FILTER;

  it("(a) 200 px/s ramp + 6 Hz ±5 px y jitter → RMS y residual ≤ 0.75 px", () => {
    const a = measureA(params);
    expect(a).toBeLessThanOrEqual(0.75);
  });

  it("(b) 2 Hz ±50 px x sinusoid → output amplitude ≥ 32.5 px", () => {
    const b = measureB(params);
    expect(b).toBeGreaterThanOrEqual(32.5);
    // Lock-in (fundamental) amplitude agrees with the peak measure.
    const xs = steady(runCanvasSignal(sinusoid, params));
    expect(lockInAmplitude(xs.map((s) => s.t), xs.map((s) => s.out.x - 640), 2)).toBeGreaterThanOrEqual(32.5);
  });

  it("(c) ramp lag (time shift minimising x error) ≤ 150 ms", () => {
    expect(measureC(params)).toBeLessThanOrEqual(150);
  });

  it("beta sweep 0.003–0.01 (mincutoff 0.6): TUNED_BETA is the smallest passing value", () => {
    const betas: number[] = [];
    for (let b = 0.003; b <= 0.01 + 1e-9; b += 0.0005) betas.push(Math.round(b * 10000) / 10000);
    const results = betas.map((beta) => {
      const p = { ...DEFAULT_FILTER, minCutoff: 0.6, beta };
      return { beta, a: measureA(p), b: measureB(p), c: measureC(p), ok: passes(p) };
    });
    const firstPass = results.find((r) => r.ok);
    expect(firstPass, JSON.stringify(results)).toBeDefined();
    expect(firstPass!.beta).toBe(TUNED_BETA);
    // The spec default 0.005 fails (b) under this interpretation; recorded in DECISIONS.md.
    const atDefault = results.find((r) => r.beta === 0.005)!;
    expect(atDefault.a).toBeLessThanOrEqual(0.75);
    expect(atDefault.c).toBeLessThanOrEqual(150);
    expect(atDefault.b).toBeLessThan(32.5);
  });

  it("reference: in the filter's own space (gain 1) the spec default beta 0.005 passes all three", () => {
    expect(passes({ minCutoff: 0.6, beta: 0.005, dCutoff: 1 }, 1)).toBe(true);
  });
});

describe("lazy-brush dead zone (§2, separate test)", () => {
  it("(i) a stationary point carrying (a)'s filtered y jitter never moves the pointer (R = 12)", () => {
    const xs = runCanvasSignal(
      (s) => ({ intended: { x: 640, y: Y0 }, input: { x: 640, y: Y0 + 5 * Math.sin(2 * Math.PI * 6 * s) } }),
      TUNED_FILTER,
    );
    const lb = createLazyBrush(12);
    const first = lb.update(xs[0].out);
    for (const s of xs.slice(1)) expect(lb.update(s.out)).toEqual(first);
  });

  it("(ii) a 300 px x-ramp ends exactly 12 px short of the cursor", () => {
    const lb = createLazyBrush(12);
    let last: Vec2 = lb.update({ x: 0, y: 100 });
    for (let i = 1; i <= 300; i++) last = lb.update({ x: i, y: 100 });
    expect(300 - last.x).toBeCloseTo(12, 9);
    expect(last.y).toBe(100);
  });

  it("(iii) during (a)'s ramp the pointer's y RMS is ≤ the One Euro output's y RMS (and not zero)", () => {
    const xs = runCanvasSignal(rampWithJitter, TUNED_FILTER);
    const lb = createLazyBrush(12);
    const ptr = xs.map((s) => ({ t: s.t, p: lb.update(s.out) }));
    const st = (v: { t: number }) => v.t >= 1000;
    const euroRms = metricsRms(xs.filter(st).map((s) => s.out.y - Y0));
    const ptrRms = metricsRms(ptr.filter(st).map((s) => s.p.y - Y0));
    expect(ptrRms).toBeLessThanOrEqual(euroRms);
    expect(ptrRms).toBeGreaterThan(0);
  });
});

describe("aliasing (documents the low-fps failure)", () => {
  // 10 Hz ±5 px tremor sampled at 15 fps folds to |10 − 15| = 5 Hz: inside the band where
  // intended movement and slow tremor live. The samples are identical (up to sign) to a real
  // 5 Hz movement, so no causal filter can tell them apart; the app warns below 25 fps.
  const tremor = (s: number) => ({ intended: { x: 640, y: Y0 }, input: { x: 640, y: Y0 + 5 * Math.sin(2 * Math.PI * 10 * s) } });

  it("the 15 fps samples of a 10 Hz tremor look like a 5 Hz signal", () => {
    const ts = frameTimes(4, 15);
    const ys = ts.map((t) => tremor(t / 1000).input.y);
    expect(dominantFrequency(ys, 15)).toBeCloseTo(5, 5);
    const fiveHz = ts.map((t) => Y0 - 5 * Math.sin(2 * Math.PI * 5 * (t / 1000)));
    ys.forEach((y, i) => expect(y).toBeCloseTo(fiveHz[i], 6));
  });

  it("the filtered residual at 15 fps is much worse than at 30 fps", () => {
    const r30 = metricsRms(steady(runCanvasSignal(tremor, TUNED_FILTER, 3, 30)).map((s) => s.out.y - Y0));
    const r15 = metricsRms(steady(runCanvasSignal(tremor, TUNED_FILTER, 3, 15)).map((s) => s.out.y - Y0));
    expect(r15).toBeGreaterThan(1.5 * r30);
  });
});

describe("createOneEuro2D", () => {
  it("passes the first sample through and smooths afterwards; reset restarts", () => {
    const f = createOneEuro2D(TUNED_FILTER);
    expect(f.filter({ x: 10, y: 20 }, 0)).toEqual({ x: 10, y: 20 });
    const p = f.filter({ x: 20, y: 20 }, 33.3);
    expect(p.x).toBeGreaterThan(10);
    expect(p.x).toBeLessThan(20);
    f.reset();
    expect(f.filter({ x: 50, y: 60 }, 100)).toEqual({ x: 50, y: 60 });
  });

  it("setParams changes the response live (higher mincutoff → less lag)", () => {
    const slow = createOneEuro2D({ minCutoff: 0.3, beta: 0, dCutoff: 1 });
    const fast = createOneEuro2D({ minCutoff: 0.3, beta: 0, dCutoff: 1 });
    fast.setParams({ minCutoff: 3, beta: 0, dCutoff: 1 });
    slow.filter({ x: 0, y: 0 }, 0);
    fast.filter({ x: 0, y: 0 }, 0);
    const a = slow.filter({ x: 100, y: 0 }, 33);
    const b = fast.filter({ x: 100, y: 0 }, 33);
    expect(b.x).toBeGreaterThan(a.x);
  });
});
