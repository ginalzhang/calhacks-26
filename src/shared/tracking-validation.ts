import type { TrackingSample } from './contracts';
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const safe = (x: unknown): boolean => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
export function isTrackingSample(value: unknown): value is TrackingSample {
  if (!object(value)) return false;
  const required = ['generation', 'frameId', 'captureTimestamp', 'mode', 'valid', 'anchor', 'qualityReason'];
  if (required.some(k => !(k in value)) || Object.keys(value).some(k => ![...required, 'selectedHand'].includes(k))) return false;
  if (!safe(value.generation) || !safe(value.frameId) || typeof value.captureTimestamp !== 'number' || !Number.isFinite(value.captureTimestamp) || value.captureTimestamp < 0 || !['head', 'palm'].includes(value.mode as string) || typeof value.valid !== 'boolean' || typeof value.qualityReason !== 'string') return false;
  const p = value.anchor;
  if (value.valid ? !object(p) || Object.keys(p).sort().join(',') !== 'x,y' || !['x', 'y'].every(k => typeof p[k] === 'number' && Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1) : p !== null) return false;
  return value.selectedHand === undefined || value.selectedHand === null || value.selectedHand === 'Left' || value.selectedHand === 'Right';
}
