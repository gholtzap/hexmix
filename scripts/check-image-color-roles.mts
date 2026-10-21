import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {initialPalette,defaultDarkPalette,paletteQuery} from '../src/lib/palette.ts';
const base=process.env.APP_URL||'http://127.0.0.1:3100',out='artifacts/image-color-roles';
await mkdir(out,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const browser=await chromium.launch(),results=[],reports=[];
async function audit(page,state){let report={findings:[]};let attached=false;try{await expectUI(page,{attach:async(_,data)=>{attached=true;report=JSON.parse(String(data.body));}},policy);}catch(error){if(!attached)throw error;}reports.push({state,report});}
try{
const path='/tervix';
for(const selector of ['img[data-editor-wordmark]','img[data-editor-icon]:not([data-editor-wordmark])'])for(const width of [390,1440])for(const [mode,palette] of [['light',initialPalette],['dark',defaultDarkPalette]] as const){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',colorScheme:mode});const page=await context.newPage();page.setDefaultTimeout(15000);
 try{
  await page.goto(`${base}${path}?${paletteQuery(palette)}`);await page.locator('iframe[data-preview-ready="true"]').waitFor();
  const frame=page.frameLocator('iframe.website-frame'),image=frame.locator(selector).filter({visible:true}).first();await image.waitFor();
  const native=await(await image.elementHandle())!.ownerFrame();
  await image.evaluate(n=>n.scrollIntoView({block:'center'}));
  await image.click({modifiers:['Alt'],position:{x:10,y:10}});await page.locator('.element-panel').waitFor();
  assert.equal(await image.getAttribute('data-hexmix-selected'),'');
  const state=()=>image.evaluate(n=>({src:(n as HTMLImageElement).src,background:getComputedStyle(n).backgroundImage,color:getComputedStyle(n).backgroundColor}));
  await native!.waitForFunction(selector=>[...document.querySelectorAll(selector)].some(n=>n.hasAttribute('data-hexmix-selected')&&getComputedStyle(n).backgroundImage!=='none'),selector);
  const original=await state(),shots=[];
  await audit(page,`${selector}-${width}-${mode}-selected`);
  for(const role of ['Primary','Secondary']){
   await page.getByRole('button',{name:'Change new color',exact:true}).click();
   if(role==='Primary')await audit(page,`${selector}-${width}-${mode}-menu`);
   await page.getByRole('menuitem',{name:role,exact:true}).click();
   await native!.waitForFunction(({selector,role})=>[...document.querySelectorAll(selector)].some(n=>n.getAttribute('data-editor-gradient-role')===role),{selector,role:role.toLowerCase()});
   await native!.waitForFunction(({selector,hex})=>[...document.querySelectorAll<HTMLElement>(selector)].some(n=>decodeURIComponent(n.style.getPropertyValue('--preview-image-background')).includes(hex)),{selector,hex:palette[role.toLowerCase()]});
   await image.evaluate(n=>(n as HTMLImageElement).decode().catch(()=>{}));await page.mouse.move(0,0);
   await native!.waitForFunction(selector=>[...document.querySelectorAll(selector)].some(n=>n.hasAttribute('data-hexmix-selected')&&n.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})),selector);
   shots.push(await image.screenshot({animations:'disabled'}));
  }
  await writeFile(`${out}/${path.slice(1)}-${width}-${mode}-primary.png`,shots[0]);
  await writeFile(`${out}/${path.slice(1)}-${width}-${mode}-secondary.png`,shots[1]);
  assert.equal(shots[0].equals(shots[1]),false,`${path} ${selector}: Primary and Secondary must look different`);
  const secondary=await state();
  await page.screenshot({path:`${out}/${path.slice(1)}-${selector.includes(':not')?'icon':'mark'}-${width}-${mode}.png`});
  await audit(page,`${path}-${selector}-${width}-${mode}-changed`);
  await page.reload();await page.locator('iframe[data-preview-ready="true"]').waitFor();await image.waitFor();
  const reloaded=await(await image.elementHandle())!.ownerFrame();
  await reloaded!.waitForFunction(({selector})=>[...document.querySelectorAll(selector)].some(n=>n.getAttribute('data-editor-gradient-role')==='secondary'),{selector});
  await image.evaluate(n=>(n as HTMLImageElement).decode().catch(()=>{}));
  await reloaded!.waitForFunction(({selector,secondary})=>[...document.querySelectorAll<HTMLImageElement>(selector)].some(n=>n.src===secondary.src&&getComputedStyle(n).backgroundImage===secondary.background&&getComputedStyle(n).backgroundColor===secondary.color),{selector,secondary});
  await image.evaluate(n=>n.scrollIntoView({block:'center'}));
  await image.click({modifiers:['Alt'],position:{x:10,y:10}});await page.getByRole('button',{name:'Use old color',exact:true}).click();
  await reloaded!.waitForFunction(({selector,original})=>[...document.querySelectorAll<HTMLImageElement>(selector)].some(n=>!n.hasAttribute('data-editor-gradient-role')&&n.src===original.src&&getComputedStyle(n).backgroundImage===original.background&&getComputedStyle(n).backgroundColor===original.color),{selector,original});
  results.push({path,selector,width,mode,passed:true});console.log(path,selector,width,mode,'passed');
 }finally{await context.close();}
}
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({results,reports},null,2));}
const findings=reports.reduce((n,x)=>n+(x.report.findings?.length||0),0);console.log(results.length,'flows;',reports.length,'UI scans;',findings,'findings');if(findings)process.exitCode=1;
