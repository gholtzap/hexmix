import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import {expectUI} from 'lintapple/playwright';
import policy from '../../ui-policy.json' with {type:'json'};
import {initialPalette,defaultDarkPalette,paletteQuery} from '../../src/lib/palette.ts';

export async function checkBug(id:string,paths:string|string[],test){
 const base=process.env.APP_URL??'http://127.0.0.1:3388',out=process.env.REPORT_DIR??`artifacts/${id}`;
 await mkdir(out,{recursive:true});const browser=await chromium.launch(),reports=[],failures=[];
 try{for(const path of typeof paths==='string'?[paths]:paths)for(const width of [390,1440])for(const [theme,palette] of Object.entries({light:initialPalette,dark:defaultDarkPalette})){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:theme as 'light'|'dark'}),page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const scans=[],prefix=typeof paths==='string'?'':path.replace(/[^a-z0-9-]/gi,'-')+'-';
  try{
   await page.goto(`${base}${path}${path.includes('?')?'&':'?'}${paletteQuery(palette)}`);await page.locator('[data-app-ready]').waitFor();
   const frame=page.frames().find(f=>f!==page.mainFrame());if(frame)await frame.locator('[data-app-ready],html[data-app-ready=true],html[data-editor-ready=true],html[data-contrast-ready=true]').first().waitFor();
   const audit=async(state,child=frame,view=page)=>{await view.mouse.move(0,0);await view.waitForTimeout(150);for(const [surface,target] of [['editor',view],['preview',child]] as const){if(!target)continue;let report={findings:[]};if(surface==='editor'){try{await expectUI(view,{attach:async(_,file)=>{report=JSON.parse(String(file.body));}},policy);}catch(error){if(!report.findings.length)throw error;}}else report=await checkPage(target,policy);scans.push({state,surface,report});}await view.screenshot({path:`${out}/${prefix}${width}-${theme}-${state}.png`});};
   await test({page,frame,context,width,theme,path,audit});assert.deepEqual(errors,[]);reports.push({path,width,theme,actions:'passed',scans});
  }catch(error){console.error(path,width,theme,String(error));failures.push({path,width,theme,error:String(error),errors});reports.push({path,width,theme,actions:'failed',scans});await page.screenshot({path:`${out}/${prefix}${width}-${theme}-failure.png`});}
  finally{await context.close();}
 }}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({reports,failures},null,2));}
 const findings=reports.flatMap(r=>r.scans.flatMap(s=>s.report.findings));console.log(`${id}: ${reports.length} flows, ${failures.length} action failures, ${findings.length} UI findings`);
 assert.deepEqual(failures,[]);assert.deepEqual(findings,[]);
}
export async function openInfraPage(frame,name){
 const control=frame.getByRole('navigation',{name:'Team',exact:true}).getByRole('button',{name,exact:false});if(!await control.isVisible())await frame.getByRole('button',{name:'Open sidebar',exact:true}).filter({visible:true}).first().click();await control.click();
}
export async function openChatSidebar(frame){await frame.locator('html[data-app-ready=true]').waitFor();const control=frame.getByRole('button',{name:'Open sidebar',exact:true});if(await control.isVisible())await control.click();}
