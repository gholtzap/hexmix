const id='HX-030',widths=[390,1440];
async function verify(page,context,width,theme){
 const first=theme==='light'?'111111-eeeeee-aabbcc-ddeeff-112233':'eeeeee-111111-aabbcc-ddeeff-112233',second=theme==='light'?'222222-ffffff-999999-aaaaaa-bbbbbb':'ffffff-222222-999999-aaaaaa-bbbbbb';
 const f=await go(page,`/avenlo?colors=${first}&heading=Arial&body=Verdana`);
 await page.evaluate(text=>navigator.clipboard.writeText(text),second);await clickToolbarAction(page,'Paste palette or theme');await page.waitForFunction(colors=>new URL(location.href).searchParams.get('colors')===colors,second);
 const link=f.getByRole('link',{name:'Blog',exact:true}).first();const popup=context.waitForEvent('page');await link.click({button:'middle'});const next=await popup;await next.bringToFront();await next.waitForURL(u=>u.pathname==='/avenlo/blog',{waitUntil:'domcontentloaded'});await next.waitForFunction(()=>{const node=document.querySelector('[data-app-ready]');return node&&getComputedStyle(node).visibility!=='hidden';});await next.waitForFunction(()=>new URL(location.href).searchParams.has('colors'));
 const query=new URL(next.url()).searchParams;assert.equal(query.get('colors'),second);assert.equal(query.get('heading'),'Arial');assert.equal(query.get('body'),'Verdana');await audit(next,'new tab theme');await next.close();await page.bringToFront();
 await link.click();await page.waitForURL(u=>u.pathname==='/avenlo/blog');assert.equal(new URL(page.url()).searchParams.get('colors'),second);
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
