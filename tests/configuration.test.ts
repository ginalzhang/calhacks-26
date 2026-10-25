import { expect, it } from 'vitest';
import { ConfigurationQueue } from '../src/main/configuration';
it('keeps settings/generation/configure atomic across asynchronous acknowledgments and recovers after rejection', async () => {
  const queue = new ConfigurationQueue();
  let release!: () => void;
  const acknowledgment = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  let generation = 1;
  const first = queue.run(async () => { events.push(`camera:${++generation}`); await acknowledgment; events.push(`configured:${generation}`); });
  const failing = queue.run(async () => { events.push(`calibration:${++generation}`); throw new Error('rejected'); });
  const rejected = expect(failing).rejects.toThrow('rejected');
  const last = queue.run(async () => { events.push(`display:${++generation}`); return generation; });
  await Promise.resolve(); expect(events).toEqual(['camera:2']);
  release(); await first; await rejected; expect(await last).toBe(4);
  expect(events).toEqual(['camera:2', 'configured:2', 'calibration:3', 'display:4']);
});
