import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const assets = JSON.parse(await readFile(new URL('./assets-manifest.json', import.meta.url), 'utf8'));
for (let i = 0; i < assets.length; i += 4) {
  await Promise.all(assets.slice(i, i + 4).map(async (asset) => {
    const target = path.join('public', asset.path);
    try { await access(target); return; } catch {}
    const response = await fetch(asset.url);
    if (!response.ok) throw new Error(`${response.status}: ${asset.url}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }));
}
console.log(`Saved ${assets.length} assets.`);
