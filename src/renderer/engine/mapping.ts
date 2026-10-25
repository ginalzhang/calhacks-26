import type { CalibrationV1, Point, Rect, TrackingSample } from '../../shared/contracts';
import { isCalibrationV1, normalizedPoint } from './calibration';
import { OneEuroFilter } from './filter';
const displayValid = (display: Rect): boolean => [display.x, display.y, display.width, display.height, display.x + display.width, display.y + display.height].every(Number.isFinite) && display.width > 0 && display.height > 0;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
export function mapPosition(position: Point, calibration: CalibrationV1, display: Rect): Point {
  if (!normalizedPoint(position) || !isCalibrationV1(calibration) || !displayValid(display)) throw new Error('Invalid mapping input');
  const dx = position.x - calibration.neutral.x, dy = position.y - calibration.neutral.y;
  return { x: display.x + display.width * clamp(0.5 + 0.5 * calibration.gain * dx / (dx < 0 ? calibration.extents.left : calibration.extents.right)), y: display.y + display.height * clamp(0.5 + 0.5 * calibration.gain * dy / (dy < 0 ? calibration.extents.up : calibration.extents.down)) };
}
export interface EngineResult { valid: boolean; position: Point | null; reason: string }
/** Invalid input never advances a pointer. A declared 250ms loss resets smoothing. */
export class TrackingEngine {
  private filter: OneEuroFilter;
  private latestFrame = -1;
  private latestTimestamp = -Infinity;
  private latestValidTimestamp = -Infinity;
  private calibration: CalibrationV1;
  private display: Rect;
  private generation: number;
  constructor(calibration: CalibrationV1, display: Rect, generation: number) {
    if (!isCalibrationV1(calibration) || !displayValid(display) || !Number.isSafeInteger(generation) || generation < 0) throw new Error('Invalid engine configuration');
    this.calibration = structuredClone(calibration); this.display = { ...display }; this.generation = generation; this.filter = new OneEuroFilter(calibration.smoothing);
  }
  reset(calibration = this.calibration, display = this.display, generation = this.generation): void {
    if (!isCalibrationV1(calibration) || !displayValid(display) || !Number.isSafeInteger(generation) || generation < 0) throw new Error('Invalid engine configuration');
    this.calibration = structuredClone(calibration); this.display = { ...display }; this.generation = generation;
    this.filter = new OneEuroFilter(calibration.smoothing); this.latestFrame = -1; this.latestTimestamp = -Infinity; this.latestValidTimestamp = -Infinity;
  }
  process(sample: TrackingSample, now: number): EngineResult {
    const reject = (reason: string): EngineResult => ({ valid: false, position: null, reason });
    if (!Number.isFinite(now) || now < 0 || !Number.isFinite(sample.captureTimestamp) || sample.captureTimestamp < 0 || sample.captureTimestamp > now) return reject('invalid timestamp');
    if (sample.generation !== this.generation) return reject('expired generation');
    if (sample.mode !== this.calibration.mode) return reject('mode changed; applicable calibration required');
    if (!Number.isSafeInteger(sample.frameId) || sample.frameId < 0 || sample.frameId <= this.latestFrame || sample.captureTimestamp <= this.latestTimestamp) return reject('out-of-order sample');
    this.latestFrame = sample.frameId; this.latestTimestamp = sample.captureTimestamp;
    if (now - this.latestValidTimestamp >= 250) this.filter.reset();
    if (now - sample.captureTimestamp >= 250) return reject('stale sample');
    if (sample.valid !== true || !normalizedPoint(sample.anchor)) return reject(sample.qualityReason || 'invalid anchor');
    if (this.calibration.mode === 'palm' && sample.selectedHand !== this.calibration.selectedHand) return reject('different selected hand');
    const filtered = this.filter.process(sample.anchor, sample.captureTimestamp);
    this.latestValidTimestamp = sample.captureTimestamp;
    return { valid: true, position: mapPosition(filtered, this.calibration, this.display), reason: 'valid' };
  }
}
