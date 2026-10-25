import { describe, expect, it } from 'vitest';
import { freshPointer, mappedSampleAllowed, readyForControl } from '../src/main/input-gates';
import { defaultSettings } from '../src/shared/settings';
import type { CalibrationV1, ProbeStatus } from '../src/shared/contracts';
import fixtures from '../fixtures/tracking-v1.json';
const calibration = fixtures.calibration.positive[0] as CalibrationV1;
const status = (): ProbeStatus => ({ generation: 1, realInput: false, displays: [], collapsed: false, settingsOpen: false, fault: null,
  nativeClockReady: true, targetPid: 123, canvasConfirmed: true, canvas: { x: -1000, y: 0, width: 500, height: 500 },
  settings: { ...defaultSettings(), cameraId: calibration.cameraId, mode: calibration.mode, calibrations: [calibration] },
  native: { state: 'PAUSED', reason: 'test', buttonDown: false, foregroundTarget: 'org.krita', generation: 1, latestValidFrame: null,
    permissions: { accessibility: true, camera: 'authorized', microphone: 'notDetermined', speech: 'notDetermined' } } });
describe('main control prerequisites', () => {
  it('requires calibration, closed settings, synchronized helper, permission, target and canvas', () => {
    expect(readyForControl(status(), true)).toBeNull();
    for (const patch of [{ settingsOpen: true }, { nativeClockReady: false }, { targetPid: null }, { canvasConfirmed: false }, { settings: defaultSettings() }]) {
      expect(readyForControl({ ...status(), ...patch }, true)).not.toBeNull();
    }
    expect(readyForControl({ ...status(), canvasConfirmed: false, canvas: null }, false)).toBeNull();
    const s = status(); s.native!.foregroundTarget = 'org.other'; expect(readyForControl(s, true)).toContain('foreground');
    s.native!.foregroundTarget = 'org.krita'; s.native!.permissions.accessibility = false; expect(readyForControl(s, true)).toContain('permission');
  });
  it('rejects stale/generation/mode mapping and never reuses an invalid pointer', () => {
    const s = status();
    const sample = { generation: 1, frameId: 1, captureTimestamp: 1000, mode: calibration.mode, valid: true, anchor: { x: .5, y: .5 }, qualityReason: 'fixture' };
    expect(mappedSampleAllowed(sample, { x: -900, y: 200 }, s, 1000)).toBe(true);
    expect(mappedSampleAllowed(sample, { x: -900, y: 200 }, s, 1250)).toBe(false);
    expect(mappedSampleAllowed({ ...sample, generation: 0 }, { x: 0, y: 0 }, s, 1000)).toBe(false);
    expect(mappedSampleAllowed({ ...sample, captureTimestamp: 1001 }, { x: 0, y: 0 }, s, 1000)).toBe(false);
    const pointer = { position: { x: -900, y: 200 }, timestamp: 1000, generation: 1 };
    expect(freshPointer(pointer, 1, 1249)).toEqual(pointer.position);
    expect(freshPointer(pointer, 1, 1250)).toBeNull(); expect(freshPointer(pointer, 2, 1000)).toBeNull();
  });
});
