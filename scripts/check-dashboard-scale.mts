import {clickToolbarAction} from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import uiPolicy from '../ui-policy.json' with {type:'json'};
import {expectUI} from 'lintapple/playwright';

const output='artifacts/dashboard-scale';
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const reports=[],metrics=[],errors=[];
let completed=false;
async function audit(page,frame,state,width,theme){
  await page.mouse.move(1,1);
  await frame.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity));
  let outer={findings:[]};
  try{await expectUI(page,{attach:async(_,data)=>outer=JSON.parse(String(data.body))});}catch(error){if(!outer.findings.length)throw error;}
  reports.push({state,width,theme,scope:'editor',report:outer});
  reports.push({state,width,theme,scope:'dashboard',report:await checkPage(frame,uiPolicy)});
}
try{
 for(const width of [1440,390])for(const theme of ['dark','light'])for(const name of ['infra-dashboard','ai-chatbot']){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>errors.push(error.message));
  const palette=theme==='dark'?'ededed-0f0f0f-ffffff-212121-afafaf':'171717-ffffff-171717-eeeeee-626262';
  await page.goto(`http://127.0.0.1:3000/dashboards/${name}?colors=${palette}`);
  const iframe=page.locator('iframe');const frame=await (await iframe.elementHandle()).contentFrame();
  await frame.locator('[data-app-ready]').waitFor();
  await page.waitForFunction(()=>(document.querySelector('.studio') as HTMLElement)?.dataset.appReady==='true');
  const measure=()=>iframe.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,innerWidth:(e as HTMLIFrameElement).contentWindow.innerWidth,scale:getComputedStyle(e).getPropertyValue('--preview-scale').trim(),browserScale:visualViewport.scale,rootZoom:getComputedStyle(document.documentElement).zoom,overflow:document.documentElement.scrollWidth>innerWidth,toolbarTop:document.querySelector('.toolbar-anchor')?.getBoundingClientRect().top}));
  const dimensions=await measure();metrics.push({width,theme,name,...dimensions});
  assert.equal(Number(dimensions.scale),0.9);assert.equal(dimensions.browserScale,1);assert.equal(dimensions.rootZoom,'1');
  assert.ok(Math.abs(dimensions.width-width)<1);assert.ok(Math.abs(dimensions.innerWidth-width/.9)<1);assert.equal(dimensions.overflow,false);
  if(width===390)assert.ok(dimensions.height<=dimensions.toolbarTop);
  await audit(page,frame,`${name} initial`,width,theme);
  if(name==='infra-dashboard'){
   await frame.getByRole('button',{name:'Add New',exact:true}).click();await audit(page,frame,'project menu',width,theme);
   await frame.getByRole('menuitem',{name:'Project',exact:true}).click();await audit(page,frame,'project dialog',width,theme);
   await frame.getByLabel('Project name',{exact:true}).fill('compact-project');await frame.getByRole('button',{name:'Create Project',exact:true}).click();await frame.getByRole('button',{name:'compact-project',exact:true}).waitFor();
  }else{
   await frame.getByRole('button',{name:'Add files and more',exact:true}).click();await audit(page,frame,'chat menu',width,theme);
   await frame.getByRole('menuitem',{name:'Add browser tabs',exact:true}).click();await audit(page,frame,'page attachment dialog',width,theme);
   await frame.getByRole('button',{name:'Close dialog',exact:true}).click();
   await frame.locator('.composer textarea').fill('Plan a weekly review');await frame.locator('.composer textarea').press('Enter');await frame.locator('.chat-message.assistant').waitFor();
  }
  await clickToolbarAction(page, 'Hide color toolbar');
  assert.ok(Math.abs((await measure()).height-(width===390?844:900))<1);
  await audit(page,frame,`${name} toolbar hidden`,width,theme);
  await page.screenshot({path:`${output}/${name}-${width}-${theme}.png`});
  await page.getByRole('button',{name:'Open color toolbar',exact:true}).click();
  await page.close();
 }
 assert.deepEqual(errors,[]);completed=true;
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({completed,metrics,errors,reports},null,2));}
const findings=reports.flatMap(item=>item.report.findings);
console.log(`${metrics.length} layouts, ${reports.length} UI checks, ${findings.length} findings. Report: ${output}/report.json`);
assert.equal(findings.length,0,JSON.stringify(findings,null,2));
