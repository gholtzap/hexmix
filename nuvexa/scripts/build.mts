import type {CapturedAsset} from '../../scripts/lib/assets.mts';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { assetKey } from './server.mts';

const manifest: CapturedAsset[] = JSON.parse(await readFile(new URL('../assets.json', import.meta.url), 'utf8'));
const files = new Map(manifest.map(asset => [assetKey(asset.request), asset]));
const variants = new Set(manifest.map(asset => new URL(asset.request, 'http://localhost').pathname));
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const pages = [
  'success-stories', 'success-stories/story-a', 'success-stories/story-b', 'success-stories/story-c',
  'products/quotes-and-tenders', 'products/order-processing', 'integrations',
  'solutions/distributors', 'solutions/manufacturers', 'privacy', 'imprint', 'terms',
  'about', 'careers', 'contact',
];
const local = source => source.startsWith('/') && !source.startsWith('//');
const mapped = source => files.has(assetKey(source)) || variants.has(new URL(source, 'http://localhost').pathname);
for (const asset of manifest) {
  assert(!asset.file.split(/[\\/]/).includes('..') && !asset.file.startsWith('/'), `Invalid asset path: ${asset.file}`);
  const path = new URL('../public/' + asset.file, import.meta.url);
  const file = await stat(path);
  assert(file.isFile() && file.size === asset.bytes, `Missing or changed asset: ${asset.file}`);
  if (!/\.(?:mjs|js|css)$/.test(asset.file)) continue;
  const source = await readFile(path, 'utf8');
  assert(!/https?:\/\/(?:framerusercontent\.com|fonts\.gstatic\.com)\//.test(source), `Remote asset host in ${asset.file}`);
  if (!asset.file.endsWith('.mjs')) continue;
  for (const match of source.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)(["'`])([^"'`]+)\1/g)) {
    const dependency = match[2];
    if (!/\.mjs(?:\?|$)/.test(dependency) || dependency === 'https://framer.com/edit/init.mjs') continue;
    assert(dependency.startsWith('.') || local(dependency), `Nonlocal module ${dependency} in ${asset.file}`);
    const request = new URL(dependency, new URL(asset.request, 'http://localhost'));
    assert(mapped(request.pathname + request.search), `Missing module ${dependency} in ${asset.file}`);
  }
}
assert(!/https?:\/\/(?:framerusercontent\.com|fonts\.gstatic\.com)\//.test(html), 'Remote asset host in HTML');
for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
  const source = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (!source) continue;
  assert(local(source) && mapped(source.replaceAll('&amp;', '&')), `Unmapped script: ${source}`);
}
assert(html.includes('</html>'), 'Incomplete HTML');
for (const route of pages) {
  const page = await readFile(new URL(`../public/pages/${route}.html`, import.meta.url), 'utf8');
  assert(page.includes('</html>') && page.includes('/subpages.js'), `Incomplete page: ${route}`);
}
console.log(`Offline build passed: HTML and ${manifest.length} assets and module imports verified.`);
