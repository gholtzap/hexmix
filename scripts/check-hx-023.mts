const id='HX-023',widths=[390,1440];
async function verify(page,context,width,theme){
 const f=await go(page,'/dashboards/infra-dashboard/environment-variables');
 for(const close of ['Close dialog','Save changes']){
  await f.getByRole('button',{name:'Actions for NEXT_PUBLIC_SITE_URL',exact:true}).click();
  await f.getByRole('menuitem',{name:'Edit',exact:true}).click();
  await f.getByRole('dialog').waitFor();
  assert.equal(await f.locator('.infrastructure-app').evaluate(n=>n.inert),true);
  await audit(page,'edit dialog');
  await f.getByRole('button',{name:close,exact:true}).click();
  await f.locator('.infrastructure-app').evaluate(n=>{if(n.inert)throw Error('Page is still inert');});
  const search=f.getByRole('searchbox',{name:'Search environment variables',exact:true});
  await search.fill('NEXT_PUBLIC_SITE_URL');assert.equal(await search.inputValue(),'NEXT_PUBLIC_SITE_URL');await search.fill('');
 }
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
