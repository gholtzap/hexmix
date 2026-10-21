const id='HX-031',widths=[390,1440];
async function verify(page,context,width,theme){
 const f=await go(page,'/avenlo');await f.locator('html[data-hexmix-inspector=true]').waitFor();await f.locator('.hero__lede').click({modifiers:['Alt']});await page.getByRole('button',{name:'Change new color'}).click();await page.getByRole('menuitem',{name:'Accent',exact:true}).click();await page.waitForFunction(()=>new URL(location.href).searchParams.has('elements'));const before=JSON.parse(new URL(page.url()).searchParams.get('elements'));await page.keyboard.press('Escape');await clickToolbarAction(page,'Compare palettes');await page.waitForURL(u=>u.pathname==='/compare');assert.deepEqual(JSON.parse(new URL(page.url()).searchParams.get('elements')),before);
 for(const side of ['A','B']){
  if(width===390&&side==='B')await page.getByRole('button',{name:'Show palette B',exact:true}).click();
  const frame=page.frameLocator(`iframe[title="Palette ${side} preview"]`);await frame.locator('[data-app-ready]').waitFor();await frame.locator('iframe[data-preview-ready=true]').waitFor();await clickToolbarAction(frame,'Copy theme and settings');const copied=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));assert.deepEqual(copied.elements,before);
 }
 if(width===390)await page.getByRole('button',{name:'Show palette A',exact:true}).click();
 const a=page.frameLocator('iframe[title="Palette A preview"]');await a.frameLocator('iframe').locator('html[data-hexmix-inspector=true]').waitFor();await a.frameLocator('iframe').locator('.hero__lede').click({modifiers:['Alt']});await a.getByRole('button',{name:'Change new color'}).click();await a.getByRole('menuitem',{name:'Primary',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(new URL(location.href).searchParams.get('elements')||'[]')[0]?.role==='primary');const expected=before.map(item=>({...item,role:'primary'}));await page.keyboard.press('Escape');await clickToolbarAction(a,theme==='light'?'Use dark palette':'Use light palette');await page.waitForFunction(mode=>new URL(location.href).searchParams.get('mode')===mode,theme==='light'?'dark':'light');
 const link=page.url();await page.goto(link);await page.locator('[data-app-ready]').waitFor();const frame=page.frameLocator('iframe[title="Palette A preview"]');await frame.locator('[data-app-ready]').waitFor();if(width===390)await page.getByRole('button',{name:'Show palette A',exact:true}).click();await clickToolbarAction(frame,'Copy theme and settings');assert.deepEqual(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())).elements,expected);
}
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {initialPalette,defaultDarkPalette,paletteQuery} from '../src/lib/palette.ts';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const base=process.env.APP_URL||'http://127.0.0.1:3340';
const output=`artifacts/${id}`;await mkdir(output,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8')),reports=[],flows=[];
const browser=await chromium.launch();
async function go(page,path){const url=new URL(base+path);if(!url.searchParams.has('colors')){const dark=await page.evaluate(()=>matchMedia('(prefers-color-scheme: dark)').matches);url.searchParams.set('colors',new URLSearchParams(paletteQuery(dark?defaultDarkPalette:initialPalette)).get('colors'));}await page.goto(url.href);await page.locator('[data-app-ready]').waitFor();if(path.startsWith('/editor'))return null;await page.locator('iframe[data-preview-ready=true]').waitFor();const f=page.frameLocator('iframe');await f.locator('html[data-editor-ready=true],html[data-contrast-ready=true]').waitFor();return f;}
async function audit(page,state){await page.mouse.move(1,1);const report=await checkPage(page,policy);reports.push({state,width:page.viewportSize().width,report});}
try{for(const width of widths)for(const theme of ['light','dark'] as const){const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();page.setDefaultTimeout(15000);try{await verify(page,context,width,theme);await audit(page,'result');await page.screenshot({path:`${output}/${width}-${theme}.png`});flows.push({width,theme,passed:true});}finally{await context.close();}}}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({flows,reports},null,2));}
assert.deepEqual(reports.flatMap(item=>item.report.findings),[]);
console.log(`${id}: ${flows.length} flows passed; ${reports.length} UI checks passed.`);
