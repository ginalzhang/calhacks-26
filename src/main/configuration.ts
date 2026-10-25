/** Serialize settings/generation/native configuration as one operation. */
export class ConfigurationQueue {
  private pending: Promise<void> = Promise.resolve();
  private count = 0;
  get busy(): boolean { return this.count > 0; }
  run<T>(change: () => Promise<T>): Promise<T> {
    this.count++;
    const result = this.pending.then(change).finally(() => { this.count--; });
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }
}
