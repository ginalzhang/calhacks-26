import type { Point } from '../../shared/contracts';
function alpha(cutoff: number, elapsedSeconds: number): number { return 1 / (1 + 1 / (2 * Math.PI * cutoff * elapsedSeconds)); }
/** One Euro on each normalized axis: beta=1 and derivative cutoff=1Hz. */
export class OneEuroFilter {
  private last: { raw: Point; filtered: Point; derivative: Point; timestamp: number } | null = null;
  constructor(readonly smoothing = 50) { if (!Number.isFinite(smoothing) || smoothing < 0 || smoothing > 100) throw new Error('Smoothing must be in [0,100]'); }
  get minCutoff(): number { return 4 - 0.034 * this.smoothing; }
  reset(): void { this.last = null; }
  process(position: Point, timestamp: number): Point {
    if (![position.x, position.y, timestamp].every(Number.isFinite) || timestamp < 0 || (this.last !== null && timestamp <= this.last.timestamp)) throw new Error('Filter needs finite coordinates and increasing timestamps');
    if (!this.last) { this.last = { raw: { ...position }, filtered: { ...position }, derivative: { x: 0, y: 0 }, timestamp }; return { ...position }; }
    const dt = (timestamp - this.last.timestamp) / 1000;
    const derivativeAlpha = alpha(1, dt), next: Point = { x: 0, y: 0 }, derivative: Point = { x: 0, y: 0 };
    for (const axis of ['x', 'y'] as const) {
      const rawDerivative = (position[axis] - this.last.raw[axis]) / dt;
      derivative[axis] = derivativeAlpha * rawDerivative + (1 - derivativeAlpha) * this.last.derivative[axis];
      const coordinateAlpha = alpha(this.minCutoff + Math.abs(derivative[axis]), dt);
      next[axis] = coordinateAlpha * position[axis] + (1 - coordinateAlpha) * this.last.filtered[axis];
    }
    this.last = { raw: { ...position }, filtered: next, derivative, timestamp };
    return { ...next };
  }
}
