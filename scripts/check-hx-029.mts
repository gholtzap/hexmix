const id='HX-029',widths=[390,1440];
async function verify(page,context,width,theme){
 const f=await go(page,'/tervix/roadmap');
 for(const email of ['', 'not-an-email']){
  await f.getByRole('button',{name:'Submit request',exact:true}).click();const modal=f.locator('.tervix-dialog[open]');await modal.waitFor();await f.getByLabel('Email',{exact:true}).fill(email);await audit(page,'unfinished request');
  await modal.getByRole('button',{name:'Close',exact:true}).click();await f.locator('.tervix-dialog[open]').waitFor({state:'hidden'});
 }
 await f.getByRole('button',{name:'Submit request',exact:true}).click();await f.getByLabel('Email',{exact:true}).fill('test@example.invalid');await f.locator('.tervix-dialog').getByRole('button',{name:'Continue',exact:true}).click();await f.getByRole('status').filter({hasText:'Your note is ready to share.'}).waitFor();
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
