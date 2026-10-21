import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import policy from '../../ui-policy.json' with {type:'json'};
import {initialPalette,defaultDarkPalette,paletteQuery} from '../../src/lib/palette.ts';

export async function checkBug(id:string,path:string,test){
 const base=process.env.APP_URL??'http://127.0.0.1:3388',out=process.env.REPORT_DIR??`artifacts/${id}`;
 await mkdir(out,{recursive:true});const browser=await chromium.launch(),reports=[],failures=[];
 try{for(const width of [390,1440])for(const [theme,palette] of Object.entries({light:initialPalette,dark:defaultDarkPalette})){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:theme as 'light'|'dark'}),page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const scans=[];
  try{
   await page.goto(`${base}${path}${path.includes('?')?'&':'?'}${paletteQuery(palette)}`);await page.locator('[data-app-ready]').waitFor();
   const frame=page.frames().find(f=>f!==page.mainFrame());if(frame)await frame.locator('[data-app-ready],html[data-app-ready=true],html[data-editor-ready=true],html[data-contrast-ready=true]').first().waitFor();
   const audit=async(state,child=frame)=>{await page.mouse.move(0,0);await page.waitForTimeout(150);for(const [surface,target] of [['editor',page],['preview',child]] as const){if(!target)continue;const report=await checkPage(target,policy);scans.push({state,surface,report});}await page.screenshot({path:`${out}/${width}-${theme}-${state}.png`});};
   await test({page,frame,context,width,theme,audit});assert.deepEqual(errors,[]);reports.push({width,theme,actions:'passed',scans});
  }catch(error){failures.push({width,theme,error:String(error),errors});reports.push({width,theme,actions:'failed',scans});await page.screenshot({path:`${out}/${width}-${theme}-failure.png`});}
  finally{await context.close();}
 }}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({reports,failures},null,2));}
 const findings=reports.flatMap(r=>r.scans.flatMap(s=>s.report.findings));console.log(`${id}: ${reports.length} flows, ${failures.length} action failures, ${findings.length} UI findings`);
 assert.deepEqual(failures,[]);assert.deepEqual(findings,[]);
}
export async function openInfraPage(frame,name){
 const control=frame.getByRole('button',{name,exact:true});if(!await control.isVisible())await frame.getByRole('button',{name:'Open sidebar',exact:true}).filter({visible:true}).first().click();await control.click();
}
export async function openChatSidebar(frame){const control=frame.getByRole('button',{name:'Open sidebar',exact:true});if(await control.isVisible())await control.click();}
