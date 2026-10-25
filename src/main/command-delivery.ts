import type { LocalActionID } from '../shared/contracts';
import type { ConfigurationQueue } from './configuration';

/** Bind command intent to the configuration visible when it was received. */
export function deliverCommand<T>(queue: ConfigurationQueue, generation: () => number, action: LocalActionID, execute: () => Promise<T>): Promise<T> {
  if (action === 'pause' || action === 'penUp') return execute();
  if (queue.busy) return Promise.reject(new Error('Command discarded: control configuration is busy. Retry explicitly.'));
  const receivedGeneration = generation();
  return queue.run(async () => {
    if (generation() !== receivedGeneration) throw new Error('Command discarded: control configuration changed. Retry explicitly.');
    return execute();
  });
}
