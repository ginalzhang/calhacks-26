import type { Rect } from '../shared/contracts';
export interface MappingDisplay { id: number; bounds: Rect; scaleFactor: number; rotation: number }
/** Work-area animation/fullscreen/Spaces notifications do not change mapped geometry. */
export function displayLayoutKey(displays: readonly MappingDisplay[]): string {
  return JSON.stringify([...displays].sort((a, b) => a.id - b.id).map(d => [d.id, d.bounds.x, d.bounds.y, d.bounds.width, d.bounds.height, d.scaleFactor, d.rotation]));
}
export class DisplayLayoutGuard {
  private key: string;
  constructor(displays: readonly MappingDisplay[]) { this.key = displayLayoutKey(displays); }
  changed(displays: readonly MappingDisplay[]): boolean {
    const next = displayLayoutKey(displays);
    if (next === this.key) return false;
    this.key = next; return true;
  }
}
