import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
export function resourcesRoot(): string { return app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources'); }
export function verifyResources(): void {
  const root = resourcesRoot();
  const manifest = JSON.parse(readFileSync(path.join(root, 'asset-manifest.json'), 'utf8')) as { assets: {path:string;sha256:string}[] };
  if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('Missing model/runtime manifest');
  for (const asset of manifest.assets) {
    const filename = path.resolve(root, 'assets', asset.path);
    if (!filename.startsWith(path.resolve(root,'assets')+path.sep)) throw new Error('Invalid asset path');
    const actual = createHash('sha256').update(readFileSync(filename)).digest('hex');
    if (actual !== asset.sha256) throw new Error(`Corrupt local asset: ${asset.path}`);
  }
}
