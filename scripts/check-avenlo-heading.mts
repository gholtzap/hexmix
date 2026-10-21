import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
const output='artifacts/avenlo-heading';await mkdir(output,{recursive:true});
const browser=await chromium.launch(),results=[],errors=[];
async function measure(page,frame,width,state){
 const geometry=await frame.locator('.hero__title').evaluate(title=>{
  const bounds=selector=>{const range=document.createRange();range.selectNodeContents(title.querySelector(selector));const r=range.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
  const first=bounds('.hero__static'),word=bounds('.hero__typed');
  const stacked=word.top>=first.bottom-2;
  return {word:title.querySelector('.hero__typed').textContent,stacked,first,wordBounds:word,center:innerWidth/2,centers:stacked?[(first.left+first.right)/2,(word.left+word.right)/2]:[(Math.min(first.left,word.left)+Math.max(first.right,word.right))/2]};
 });
 for(const center of geometry.centers)assert.ok(Math.abs(center-geometry.center)<2,JSON.stringify(geometry));
 await page.mouse.move(1,1);let report={findings:[]},attached=false;try{await expectUI(page,{attach:async(_,data)=>{attached=true;report=JSON.parse(String(data.body));}});}catch(error){if(!attached)throw error;}
 results.push({width,state,geometry,report});
}
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'no-preference'});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:3000/avenlo');const frame=page.frames().find(f=>f.parentFrame());await frame.locator('html[data-copy-ready=true]').waitFor();
  for(const word of ['move forward','grow','connect']){await frame.waitForFunction(word=>document.querySelector('.hero__typed')?.textContent===word,word,{timeout:20000});await measure(page,frame,width,`animated ${word}`);}
  await page.screenshot({path:`${output}/after-${width}.png`});await page.close();
  for(const font of ['System','Arial','Verdana'])for(const theme of ['light','dark']){
   const p=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));const colors=theme==='light'?'171717-ffffff-ff6467-fbf9f5-db4f51':'ededed-171717-ff6467-333333-db4f51';await p.goto(`http://127.0.0.1:3000/avenlo?heading=${font}&colors=${colors}`);const f=p.frames().find(f=>f.parentFrame());await f.locator('html[data-copy-ready=true]').waitFor();await f.evaluate(async()=>document.fonts.ready);await measure(p,f,width,`${font} ${theme} reduced motion`);await p.close();
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({errors,results},null,2));}
assert.equal(results.flatMap(x=>x.report.findings).length,0);console.log(`${results.length} centered heading states; no UI findings or page errors.`);
