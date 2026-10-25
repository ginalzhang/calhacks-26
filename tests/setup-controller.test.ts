import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetupController } from '../src/renderer/setup-controller';
import fixtures from '../fixtures/tracking-v1.json';
import { isCalibrationV1 } from '../src/renderer/engine';
import type { CalibrationV1, Point, TrackingSample } from '../src/shared/contracts';
import { defaultSettings } from '../src/shared/settings';
const display = { id: 1, bounds: { x: -1000, y: -200, width: 1000, height: 800 }, workArea: { x: -1000, y: -200, width: 1000, height: 800 }, builtIn: false, primary: false, scaleFactor: 1 };
const fixture = fixtures.calibration.positive[0];
if (!isCalibrationV1(fixture)) throw new Error('fixture invalid');
const calibration = fixture;
let frame = 0;
function sample(position: Point, valid = true): TrackingSample { return { generation: 1, frameId: ++frame, captureTimestamp: performance.now(), mode: 'head', valid, anchor: valid ? position : null, qualityReason: valid ? 'valid' : 'no subject' }; }
afterEach(() => vi.useRealTimers());
describe('integrated panel calibration workflow with fake input', () => {
  it('captures five positions, retries failure, saves only configuration and resets mapping on recenter', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const save = vi.fn<(c: CalibrationV1) => Promise<void>>().mockResolvedValue(undefined), mapped = vi.fn();
    const controller = new SetupController(() => {}, save, mapped);
    controller.update({ ...defaultSettings(), cameraId: calibration.cameraId }, display, 1);
    controller.begin(); controller.capture();
    await vi.advanceTimersByTimeAsync(2005);
    expect(controller.state.message).toContain('40 valid'); expect(controller.state.step).toBe('neutral');
    for (const position of [{ x: .5, y: .5 }, { x: .3, y: .5 }, { x: .8, y: .5 }, { x: .5, y: .3 }, { x: .5, y: .8 }]) {
      controller.capture();
      for (let i = 0; i < 60; i++) { controller.sample(sample(position)); await vi.advanceTimersByTimeAsync(1000 / 30); }
      await vi.advanceTimersByTimeAsync(6);
    }
    expect(save).toHaveBeenCalledOnce();
    const result = save.mock.calls[0]![0]; expect(result.gain).toBe(1); expect(result.smoothing).toBe(50);
    controller.update({ ...defaultSettings(), cameraId: calibration.cameraId, calibrations: [result] }, display, 1);
    controller.sample(sample({ x: .5, y: .5 })); expect(controller.state.position).toEqual({ x: -500, y: 200 });
    controller.beginRecenter();
    for (let i = 0; i < 60; i++) { controller.sample(sample({ x: .55, y: .55 })); await vi.advanceTimersByTimeAsync(1000 / 30); }
    await vi.advanceTimersByTimeAsync(6);
    expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1]![0].extents).toEqual(result.extents);
    expect(controller.state.message).toContain('input paused');
    controller.cancel(false);
  });
  it('keeps an active capture when a native reply changes only display JSON key order', () => {
    const controller = new SetupController(() => {}, async () => {}, () => {});
    const settings = { ...defaultSettings(), cameraId: calibration.cameraId };
    controller.update(settings, display, 1); controller.begin(); controller.capture();
    controller.update(settings, { scaleFactor: display.scaleFactor, primary: display.primary, builtIn: display.builtIn, workArea: { height: 800, width: 1000, y: -200, x: -1000 }, bounds: { height: 800, width: 1000, y: -200, x: -1000 }, id: display.id }, 1);
    expect(controller.state.active).toBe(true); expect(controller.state.calibrating).toBe(true);
    controller.cancel(false);
  });
  it('keeps capture across Spaces/work-area changes and cancels on actual mapped geometry changes', () => {
    const controller = new SetupController(() => {}, async () => {}, () => {});
    const settings = { ...defaultSettings(), cameraId: calibration.cameraId };
    controller.update(settings, display, 1); controller.begin(); controller.capture();
    controller.update(settings, { ...display, workArea: { ...display.workArea, y: -180, height: 780 }, primary: true }, 1);
    expect(controller.state.active).toBe(true);
    controller.update(settings, { ...display, bounds: { ...display.bounds, x: -1200 } }, 2);
    expect(controller.state.active).toBe(false); expect(controller.state.position).toBeNull();
    controller.cancel(false);
  });
  it('measures a complete baseline even if capture starves, and cancels on context changes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const recorded = vi.fn();
    const controller = new SetupController(() => {}, async () => {}, () => {}, recorded);
    const settings = { ...defaultSettings(), cameraId: calibration.cameraId, calibrations: [calibration] };
    controller.update(settings, display, 1); controller.startBaseline();
    await vi.advanceTimersByTimeAsync(70_000);
    expect(recorded).toHaveBeenCalledWith(expect.objectContaining({ mappedFrames: 0, mappingHz: 0, elapsedMs: 60_000 }));
    expect(controller.state.baseline).toBe('complete');
    controller.begin(); controller.capture(); controller.update({ ...settings, mode: 'palm' }, display, 2);
    expect(controller.state.active).toBe(false); expect(controller.state.calibration).toBeNull();
    await vi.advanceTimersByTimeAsync(3000); expect(controller.state.calibration).toBeNull();
  });
});
