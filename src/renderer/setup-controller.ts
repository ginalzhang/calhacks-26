import type { CalibrationV1, DisplayInfo, Point, TrackingProbeMetrics, TrackingSample } from '../shared/contracts';
import type { SettingsV1 } from '../shared/settings';
import { CalibrationCapture, CalibrationSession, TrackingEngine, recenterCalibration, type CaptureStep } from './engine';

export interface SetupSnapshot {
  step: CaptureStep | null; active: boolean; calibrating: boolean; recentering: boolean;
  message: string; calibration: CalibrationV1 | null; position: Point | null;
  metrics: TrackingProbeMetrics; baseline: 'idle' | 'warmup' | 'measuring' | 'complete';
}
const emptyMetrics = (): TrackingProbeMetrics => ({ frames: 0, validFrames: 0, mappedFrames: 0, elapsedMs: 0, mappingHz: 0, receiptToMappedP95Ms: null, position: null, reason: 'No mapped samples' });
/** Panel-owned workflow, never sends input actions. Saved configuration is its only durable state. */
export class SetupController {
  private settings: SettingsV1 | null = null;
  private display: DisplayInfo | null = null;
  private generation = 0;
  private context = '';
  private engine: TrackingEngine | null = null;
  private session: CalibrationSession | null = null;
  private recenter: CalibrationCapture | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private baselineWarmupTimer: ReturnType<typeof setTimeout> | undefined;
  private baselineFinishTimer: ReturnType<typeof setTimeout> | undefined;
  private baselineStart: number | null = null;
  private latencies: number[] = [];
  private lastEmit = -Infinity;
  state: SetupSnapshot = { step: null, active: false, calibrating: false, recentering: false, message: 'Select a camera and start tracking, then calibrate.', calibration: null, position: null, metrics: emptyMetrics(), baseline: 'idle' };
  constructor(private changed: (snapshot: SetupSnapshot) => void, private save: (calibration: CalibrationV1) => Promise<void>, private mapped: (sample: TrackingSample, position: Point | null) => void, private recorded: (metrics: TrackingProbeMetrics) => void = () => {}) {}
  update(settings: SettingsV1 | undefined, display: DisplayInfo | undefined, generation: number): void {
    if (!settings) return;
    // Native JSON object key order can vary between otherwise identical replies.
    // Compare mapping geometry only; Spaces/work-area updates cannot cancel capture.
    const geometry = display ? [display.id, display.bounds.x, display.bounds.y, display.bounds.width, display.bounds.height, display.scaleFactor] : null;
    const key = JSON.stringify([settings.cameraId, settings.mode, settings.calibrations, geometry, generation]);
    if (key === this.context) return;
    this.cancel(false); this.context = key; this.settings = settings; this.display = display ?? null; this.generation = generation;
    const calibration = settings.calibrations.find(c => c.cameraId === settings.cameraId && c.mode === settings.mode) ?? null;
    this.state = { ...this.state, calibration, position: null, metrics: emptyMetrics(), baseline: 'idle', message: calibration ? 'Saved calibration loaded. Input paused; canvas confirmation requires Phase 03.' : 'Calibration required for this camera and mode.' };
    this.engine = calibration && display ? new TrackingEngine(calibration, display.bounds, generation) : null;
    this.emit();
  }
  begin(): void {
    if (!this.settings?.cameraId) throw new Error('Start a selected camera before calibrating.');
    this.cancel(false);
    this.session = new CalibrationSession({ cameraId: this.settings.cameraId, mode: this.settings.mode, generation: this.generation });
    this.state = { ...this.state, calibrating: true, step: 'neutral', message: 'Hold a neutral position. Capture samples for two seconds when you are ready.' };
    this.emit();
  }
  capture(): void {
    if (!this.session || this.state.active) throw new Error('Start calibration before Capture.');
    this.session.start(performance.now()); this.state.active = true; this.state.message = `Capturing ${this.session.step} for two seconds…`; this.emit();
    this.timer = setTimeout(() => { void this.finish(); }, 2005);
  }
  beginRecenter(): void {
    if (!this.settings || !this.state.calibration) throw new Error('Calibrate this camera and mode before recentering.');
    this.cancel(false);
    this.recenter = new CalibrationCapture({ cameraId: this.settings.cameraId, mode: this.settings.mode, generation: this.generation, selectedHand: this.state.calibration.selectedHand }, performance.now());
    this.state = { ...this.state, active: true, recentering: true, message: 'Capturing a new neutral for two seconds; directional extents will be preserved.' }; this.emit();
    this.timer = setTimeout(() => { void this.finish(); }, 2005);
  }
  private async finish(): Promise<void> {
    const session = this.session, recenter = this.recenter;
    const result = recenter ? recenter.finish(performance.now()) : session?.finish(performance.now());
    this.state.active = false;
    if (!result) return;
    if (!result.ok) { this.recenter = null; this.state.recentering = false; this.state.message = `${result.reason}. Retry Capture or Cancel.`; this.emit(); return; }
    const counts = `${result.capture.validSamples}/${result.capture.totalFrames} valid frames`;
    try {
      if (recenter && this.state.calibration) {
        const calibration = recenterCalibration(this.state.calibration, result.capture);
        await this.save(calibration); this.engine?.reset(calibration); this.recenter = null; this.state.recentering = false; this.state.calibration = calibration; this.state.message = `Recenter saved (${counts}). Extents preserved, filters reset, input paused.`;
      } else if (session?.step) {
        this.state.step = session.step; this.state.message = `Captured ${counts}. Move comfortably ${session.step}; press Capture when ready.`;
      } else if (session) {
        const calibration = session.build(); await this.save(calibration); this.session = null; this.state.calibrating = false; this.state.step = null; this.state.calibration = calibration;
        this.state.message = `Five-position calibration saved (${counts}). Input paused; canvas confirmation remains required.`;
      }
    } catch (error) { this.state.message = String(error); }
    this.emit();
  }
  cancel(emit = true): void {
    clearTimeout(this.timer); this.timer = undefined; this.session?.cancel(); this.session = null; this.recenter = null;
    this.state.active = false; this.state.calibrating = false; this.state.recentering = false; this.state.step = null; this.state.baseline = 'idle';
    this.engine?.reset(); this.baselineStart = null; clearTimeout(this.baselineWarmupTimer); clearTimeout(this.baselineFinishTimer);
    if (emit) { this.state.message = 'Calibration cancelled; input paused.'; this.emit(); }
  }
  startBaseline(): void {
    if (!this.engine) throw new Error('Complete calibration and select a display before measuring.');
    this.baselineStart = performance.now(); this.latencies = []; this.state.metrics = emptyMetrics(); this.state.baseline = 'warmup'; this.emit();
    clearTimeout(this.baselineWarmupTimer); clearTimeout(this.baselineFinishTimer);
    this.baselineWarmupTimer = setTimeout(() => { this.state.baseline = 'measuring'; this.emit(); }, 10_000);
    this.baselineFinishTimer = setTimeout(() => this.finishBaseline(), 70_000);
  }
  sample(sample: TrackingSample): void {
    const received = performance.now();
    this.session?.add(sample, received); this.recenter?.add(sample, received);
    const result = this.engine?.process(sample, received);
    const position = result?.valid ? result.position : null;
    this.state.position = position ?? null;
    this.mapped({ ...sample, valid: Boolean(position), anchor: position ? sample.anchor : null }, position ?? null);
    const started = this.baselineStart;
    if (started !== null) {
      const elapsed = received - started - 10_000;
      if (elapsed >= 0 && elapsed < 60_000) {
        this.state.baseline = 'measuring';
        const m = this.state.metrics; m.frames++; if (sample.valid) m.validFrames++; if (position) { m.mappedFrames++; this.latencies.push(performance.now() - received); }
        m.elapsedMs = elapsed; m.mappingHz = elapsed > 0 ? m.mappedFrames * 1000 / elapsed : 0;
        const sorted = [...this.latencies].sort((a, b) => a - b); m.receiptToMappedP95Ms = sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1]! : null;
        m.position = position ?? null; m.reason = result?.reason ?? 'Calibration required';
      } else if (elapsed >= 60_000) {
        this.finishBaseline();
      }
    }
    if (received - this.lastEmit >= 100 || this.state.baseline === 'complete') { this.lastEmit = received; this.emit(); }
  }
  private finishBaseline(): void {
    if (this.baselineStart === null) return;
    this.state.metrics.elapsedMs = 60_000; this.state.metrics.mappingHz = this.state.metrics.mappedFrames / 60;
    this.state.baseline = 'complete'; this.baselineStart = null; this.recorded(structuredClone(this.state.metrics)); this.emit();
  }
  snapshot(): SetupSnapshot { return structuredClone(this.state); }
  private emit(): void { this.changed(this.snapshot()); }
}
