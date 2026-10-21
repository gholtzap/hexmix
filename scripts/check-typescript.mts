import assert from 'node:assert/strict';
import {readdir, readFile, access} from 'node:fs/promises';
import path from 'node:path';

const outputs: Record<string,string> = JSON.parse(await readFile('scripts/browser-files.json','utf8'));
const generated = new Set([...Object.keys(outputs),'postcss.config.mjs']);
const skip = new Set(['node_modules','.next','.git','artifacts','out','dist','coverage','playwright-report','test-results']);
const unexpected: string[] = [];
async function scan(directory = '.') {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    if (skip.has(entry.name)) continue;
    const file=path.join(directory,entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(?:js|mjs|cjs)$/.test(file) && !generated.has(file) && !/(?:^|\/)public\/(?:assets|vendor|_next|mintlify-assets)\//.test(file)) unexpected.push(file);
  }
}
await scan();
assert.deepEqual(unexpected,[],'Project JavaScript must have TypeScript source and a declared build output');
for (const source of Object.values(outputs)) await access(source);
console.log(`No project JavaScript sources remain; ${generated.size} declared build outputs. Downloaded bundles are excluded.`);
