import { expect, test } from 'vitest';
import { OneEuroFilter, scaledMAD } from '../../src/renderer/engine';

test('synthetic stationary jitter replay is deterministic and reports prescribed smoothing behavior', () => {
  const run = () => [0, 50, 100].map(smoothing => {
    const filter = new OneEuroFilter(smoothing), raw: number[] = [], filtered: number[] = [];
    for (let frame = 0; frame < 300; frame++) {
      // Synthetic normalized landmarks; not measured camera or human tremor data.
      const x = 0.5 + 0.002 * (frame % 2 ? 1 : -1) + 0.001 * Math.sin(frame * 0.7);
      const result = filter.process({ x, y: 0.5 }, frame * 1000 / 30);
      if (frame >= 30) { raw.push(x); filtered.push(result.x); }
    }
    const rms = (values: number[]) => Math.sqrt(values.reduce((total, value) => total + (value - 0.5) ** 2, 0) / values.length);
    return { smoothing, minCutoffHz: filter.minCutoff, rawScaledMAD: scaledMAD(raw), filteredScaledMAD: scaledMAD(filtered), rawRms: rms(raw), filteredRms: rms(filtered) };
  });
  const first = run(); expect(first).toEqual(run());
  for (const result of first) expect(result.filteredRms).toBeLessThan(result.rawRms);
  expect(first[2]!.filteredRms).toBeLessThan(first[0]!.filteredRms);
  console.info('ENGINE_JITTER_METRICS ' + JSON.stringify({ classification: 'replay', samples: 300, fps: 30, warmupFrames: 30, units: 'normalized camera coordinates', results: first, limitations: 'Synthetic stationary jitter only; no physical observations, processing latency, movement responsiveness or medical effectiveness established.' }));
});
