import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const files: Record<string,string> = JSON.parse(readFileSync(new URL('browser-files.json', import.meta.url), 'utf8'));
const outputs = new Map<string,string>();
for (const [output, source] of Object.entries(files)) {
  const code = readFileSync(new URL(output, root), 'utf8');
  const original = ts.createSourceFile(source, readFileSync(new URL(source, root), 'utf8'), ts.ScriptTarget.ES2022);
  const generated = ts.createSourceFile(output, code, ts.ScriptTarget.ES2022);
  const module = ts.isExternalModule(original);
  assert.equal(ts.isExternalModule(generated), module, `${output} changed its script format`);
  if (!module) new Script(code, {filename:output});
  if (outputs.has(source)) assert.equal(code, outputs.get(source), `${source} has different generated copies`);
  outputs.set(source, code);
}
for (const site of ['tervix','nuvexa']) {
  const assets: {file:string; bytes:number}[] = JSON.parse(readFileSync(new URL(`${site}/assets.json`, root), 'utf8'));
  for (const asset of assets) {
    const output = `${site}/public/${asset.file}`;
    if (Object.hasOwn(files, output))
      assert.equal(asset.bytes, readFileSync(new URL(output, root)).byteLength, `${output} has an incorrect byte count`);
  }
}
console.log(`Checked script formats, duplicate outputs, and asset byte counts for ${Object.keys(files).length} browser scripts.`);
