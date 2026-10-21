import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {loadBindings, minify} from 'next/dist/build/swc/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-p', 'tsconfig.browser.json'], {cwd:root, stdio:'inherit'});
const files: Record<string,string> = JSON.parse(readFileSync(new URL('browser-files.json', import.meta.url), 'utf8'));
const compiled = new Map(Object.values(files).map(source => [source, readFileSync(new URL('../'+source.replace(/^browser\//, '').replace(/\.ts$/, '.js'), import.meta.url), 'utf8')]));
await loadBindings();
for (const [source, code] of compiled) {
  const module = ts.isExternalModule(ts.createSourceFile(source, code, ts.ScriptTarget.ES2022));
  compiled.set(source, (await minify(code, {module, compress:false, mangle:false})).code);
}
for (const [output, source] of Object.entries(files)) {
  const path = new URL('../'+output, import.meta.url);
  mkdirSync(new URL('.', path), {recursive:true});
  writeFileSync(path, `// Built from ${source}. Edit the TypeScript source.\n`+compiled.get(source));
}
const config = ts.transpileModule(readFileSync(new URL('../config/postcss.config.mts', import.meta.url), 'utf8'), {fileName:"postcss.config.mts",compilerOptions:{module:ts.ModuleKind.NodeNext,target:ts.ScriptTarget.ES2022}}).outputText;
writeFileSync(new URL('../postcss.config.mjs', import.meta.url), '// Built from config/postcss.config.mts.\n'+config);
for (const site of ['tervix','nuvexa']) {
  const path = new URL(`../${site}/assets.json`, import.meta.url);
  const assets: {file:string; bytes:number}[] = JSON.parse(readFileSync(path, 'utf8'));
  for (const asset of assets) if (Object.hasOwn(files, `${site}/public/${asset.file}`)) asset.bytes=readFileSync(new URL(`../${site}/public/${asset.file}`,import.meta.url)).byteLength;
  writeFileSync(path, JSON.stringify(assets,null,2)+'\n');
}
console.log(`Built ${Object.keys(files).length} browser scripts and the PostCSS config.`);
