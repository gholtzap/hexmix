const id='HX-025',widths=[390,1440];
async function verify(page,context,width,theme){
 const fs=await import('node:fs/promises');
 await go(page,'/editor?colors=111111-eeeeee-aabbcc-ddeeff-112233&heading=Arial&body=Verdana');
 await clickToolbarAction(page,'Palettes');await page.getByRole('button',{name:'Save palette',exact:true}).click();await page.getByLabel('Palette name',{exact:true}).fill('Shared theme test');await page.getByRole('button',{name:'Save',exact:true}).click();await page.evaluate(()=>navigator.clipboard.writeText(''));await page.getByRole('button',{name:'Share view',exact:true}).click();
 await page.waitForFunction(async()=>/\/s\/[a-f0-9]{32}$/.test(await navigator.clipboard.readText()));const link=await page.evaluate(()=>navigator.clipboard.readText());
 try{
  await page.getByRole('button',{name:'Close palettes',exact:true}).click();await page.goto(base+'/editor?colors=222222-ffffff-999999-aaaaaa-bbbbbb');await page.locator('[data-app-ready]').waitFor();await page.evaluate(text=>navigator.clipboard.writeText(text),link);
  await clickToolbarAction(page,'Paste palette or theme');await page.waitForFunction(()=>new URL(location.href).searchParams.get('colors')==='111111-eeeeee-aabbcc-ddeeff-112233');assert.equal(new URL(page.url()).searchParams.get('heading'),'Arial');assert.equal(new URL(page.url()).searchParams.get('body'),'Verdana');assert.equal(await page.locator('dialog[open]').count(),0);await audit(page,'shared theme applied');
  await clickToolbarAction(page,'Undo paste');await page.waitForFunction(()=>new URL(location.href).searchParams.get('colors')==='222222-ffffff-999999-aaaaaa-bbbbbb');
  await page.locator('body').evaluate(n=>{n.tabIndex=-1;n.focus();});await page.keyboard.press('ControlOrMeta+V');await page.waitForFunction(()=>new URL(location.href).searchParams.get('colors')==='111111-eeeeee-aabbcc-ddeeff-112233');await audit(page,'native shared link paste');await clickToolbarAction(page,'Undo paste');await page.waitForFunction(()=>new URL(location.href).searchParams.get('colors')==='222222-ffffff-999999-aaaaaa-bbbbbb');
  await page.evaluate(text=>navigator.clipboard.writeText(text),base+'/s/'+'f'.repeat(32));await clickToolbarAction(page,'Paste palette or theme');await page.getByRole('status').filter({hasText:'Clipboard has no valid palette or theme.'}).waitFor();assert.equal(new URL(page.url()).searchParams.get('colors'),'222222-ffffff-999999-aaaaaa-bbbbbb');
 }finally{await fs.unlink('.local/shares/'+link.split('/').pop()+'.json').catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const base=process.env.APP_URL||'http://127.0.0.1:3340';
const output=`artifacts/${id}`;await mkdir(output,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8')),reports=[],flows=[];
const browser=await chromium.launch();
async function go(page,path){await page.goto(base+path);await page.locator('[data-app-ready]').waitFor();if(path.startsWith('/editor'))return null;await page.locator('iframe[data-preview-ready=true]').waitFor();const f=page.frameLocator('iframe');await f.locator('html[data-editor-ready=true],html[data-contrast-ready=true]').waitFor();return f;}
async function audit(page,state){await page.mouse.move(1,1);const report=await checkPage(page,policy);reports.push({state,width:page.viewportSize().width,report});}
try{for(const width of widths)for(const theme of ['light','dark'] as const){const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();page.setDefaultTimeout(15000);try{await verify(page,context,width,theme);await audit(page,'result');await page.screenshot({path:`${output}/${width}-${theme}.png`});flows.push({width,theme,passed:true});}finally{await context.close();}}}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({flows,reports},null,2));}
assert.deepEqual(reports.flatMap(item=>item.report.findings),[]);
console.log(`${id}: ${flows.length} flows passed; ${reports.length} UI checks passed.`);
