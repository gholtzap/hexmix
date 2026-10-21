import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const pattern=/new URL\(([^,()]+),([`"'])(\/assets\/[^`"']+)\2\)/g;
export function fixUrlBases(text){return text.replace(pattern,(_,relative,quote,base)=>`new URL(${relative},new URL(${quote}${base}${quote},globalThis.location.href))`);}
assert.equal(fixUrlBases('new URL(`./index.framercms`,`/assets/host/base.js`)'),'new URL(`./index.framercms`,new URL(`/assets/host/base.js`,globalThis.location.href))');
const manifestUrl=new URL('../assets.json',import.meta.url);
const manifest=JSON.parse(await readFile(manifestUrl,'utf8'));
let count=0;
for(const asset of manifest){
 if(!asset.file.endsWith('.mjs'))continue;
 const url=new URL('../public/'+asset.file,import.meta.url);const text=await readFile(url,'utf8');const fixed=fixUrlBases(text);
 if(fixed!==text){await writeFile(url,fixed);asset.bytes=Buffer.byteLength(fixed);count++;}
}
await writeFile(manifestUrl,JSON.stringify(manifest,null,2)+'\n');
console.log(`Updated ${count} module URL bases.`);
