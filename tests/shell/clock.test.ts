import { describe, expect, it } from 'vitest';
import { estimateClock } from '../../src/preload/clock';

describe('renderer to main monotonic clock synchronization', () => {
  it('selects smallest of eight round trips and converts the capture time', () => {
    const trips = Array.from({ length: 8 }, (_, i) => ({ sent: 100, received: 120 + i, remote: 610 + i / 2 }));
    trips[4] = { sent: 200, received: 202, remote: 701 };
    const estimate = estimateClock(trips);
    expect(estimate).toEqual({ offset: 500, uncertainty: 1 });
    expect(50 + estimate.offset).toBe(550);
  });
  it('exposes uncertainty above the 10 ms block threshold', () => {
    expect(estimateClock(Array.from({ length: 8 }, () => ({ sent: 0, received: 22, remote: 100 }))).uncertainty).toBe(11);
  });
  it('rejects missing, nonfinite and reversed clock samples', () => {
    expect(() => estimateClock([])).toThrow('Eight');
    expect(() => estimateClock(Array.from({ length: 8 }, () => ({ sent: 2, received: 1, remote: 3 })))).toThrow('Invalid');
    expect(() => estimateClock(Array.from({ length: 8 }, () => ({ sent: 1, received: 2, remote: Infinity })))).toThrow('Invalid');
  });
});
