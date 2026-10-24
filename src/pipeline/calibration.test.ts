import { describe, expect, it } from "vitest";
import { analyzeCalibration, detrendedRms, handFromLabel, highFrequencyResidualRms } from "./calibration";
import { suggestFromKinetic, suggestFromRest } from "./steadiness";
import { frameTimes, gaussian } from "./synth";
import { DEFAULT_SETTINGS, type TimedPoint } from "./types";

const VIDEO = { w: 640, h: 480 };
const CANVAS = { w: 1280, h: 720 };

const circle = (r: number, tremorPx = 0, hz = 6): TimedPoint[] =>
  frameTimes(4, 30, 3000).map((t) => {
    const a = (2 * Math.PI * (t - 3000)) / 4000;
    const s = t / 1000;
    return { x: 320 + r * Math.cos(a) + tremorPx * Math.sin(2 * Math.PI * hz * s), y: 240 + r * Math.sin(a) + tremorPx * Math.cos(2 * Math.PI * (hz + 0.7) * s), t };
  });
const rest = (sigma: number, drift = 0): TimedPoint[] => {
  const g = gaussian(4);
  return frameTimes(3, 30).map((t) => ({ x: 640 + drift * (t / 1000) + sigma * g(), y: 360 + sigma * g(), t }));
};

describe("calibration helpers", () => {
  it("detrendedRms ignores slow drift", () => {
    expect(detrendedRms(rest(0, 20))).toBeCloseTo(0, 6);
    const r = detrendedRms(rest(1, 20));
    expect(r).toBeGreaterThan(1.2); // 2D RMS of σ=1 per axis ≈ √2
    expect(r).toBeLessThan(1.6);
  });

  it("highFrequencyResidualRms removes the slow circle but keeps 6 Hz tremor", () => {
    expect(highFrequencyResidualRms(circle(80))).toBeLessThan(0.3);
    const withTremor = highFrequencyResidualRms(circle(80, 5)); // 2D RMS of ±5 px on both axes = 5 px
    expect(withTremor).toBeGreaterThan(3.5);
    expect(withTremor).toBeLessThan(6);
  });

  it("MediaPipe handedness on an unmirrored frame is swapped", () => {
    expect(handFromLabel("Left")).toBe("right");
    expect(handFromLabel("Right")).toBe("left");
    expect(handFromLabel(null)).toBe("unknown");
  });
});

describe("analyzeCalibration", () => {
  it("circle → padded box, gain, hand; steady hand → low suggestion", () => {
    const r = analyzeCalibration({ rest: rest(0.2), circle: circle(60), video: VIDEO, canvas: CANVAS, handedness: "Left", settings: DEFAULT_SETTINGS, now: 123 });
    // 120 px circle × 1.2 = 144 tall → 256 wide at 16:9 → gain 5
    expect(r.gain).toBeCloseTo(5, 1);
    expect(Math.abs(r.activeBox.w - 256)).toBeLessThan(2); // 2–98th percentile bbox
    expect(r.circleTooSmall).toBe(false);
    expect(r.hand).toBe("right");
    expect(r.completedAt).toBe(123);
    // rest jitter rescaled from gain 3 to gain 5
    expect(r.restJitterRms).toBeCloseTo(detrendedRms(rest(0.2)) * (r.gain / 3), 6);
    expect(r.suggestedSteadiness).toBeLessThanOrEqual(20);
  });

  it("tiny circle → gain 10 and circleTooSmall", () => {
    const r = analyzeCalibration({ rest: rest(0.2), circle: circle(8), video: VIDEO, canvas: CANVAS, handedness: null, settings: DEFAULT_SETTINGS });
    expect(r.gain).toBe(10);
    expect(r.circleTooSmall).toBe(true);
  });

  it("kinetic tremor raises the suggestion; suggestion = max(rest, kinetic)", () => {
    const steady = analyzeCalibration({ rest: rest(0.2), circle: circle(60), video: VIDEO, canvas: CANVAS, handedness: null, settings: DEFAULT_SETTINGS });
    const shaky = analyzeCalibration({ rest: rest(0.2), circle: circle(60, 3), video: VIDEO, canvas: CANVAS, handedness: null, settings: DEFAULT_SETTINGS });
    expect(shaky.kineticResidualRms).toBeGreaterThan(steady.kineticResidualRms * 5);
    expect(shaky.suggestedSteadiness).toBeGreaterThan(steady.suggestedSteadiness);
    expect(shaky.suggestedSteadiness).toBe(Math.max(suggestFromRest(shaky.restJitterRms), suggestFromKinetic(shaky.kineticResidualRms)));
  });

  it("rest jitter alone can drive the suggestion", () => {
    const r = analyzeCalibration({ rest: rest(4), circle: circle(60), video: VIDEO, canvas: CANVAS, handedness: null, settings: DEFAULT_SETTINGS });
    expect(r.suggestedSteadiness).toBe(suggestFromRest(r.restJitterRms));
    expect(r.suggestedSteadiness).toBeGreaterThan(50);
  });
});
