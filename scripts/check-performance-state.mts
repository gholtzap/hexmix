import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { encodeState, readField } = await import(pathToFileURL(resolve(process.env.PERF_STATE_MODULE || 'browser/public/share-state.ts')).href);
const state = { v: 1, views: { '/editor': Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`field-${i}`, `body > section:nth-child(${i}) > button[aria-label="Example ${i}"]`])) } };
const host = { location: new URL(`https://hexmix.test/editor?state=${encodeState(state)}`), parent: undefined as unknown };
host.parent = host;
Object.defineProperty(globalThis, 'window', { value: host, configurable: true });
const samples = [];
for (let run = 0; run < 7; run++) {
  const start = performance.now();
  for (let i = 0; i < 1000; i++) assert.equal(readField('/editor', `field-${i % 100}`), state.views['/editor'][`field-${i % 100}`]);
  samples.push(performance.now() - start);
}
const result = { readsPerRun: 1000, runs: 7, samplesMs: samples, medianMs: [...samples].sort((a, b) => a - b)[3] };
const directory = `artifacts/performance/${process.env.PERF_LABEL || 'candidate'}`;
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/state-reads.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
