import { readFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultSettings, isSettingsV1, type SettingsV1 } from '../shared/settings';
export class SettingsStore {
  constructor(private filename: string) {}
  load(): { settings: SettingsV1; warning: string | null } {
    try {
      const value: unknown = JSON.parse(readFileSync(this.filename, 'utf8'));
      if (!isSettingsV1(value)) throw new Error('Invalid settings schema');
      return { settings: value, warning: null };
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      return { settings: defaultSettings(), warning: missing ? null : 'Saved settings are invalid; setup is required.' };
    }
  }
  save(settings: SettingsV1): void {
    if (!isSettingsV1(settings)) throw new Error('Invalid settings schema');
    mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporary = this.filename + '.tmp';
    writeFileSync(temporary, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
    renameSync(temporary, this.filename);
  }
}
