const id='HX-026',widths=[390,1440];
async function verify(page,context,width,theme){
 const f=await go(page,'/dashboards/infra-dashboard/support');
 const message='Keep this detail.\nKeep the second line too.';
 await f.getByRole('button',{name:'New case',exact:true}).click();
 await f.getByLabel('Subject',{exact:true}).fill('Retained message');await f.getByLabel('Message',{exact:true}).fill(message);
 await f.getByRole('button',{name:'Create case',exact:true}).click();
 await f.getByRole('button',{name:'Retained message',exact:true}).click();assert((await f.getByRole('dialog').innerText()).includes(message));await audit(page,'case message');await page.screenshot({path:`${output}/${width}-${theme}-case-message.png`});
 await f.getByRole('button',{name:'Close dialog',exact:true}).click();
 await f.getByRole('button',{name:'Domain verification',exact:true}).click();assert((await f.getByRole('dialog').innerText()).includes('Our team has received this sample case.'));
 await f.getByRole('button',{name:'Close dialog',exact:true}).click();
 for(const message of [undefined,{invalid:'object'}]){
  const state={v:1,views:{'/dashboards/infra-dashboard/support|Page preview':{'AccountPages.AccountPage.cases':[{id:'old-case',title:'Shared older case',status:'Closed',updated:'Yesterday',...(message===undefined?{}:{message})}]}}};
  const preview=await go(page,'/dashboards/infra-dashboard/support?state='+encodeURIComponent(JSON.stringify(state)));
  if(message===undefined){await preview.getByRole('button',{name:'Shared older case',exact:true}).waitFor();}
  else{await preview.getByRole('button',{name:'Domain verification',exact:true}).waitFor();assert.equal(await preview.getByRole('button',{name:'Shared older case',exact:true}).count(),0);}
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
