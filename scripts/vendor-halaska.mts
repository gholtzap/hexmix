import ts from 'typescript';
import { mkdir, writeFile } from 'node:fs/promises';
const commit='f11ab6958de3fb186a4d431e8425bbe43a6dc87b';
const sourceURL=`https://raw.githubusercontent.com/Halaska-Studio/ui/${commit}/halaska-kit/halaska-kit-v1.0.jsx`;
const response=await fetch(sourceURL);if(!response.ok)throw new Error(`Halaska source: ${response.status}`);
const source=await response.text();
const file=ts.createSourceFile('halaska-kit.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
const declarations=new Map();
for(const statement of file.statements){
 if(ts.isFunctionDeclaration(statement)&&statement.name)declarations.set(statement.name.text,statement);
 if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(ts.isIdentifier(d.name))declarations.set(d.name.text,statement);
}
const exports=['CardDialog','SegmentedControl','Slider','DropdownMenu','Toast','IconButton','tokens'];
const selected=new Set();
function visit(name){const node=declarations.get(name);if(!node||selected.has(node))return;selected.add(node);const walk=n=>{if(ts.isIdentifier(n)&&declarations.has(n.text))visit(n.text);ts.forEachChild(n,walk);};walk(node);}
exports.forEach(visit);
let subset=file.statements.filter(s=>ts.isImportDeclaration(s)||selected.has(s)).map(s=>s.getText(file)).join('\n\n');
// Existing HTML triggers open the kit menu through a small DOM adapter.
subset=subset.replace('function DropdownMenu({ trigger, items, theme: tp }) {','function DropdownMenu({ trigger, items, theme: tp, externalAnchor, onClose }) {');
subset=subset.replace('ref={(el) => (btnRefs.current[opt] = el)}','ref={(el) => { btnRefs.current[opt] = el; }}');
const menuStart=subset.indexOf('function DropdownMenu(');let menu=subset.slice(menuStart);
menu=menu.replace('useState(false)','useState(Boolean(externalAnchor))').replace('setOpen(false);','setOpen(false);\n    onClose?.();');
menu=menu.replace('if (refocus) rootRef.current?', 'if (refocus && externalAnchor?.isConnected) externalAnchor.focus();\n    if (refocus && !externalAnchor) rootRef.current?');
menu=menu.replace('<div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>','<div ref={rootRef} onKeyDown={(e) => { if (e.key === "Escape" && open && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); close(true); } }} style={{ position: "relative", display: "inline-flex" }}>');
menu=menu.replace('<div data-menu-trigger','<div hidden={Boolean(externalAnchor)} data-menu-trigger');
subset=subset.slice(0,menuStart)+menu;
const dir=new URL('../src/components/dashboards/vendor/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL('halaska.jsx',dir),`"use client";\n/*! Halaska UI v1.0, MIT. Source: ${sourceURL}\n * Selected upstream components; external menu trigger adapter added. See HALASKA-LICENSE. */\n${subset}\nexport { ${exports.join(', ')} };\n`);
const license=await fetch(`https://raw.githubusercontent.com/Halaska-Studio/ui/${commit}/LICENSE`);if(!license.ok)throw new Error('Halaska license could not load.');await writeFile(new URL('HALASKA-LICENSE',dir),await license.text());
console.log(`Saved ${selected.size} Halaska declarations (${subset.length} bytes).`);
