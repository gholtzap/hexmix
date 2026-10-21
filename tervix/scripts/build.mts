import type {CapturedAsset} from '../../scripts/lib/assets.mts';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { assetKey } from './server.mts';
const manifest: CapturedAsset[] = JSON.parse(await readFile(new URL('../assets.json', import.meta.url), 'utf8'));
const files = new Map(manifest.map(asset => [assetKey(asset.request), asset]));
for (const asset of manifest) {
  assert(!asset.file.split(/[\\/]/).includes('..'), `Invalid asset path: ${asset.file}`);
  const file = await stat(new URL('../public/' + asset.file, import.meta.url));
  assert(file.isFile() && file.size === asset.bytes, `Missing or changed asset: ${asset.file}`);
}
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) || []) {
  const script = /^<script/i.test(tag);
  if (!script && !/\brel=["']stylesheet["']/i.test(tag)) continue;
  const source = tag.match(script ? /\bsrc=["']([^"']+)["']/i : /\bhref=["']([^"']+)["']/i)?.[1];
  if (!source) continue;
  assert(source.startsWith('/') && !source.startsWith('//'), `External script or stylesheet: ${source}`);
  assert(files.has(assetKey(source.replaceAll('&amp;', '&'))), `Unmapped script or stylesheet: ${source}`);
}
assert(html.includes('</html>'), 'Incomplete HTML');
console.log(`Offline build passed: HTML and ${manifest.length} assets verified.`);
