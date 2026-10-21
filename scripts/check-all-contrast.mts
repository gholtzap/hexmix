import type {Frame, Page} from 'playwright';
import {measure} from './lib/measure-text-contrast.mts';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {contrast,initialPalette,paletteQuery} from '../src/lib/palette.ts';
import {sitePreviews,dashboardPaths} from '../src/lib/previews.ts';
import {workspaceViews} from '../src/lib/workspace-views.ts';

const requested=process.argv.slice(2);
const appUrl=process.env.APP_URL??'http://127.0.0.1:3000';
const directory='artifacts/all-surface-contrast'+(requested.length?'/focused':'');
await mkdir(directory,{recursive:true});
const destinations=JSON.parse(await readFile('src/lib/site-destinations.json','utf8'));
const registry=await readFile('src/components/dashboards/infrastructure/pages/registry.ts','utf8');
const infraPages=[...registry.split('} as const')[0].matchAll(/(?:'([^']+)'|([a-z]+)):/g)].map(match=>match[1]||match[2]);
const routes=new Set(['/','/editor',...Object.values(sitePreviews).map(site=>`/${site.slug}`)]);
const extras={avenlo:['contact','contact-demo','agents','demo','security'],tervix:['demo','login','register','contact','status','developers','about','documentation/quickstart/workflows','documentation/workflows/cli','documentation/workflows/sdk','documentation/workflows/mcp',...Array.from({length:5},(_,index)=>`compare/approach-${index+1}`)],orvian:['blog',...Array.from({length:22},(_,index)=>`blog/${index+1}`)],nuvexa:['about','careers','contact']};
for(const [id,site] of Object.entries(sitePreviews)) {
 for(const path of [...Object.keys(destinations[id]),...extras[id]]) routes.add(`/${site.slug}/${path.replace(/^\.\/?/,'')}`.replace(/\/$/,''));
}
for(const view of Object.keys(workspaceViews))routes.add(`${dashboardPaths.chatbot}${view==='chat'?'':`/${view}`}`);
for(const view of infraPages)routes.add(`${dashboardPaths.infra}${view==='projects'?'':`/${view}`}`);
const cases=[
 {name:'light',text:'#000000',background:'#ffffff'},
 {name:'dark',text:'#ffffff',background:'#0c0a09'},
 {name:'black-on-dark',text:'#000000',background:'#0c0a09'},
 {name:'white-on-light',text:'#ffffff',background:'#ffffff'},
];
const roots=new Set(['/','/editor',...Object.values(sitePreviews).map(site=>`/${site.slug}`),dashboardPaths.chatbot,dashboardPaths.infra,'/avenlo/contact','/tervix/contact','/nuvexa/contact']);
assert.ok(requested.every(path=>routes.has(path)), 'Unknown route');
const jobs=[...routes].filter(path=>!requested.length||requested.includes(path)).flatMap(path=>[390,1440].flatMap(width=>(roots.has(path)?cases:cases.slice(0,2)).map(palette=>({path,width,palette}))));
const browser=await chromium.launch();const reports=[],failures=[];let cursor=0;
async function saveReport(){
 const report={routes:[...routes].filter(path=>!requested.length||requested.includes(path)),states:reports.length,measurements:reports.reduce((sum,r)=>sum+(r.text?.length||0),0),failures,reports};
 await writeFile(`${directory}/report.json.tmp`,JSON.stringify(report,null,2));
 await rename(`${directory}/report.json.tmp`,`${directory}/report.json`);
}
async function worker(){
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page.setDefaultTimeout(20000);
 while(cursor<jobs.length){const job=jobs[cursor++];const record: typeof job & {text?: Awaited<ReturnType<typeof measure>>;failures?: Awaited<ReturnType<typeof measure>>;ui?: {findings:unknown[]};error?:string}={...job};try{
  await page.setViewportSize({width:job.width,height:job.width===390?844:900});
  const palette={...initialPalette,...job.palette};
  const response=await page.goto(`${appUrl}${job.path}?${paletteQuery(palette)}`, {waitUntil:'domcontentloaded'});
  assert.ok(response.ok(),`${job.path} returned ${response.status()}`);
  await page.locator('[data-app-ready]').waitFor();
  let frame: Page | Frame=page;
  if(job.path!=='/'){
   await page.frameLocator('iframe').locator('html[data-contrast-ready="true"]').waitFor();
   if(job.path==='/tervix')await page.frameLocator('iframe').locator('html[data-home-ready="true"]').waitFor();
   frame=page.frames().find(frame=>frame.parentFrame());
   await frame.waitForFunction(palette=>document.documentElement.dataset.contrastReady==='true'&&['text','background','primary','secondary','accent'].every(role=>document.documentElement.style.getPropertyValue(`--p-${role}`)===palette[role])&&document.documentElement.dataset.contrastPalette===['text','background','primary','secondary','accent'].map(role=>palette[role]).join('|'),palette);
  }
  await frame.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(animation=>animation.effect.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));});
  if(job.path.startsWith('/nuvexa')&&job.width===390)await frame.waitForFunction(()=>{const menu=document.querySelector('.mh-header [data-framer-name="Mobile Menu"]');return !menu||getComputedStyle(menu).visibility==='hidden';});
  record.text=await measure(frame);record.failures=record.text.filter(item=>contrast(item.foreground,item.background)<4.5);
  if(record.failures.length)failures.push({path:job.path,width:job.width,palette:job.palette.name,failures:record.failures});
  let ui={findings:[]};try{await expectUI(page,{attach:async(_,attachment)=>{ui=JSON.parse(String(attachment.body));}});}catch(error){if(!ui.findings.length)throw error;}
  record.ui=ui;if(ui.findings.length)failures.push({path:job.path,width:job.width,palette:job.palette.name,ui:ui.findings});
  if(roots.has(job.path))await page.screenshot({path:`${directory}/${job.path.replaceAll('/','_')||'home'}-${job.width}-${job.palette.name}.png`});
 }catch(error){record.error=error.message;failures.push({path:job.path,width:job.width,palette:job.palette.name,error:error.message});}
 reports.push(record);if(reports.length%20===0){console.log(`Checked ${reports.length}/${jobs.length} page states; ${failures.length} failed states.`);await writeFile(`${directory}/failures.json`,JSON.stringify(failures,null,2));await saveReport();}
 }
 await page.close();
}
try{await Promise.all([worker(),worker()]);}finally{await browser.close();await saveReport();}
console.log(`Checked ${[...routes].filter(path=>!requested.length||requested.includes(path)).length} routes, ${reports.length} page states; ${failures.length} failed states. Report: ${directory}/report.json`);
process.exitCode=failures.length?1:0;
