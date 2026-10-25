export interface ClockRoundTrip { sent: number; received: number; remote: number }
export interface ClockEstimate { offset: number; uncertainty: number }
export function estimateClock(roundTrips: ClockRoundTrip[]): ClockEstimate {
  if (roundTrips.length !== 8) throw new Error('Eight clock round trips required');
  if (roundTrips.some(sample => !Number.isFinite(sample.sent) || !Number.isFinite(sample.received) || !Number.isFinite(sample.remote) || sample.received < sample.sent)) throw new Error('Invalid monotonic clock sample');
  const best = [...roundTrips].sort((a, b) => (a.received - a.sent) - (b.received - b.sent))[0]!;
  return { offset: best.remote - (best.sent + best.received) / 2, uncertainty: (best.received - best.sent) / 2 };
}
