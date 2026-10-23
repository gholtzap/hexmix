import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {checkPage} from 'lintapple';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const base=process.env.APP_URL || 'http://127.0.0.1:3419';
const phase=process.env.REVIEW_PHASE || 'after';
const output='artifacts/real-reviews/new-plugin-search/'+phase;
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const results=[],reports=[];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
async function check(page,audit,width,theme) {
 const colors=theme==='light'?'0c0a09-ffffff-e98878-ffe291-a8655f':'ffffff-0c0a09-e98878-ffe291-a8655f';
 await page.goto(base+'/dashboards/ai-chatbot?colors='+colors);await page.locator('iframe[data-preview-ready=true]').waitFor();
 const frame=await (await page.locator('iframe').elementHandle()).contentFrame();
 if(width===390)await frame.getByRole('button',{name:'Open sidebar',exact:true}).click();
 await frame.getByRole('button',{name:'Plugins',exact:true}).click();
 await frame.getByRole('searchbox',{name:'Search plugins',exact:true}).fill('no-match-here');
 await frame.getByRole('button',{name:'Add plugin',exact:true}).click();
 await frame.getByRole('menuitem',{name:'Create plugin',exact:true}).click();
 await frame.getByLabel('Name',{exact:true}).fill('Review helper');
 await frame.getByLabel('Description',{exact:true}).fill('Review code changes');
 await frame.getByRole('button',{name:'Create plugin',exact:true}).click();
 await audit('new-plugin',frame);
 assert.equal(await frame.getByRole('searchbox').inputValue(),'Review helper');
 assert((await frame.locator('#plug-list').innerText()).includes('Review helper'),'The new plugin must be visible.');
 await frame.locator('#plug-list [data-plug-detail="Review helper"]').click();
 await audit('plugin-details',frame);

}
try {
 for(const width of [390,1440])for(const theme of ['light','dark'] as const) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const audit=async(state,target=page)=>{
   await page.mouse.move(1,1);
   await page.screenshot({path:output+'/'+width+'-'+theme+'-'+state+'.png'});
   const report=await checkPage(target,policy);
   const box=await target.locator('#plug-list').first().boundingBox().catch(()=>null);
   const viewport=page.viewportSize();
   const left=Math.max(0,box?.x??0),top=Math.max(0,box?.y??0);
   const right=Math.min(viewport.width,box?box.x+box.width:viewport.width),bottom=Math.min(viewport.height,box?box.y+box.height:viewport.height);
   const focus={x:100*left/viewport.width,y:100*top/viewport.height,width:100*Math.max(1,right-left)/viewport.width,height:100*Math.max(1,bottom-top)/viewport.height};
   reports.push({width,theme,state,focus,report});
   await expectUI(page,{attach:async(_,attachment)=>{await writeFile(output+'/'+width+'-'+theme+'-'+state+'-findings.json',String(attachment.body));}},policy);
   assert.equal(report.findings.length,0,JSON.stringify(report.findings));
  };
  try {await check(page,audit,width,theme);assert.deepEqual(errors,[]);results.push({width,theme,passed:true});}
  catch(error){results.push({width,theme,passed:false,error:error.message});await page.screenshot({path:output+'/'+width+'-'+theme+'-failure.png'});}
  finally {await context.close();await writeFile(output+'/report.json',JSON.stringify({results,reports},null,2));}
 }
} finally {await browser.close();}
console.log(JSON.stringify({results,uiFindings:reports.reduce((count,item)=>count+(item.report?.findings?.length??0),0)}));
assert(results.every(result=>result.passed),'Review check failed. See '+output+'/report.json');
