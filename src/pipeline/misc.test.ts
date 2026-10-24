import { describe, expect, it } from "vitest";
import { boxFromCircle, defaultActiveBox, effectiveBox, mapToCamera, mapToCanvas } from "./activeBox";
import { contrastRatio, lowInkContrast } from "./contrast";
import { rms, rmsDeviation } from "./metrics";
import { steadinessToParams, suggestFromKinetic, suggestFromRest, suggestSteadiness } from "./steadiness";
import { circlePoints, dominantFrequency, frameTimes } from "./synth";
import { createTremorSimulator } from "./tremor";
import { COLOUR_HEX } from "@/actions";

const VIDEO = { w: 640, h: 480 };
const CANVAS = { w: 1280, h: 720 };

describe("steadiness", () => {
  it("hits the three knots exactly and interpolates linearly", () => {
    expect(steadinessToParams(0)).toEqual({ minCutoff: 1.2, lazyRadius: 4 });
    expect(steadinessToParams(50)).toEqual({ minCutoff: 0.6, lazyRadius: 12 });
    expect(steadinessToParams(100)).toEqual({ minCutoff: 0.3, lazyRadius: 30 });
    expect(steadinessToParams(25).minCutoff).toBeCloseTo(0.9);
    expect(steadinessToParams(75).lazyRadius).toBeCloseTo(21);
    expect(steadinessToParams(150)).toEqual(steadinessToParams(100));
  });

  it("suggestions grow with jitter and take the max of rest and kinetic", () => {
    expect(suggestFromRest(0)).toBe(0);
    expect(suggestFromRest(0.4)).toBeLessThan(suggestFromRest(3));
    expect(suggestFromKinetic(1)).toBeLessThan(suggestFromKinetic(6));
    expect(suggestFromKinetic(100)).toBe(100);
    expect(suggestSteadiness(0.4, 6)).toBe(Math.max(suggestFromRest(0.4), suggestFromKinetic(6)));
  });
});

describe("active box", () => {
  it("default box is canvas ÷ gain, centred, and maps to the full canvas", () => {
    const b = defaultActiveBox(VIDEO, CANVAS, 3);
    expect(b.w).toBeCloseTo(1280 / 3);
    expect(b.h).toBeCloseTo(240);
    expect(b.x + b.w / 2).toBeCloseTo(320);
    expect(mapToCanvas({ x: b.x, y: b.y }, b, CANVAS)).toEqual({ x: 0, y: 0 });
    const c = mapToCanvas({ x: b.x + b.w, y: b.y + b.h }, b, CANVAS);
    expect(c.x).toBeCloseTo(1280);
    expect(c.y).toBeCloseTo(720);
    const back = mapToCamera(mapToCanvas({ x: 200, y: 100 }, b, CANVAS), b, CANVAS);
    expect(back.x).toBeCloseTo(200);
    expect(back.y).toBeCloseTo(100);
    // no clamping
    expect(mapToCanvas({ x: 0, y: 0 }, b, CANVAS).x).toBeLessThan(0);
  });

  it("boxFromCircle pads 20 %, keeps the canvas aspect, gain = canvas.w ÷ box.w", () => {
    const circle = circlePoints({ x: 400, y: 260 }, 60, 120); // 120 px diameter
    const r = boxFromCircle(circle, VIDEO, CANVAS);
    // bbox height 120 × 1.2 = 144 → width 144 × 16/9 = 256 → gain 5
    expect(r.gain).toBeCloseTo(5, 1);
    expect(r.box.w / r.box.h).toBeCloseTo(16 / 9);
    expect(r.box.x + r.box.w / 2).toBeCloseTo(400, 0);
    expect(r.tooSmall).toBe(false);
  });

  it("boxFromCircle clamps gain to 2..10 and flags tiny circles", () => {
    const tiny = boxFromCircle(circlePoints({ x: 320, y: 240 }, 10, 60), VIDEO, CANVAS);
    expect(tiny.gain).toBe(10);
    expect(tiny.tooSmall).toBe(true);
    const huge = boxFromCircle(circlePoints({ x: 320, y: 240 }, 400, 60), VIDEO, CANVAS);
    expect(huge.gain).toBe(2);
  });

  it("effectiveBox keeps the calibrated centre and applies the live gain", () => {
    const cal = boxFromCircle(circlePoints({ x: 400, y: 260 }, 60, 120), VIDEO, CANVAS).box;
    const b = effectiveBox(cal, VIDEO, CANVAS, 4);
    expect(b.w).toBeCloseTo(320);
    expect(b.x + b.w / 2).toBeCloseTo(cal.x + cal.w / 2);
  });
});

describe("tremor simulator", () => {
  it("is band-limited to 4–10 Hz, ±4 px at rest, deterministic per seed", () => {
    const sim = createTremorSimulator(42);
    const ts = frameTimes(8, 60);
    const xs = ts.map((t) => sim.apply({ x: 0, y: 0 }, t).x);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(4 + 1e-9);
    expect(Math.max(...xs.map(Math.abs))).toBeGreaterThan(2);
    const f = dominantFrequency(xs, 60);
    expect(f).toBeGreaterThanOrEqual(4);
    expect(f).toBeLessThanOrEqual(10);
    const again = createTremorSimulator(42);
    expect(ts.map((t) => again.apply({ x: 0, y: 0 }, t).x)).toEqual(xs);
    const other = createTremorSimulator(43);
    expect(ts.map((t) => other.apply({ x: 0, y: 0 }, t).x)).not.toEqual(xs);
  });

  it("rises to ±8 px above 100 px/s", () => {
    const sim = createTremorSimulator(1);
    let maxOff = 0;
    for (const t of frameTimes(4, 30)) {
      const clean = { x: 150 * (t / 1000), y: 0 };
      const p = sim.apply(clean, t);
      if (t > 1000) maxOff = Math.max(maxOff, Math.abs(p.y));
    }
    expect(sim.amplitude).toBeCloseTo(8);
    expect(maxOff).toBeGreaterThan(4);
    expect(maxOff).toBeLessThanOrEqual(8 + 1e-9);
  });
});

describe("metrics + contrast", () => {
  it("rms / rmsDeviation", () => {
    expect(rms([3, 4])).toBeCloseTo(Math.sqrt(12.5));
    expect(rms([])).toBe(0);
    expect(rmsDeviation([{ x: 0, y: 0 }], [{ x: 3, y: 4 }])).toBe(5);
  });

  it("WCAG contrast ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#fff", "#fff")).toBeCloseTo(1);
    expect(lowInkContrast(COLOUR_HEX.yellow, "#ffffff")).toBe(true);
    expect(lowInkContrast(COLOUR_HEX.black, "#ffffff")).toBe(false);
  });
});
