import { describe, expect, test } from 'vitest';
import { isCalibrationV1, mapPosition, OneEuroFilter, TrackingEngine } from '../../src/renderer/engine';
import type { CalibrationV1, Point, TrackingSample } from '../../src/shared/contracts';
const calibration: CalibrationV1 = { schemaVersion: 1, cameraId: 'camera-1', mode: 'head', selectedHand: null, neutral: { x: 0.5, y: 0.5 }, extents: { left: 0.2, right: 0.3, up: 0.1, down: 0.2 }, jitter: { x: 0.001, y: 0.001 }, gain: 1, smoothing: 50 };
const display = { x: -1920, y: -200, width: 1920, height: 1080 };
const sample = (id: number, time: number, point: Point | null = { x: 0.5, y: 0.5 }): TrackingSample => ({ generation: 5, frameId: id, captureTimestamp: time, mode: 'head', valid: point !== null, anchor: point, qualityReason: point ? 'valid' : 'no subject' });

describe('absolute directional mapping', () => {
  test('neutral and four bounds map to display center/edges in negative-origin logical points', () => {
    expect(mapPosition({ x: 0.5, y: 0.5 }, calibration, display)).toEqual({ x: -960, y: 340 });
    expect(mapPosition({ x: 0.3, y: 0.4 }, calibration, display)).toMatchObject({ x: -1920, y: expect.closeTo(-200) });
    expect(mapPosition({ x: 0.8, y: 0.7 }, calibration, display)).toMatchObject({ x: 0, y: expect.closeTo(880) });
    expect(mapPosition({ x: 0.4, y: 0.6 }, calibration, display)).toMatchObject({ x: expect.closeTo(-1440), y: expect.closeTo(610) });
  });
  test('gain uses prescribed multiplier and clamps fractions without substituting directional bounds', () => {
    expect(mapPosition({ x: 0.4, y: 0.6 }, { ...calibration, gain: 0.5 }, display)).toMatchObject({ x: expect.closeTo(-1200), y: expect.closeTo(475) });
    expect(mapPosition({ x: 0, y: 1 }, { ...calibration, gain: 3 }, display)).toEqual({ x: -1920, y: 880 });
    expect(() => mapPosition({ x: 0.4, y: 0.6 }, { ...calibration, gain: 3.001 }, display)).toThrow();
  });
  test('rejects invalid coordinates/display and preserves exact calibration', () => {
    expect(() => mapPosition({ x: NaN, y: 0.5 }, calibration, display)).toThrow();
    expect(() => mapPosition({ x: 0.5, y: 0.5 }, calibration, { ...display, width: 0 })).toThrow();
    expect(isCalibrationV1(calibration)).toBe(true);
  });
});

describe('prescribed One Euro filter', () => {
  test('default and endpoint cutoffs implement exact slider formula', () => {
    expect(new OneEuroFilter().minCutoff).toBe(4 - 0.034 * 50);
    expect(new OneEuroFilter(0).minCutoff).toBe(4); expect(new OneEuroFilter(100).minCutoff).toBeCloseTo(0.6);
    expect(() => new OneEuroFilter(-1)).toThrow(); expect(() => new OneEuroFilter(101)).toThrow();
  });
  test('matches independently calculated beta=1/derivative=1Hz update and reset', () => {
    const filter = new OneEuroFilter(50); expect(filter.process({ x: 0.5, y: 0.5 }, 0)).toEqual({ x: 0.5, y: 0.5 });
    const dt = 1 / 30, aDerivative = 1 / (1 + 1 / (2 * Math.PI * dt)), dx = aDerivative * 0.03 / dt;
    const a = 1 / (1 + 1 / (2 * Math.PI * (2.3 + Math.abs(dx)) * dt));
    const actual = filter.process({ x: 0.53, y: 0.5 }, 1000 / 30);
    expect(actual.x).toBeCloseTo(0.5 + a * 0.03, 12); expect(actual.y).toBe(0.5);
    filter.reset(); expect(filter.process({ x: 0.9, y: 0.3 }, 0)).toEqual({ x: 0.9, y: 0.3 });
  });
  test('holding still remains still and timestamp order is enforced', () => {
    const filter = new OneEuroFilter(); for (let index = 0; index < 100; index++) expect(filter.process({ x: 0.6, y: 0.4 }, index * 33)).toEqual({ x: 0.6, y: 0.4 });
    expect(() => filter.process({ x: 0.6, y: 0.4 }, 0)).toThrow();
  });
});

describe('deterministic guarded engine replay', () => {
  test('replays identically; rejects generation/mode/invalid/stale/out-of-order frames', () => {
    const engine = new TrackingEngine(calibration, display, 5);
    expect(engine.process({ ...sample(0, 0), generation: 4 }, 0).reason).toBe('expired generation');
    expect(engine.process({ ...sample(0, 0), mode: 'palm' }, 0).valid).toBe(false);
    expect(engine.process(sample(0, 0), 0).valid).toBe(true);
    expect(engine.process(sample(0, 1), 1).reason).toBe('out-of-order sample');
    expect(engine.process(sample(1, 0), 1).valid).toBe(false);
    expect(engine.process(sample(1, 33, null), 33)).toMatchObject({ valid: false, position: null });
    expect(engine.process(sample(2, 66), 316).reason).toBe('stale sample');
    expect(engine.process(sample(3, 400), 399).reason).toBe('invalid timestamp');
    const replay = (): unknown[] => { engine.reset(); return Array.from({ length: 60 }, (_, index) => engine.process(sample(index, index * 33, { x: 0.5 + 0.01 * Math.sin(index), y: 0.5 }), index * 33)); };
    expect(replay()).toEqual(replay());
  });
  test('250ms loss and explicit resets clear filter memory; rejected samples never map', () => {
    const engine = new TrackingEngine(calibration, display, 5);
    engine.process(sample(0, 0), 0); engine.process(sample(1, 33, { x: 0.51, y: 0.5 }), 33);
    expect(engine.process(sample(2, 283, { x: 0.6, y: 0.5 }), 283).position).toEqual(mapPosition({ x: 0.6, y: 0.5 }, calibration, display));
    const moved = { ...calibration, neutral: { x: 0.6, y: 0.6 } };
    engine.reset(moved, display, 6);
    expect(engine.process({ ...sample(0, 0, { x: 0.6, y: 0.6 }), generation: 6 }, 0).position).toEqual({ x: -960, y: 340 });
    expect(engine.process(sample(1, 33), 33).valid).toBe(false);
  });
  test('selected palm label remains bound to saved calibration', () => {
    const engine = new TrackingEngine({ ...calibration, mode: 'palm', selectedHand: 'Left' }, display, 5);
    expect(engine.process({ ...sample(0, 0), mode: 'palm', selectedHand: 'Right' }, 0).reason).toBe('different selected hand');
    expect(engine.process({ ...sample(1, 33), mode: 'palm', selectedHand: 'Left' }, 33).valid).toBe(true);
  });
});
