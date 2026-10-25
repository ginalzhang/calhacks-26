import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const manifest = JSON.parse(readFileSync('resources/asset-manifest.json', 'utf8'));
for (const asset of manifest.assets) {
  const destination = path.join('resources/assets', asset.path);
  if (process.argv.includes('--fetch')) {
    let bytes;
    if (asset.source.startsWith('https://registry.npmjs.org/')) {
      // Runtime is restored by npm ci from the locked package, never a CDN.
      const internalPath = asset.source.split('#')[1];
      bytes = readFileSync(path.join('node_modules/@mediapipe/tasks-vision', internalPath));
    } else {
      const response = await fetch(asset.source);
      if (!response.ok) throw new Error(`Asset fetch failed: ${asset.path}: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Asset hash mismatch: ${asset.path}`);
    mkdirSync(path.dirname(destination), { recursive: true }); writeFileSync(destination, bytes);
  }
  const bytes = readFileSync(destination);
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Asset hash mismatch: ${asset.path}`);
  console.log(`verified ${asset.path} (${bytes.length} bytes)`);
}
