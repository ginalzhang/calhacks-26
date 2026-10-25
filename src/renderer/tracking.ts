import type { Mode, Point, TrackingSample } from '../shared/contracts';

export interface Landmark { x: number; y: number }
export type HandLabel = 'Left' | 'Right';
export interface AnchorResult { valid: boolean; anchor: Point | null; reason: string }
/** Mirroring occurs exactly here, before samples leave the tracking worker. */
export function extractAnchor(mode: Mode, landmarks: Landmark[][]): AnchorResult {
  if (landmarks.length !== 1) return { valid: false, anchor: null, reason: landmarks.length ? 'multiple subjects' : 'no subject' };
  const points = mode === 'head' ? [landmarks[0]?.[1]] : [0, 5, 9, 13, 17].map(index => landmarks[0]?.[index]);
  if (points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return { valid: false, anchor: null, reason: 'invalid landmark' };
  const anchor = points.reduce((sum, point) => ({ x: sum.x + point!.x, y: sum.y + point!.y }), { x: 0, y: 0 });
  return { valid: true, anchor: { x: 1 - anchor.x / points.length, y: anchor.y / points.length }, reason: 'valid' };
}

/** Initialization fallback is bounded; an inference error never reinitializes. */
export async function initializeDelegate<T>(initialize: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<{ detector: T; delegate: 'GPU' | 'CPU' }> {
  try { return { detector: await initialize('GPU'), delegate: 'GPU' }; }
  catch { return { detector: await initialize('CPU'), delegate: 'CPU' }; }
}

export class FrameGate {
  private busy = false;
  acquire(): boolean { if (this.busy) return false; this.busy = true; return true; }
  release(): void { this.busy = false; }
}

/** A polling tick is not a camera frame. Each media timestamp can be used once. */
export class FrameProgress {
  private latest: { mediaTime: number; captureTimestamp: number } | null = null;
  private consumed = -Infinity;
  receive(mediaTime: number, receiptTimestamp: number, captureTimestamp?: number): void {
    if (!Number.isFinite(mediaTime) || !Number.isFinite(receiptTimestamp) || mediaTime < 0 || receiptTimestamp < 0 || mediaTime <= (this.latest?.mediaTime ?? -Infinity)) return;
    const timestamp = captureTimestamp !== undefined && Number.isFinite(captureTimestamp) && captureTimestamp >= 0 && captureTimestamp <= receiptTimestamp ? captureTimestamp : receiptTimestamp;
    this.latest = { mediaTime, captureTimestamp: timestamp };
  }
  take(): number | null {
    if (!this.latest || this.latest.mediaTime <= this.consumed) return null;
    this.consumed = this.latest.mediaTime; return this.latest.captureTimestamp;
  }
}

/** Results keep the original capture time. A fresh receipt cannot revive a stale frame. */
export class SampleGate {
  private frame = -1;
  private timestamp = -Infinity;
  accept(sample: TrackingSample, generation: number, mode: Mode, now: number): boolean {
    if (sample.generation !== generation || sample.mode !== mode || !Number.isSafeInteger(sample.frameId) || sample.frameId < 0 || sample.frameId <= this.frame || !Number.isFinite(sample.captureTimestamp) || sample.captureTimestamp < 0 || sample.captureTimestamp <= this.timestamp || sample.captureTimestamp > now || now - sample.captureTimestamp >= 250) return false;
    this.frame = sample.frameId; this.timestamp = sample.captureTimestamp; return true;
  }
}

/** Conservative continuity only: handedness and proximity never identify a person. */
export class SelectedHandContinuity {
  selectedHand: HandLabel | null = null;
  confirmationRequired = false;
  private previous: Point | null = null;
  private lastValid: number | null = null;
  private candidate: { anchor: Point; timestamp: number } | null = null;
  setSelectedHand(label: HandLabel | null, confirmed = false): void {
    this.selectedHand = label; this.confirmationRequired = label !== null && !confirmed;
    this.previous = null; this.lastValid = null; this.candidate = null;
  }
  /** Returns true only on the transition to declared loss, including camera stalls. */
  expire(now: number): boolean {
    if (this.selectedHand !== null && !this.confirmationRequired && this.lastValid !== null && now - this.lastValid >= 250) {
      this.confirmationRequired = true; this.previous = null; this.candidate = null; return true;
    }
    return false;
  }
  observe(result: AnchorResult, label: HandLabel | null, timestamp: number, now: number): AnchorResult {
    this.expire(now);
    if (!result.valid || !result.anchor) { this.candidate = null; return result; }
    if (!label) { this.candidate = null; return { valid: false, anchor: null, reason: 'missing handedness label' }; }
    if (this.selectedHand !== null && label !== this.selectedHand) { this.candidate = null; return { valid: false, anchor: null, reason: 'different hand label' }; }
    if (this.selectedHand === null) this.selectedHand = label;
    this.candidate = { anchor: result.anchor, timestamp };
    if (this.confirmationRequired) return { valid: false, anchor: null, reason: 'confirm selected hand' };
    if (this.previous && Math.hypot(result.anchor.x - this.previous.x, result.anchor.y - this.previous.y) > 0.12) return { valid: false, anchor: null, reason: 'hand anchor jump' };
    this.previous = result.anchor; this.lastValid = timestamp;
    return result;
  }
  confirm(now: number): boolean {
    if (!this.confirmationRequired || !this.candidate || now < this.candidate.timestamp || now - this.candidate.timestamp >= 250) return false;
    this.previous = this.candidate.anchor; this.lastValid = this.candidate.timestamp;
    this.confirmationRequired = false; return true;
  }
}

/** The preview is flipped once; inference consumes the original unflipped video. */
export function drawMirroredPreview(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  const context = canvas.getContext('2d');
  if (!context || !video.videoWidth || !video.videoHeight) return;
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
  context.save(); context.translate(canvas.width, 0); context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height); context.restore();
}
