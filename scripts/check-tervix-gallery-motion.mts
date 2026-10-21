import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.APP_URL??'http://127.0.0.1:3100',out='artifacts/tervix-gallery-motion';
await mkdir(out,{recursive:true});
const browser=await chromium.launch(),results=[];
async function traceTransition(frame,indices) {
 return frame.evaluate(async indices=>{
  const tabs=document.querySelectorAll<HTMLButtonElement>('[role=tablist][aria-label="Work priorities"] [role=tab]');
  const cards=[...document.querySelectorAll('[data-tervix-gallery] > [role=tabpanel]')];
  const frames=[];let runningAfter260ms=null;
  for(const index of indices)tabs[index].click();
  const start=performance.now();
  await new Promise<void>(resolve=>{
   const sample=()=>{
    const t=performance.now()-start;
    const shades=cards.map(card=>{const css=getComputedStyle(card.querySelector(':scope > .absolute.inset-0:not(.flex)'));return {opacity:Number(css.opacity),background:css.backgroundImage,stops:['top','middle','lower','bottom'].map(stop=>Number(css.getPropertyValue('--preview-gallery-shade-'+stop)))};});
    frames.push({t,shades});
    if(t>=260&&runningAfter260ms===null)runningAfter260ms=document.getAnimations().filter(a=>a.effect instanceof KeyframeEffect&&a.effect.target instanceof Element&&a.effect.target.closest('[data-tervix-gallery]')&&a.playState==='running').length;
    if(t<1050)requestAnimationFrame(sample);else resolve();
   };requestAnimationFrame(sample);
  });return {runningAfter260ms,frames};
 },indices);
}
function assertShade(trace) {
 for(const frame of trace.frames)for(const shade of frame.shades) {
  assert.equal(shade.opacity,1,'Image shading must never fade out');
  assert.notEqual(shade.background,'none','Image shading must stay present');
  const bounds=[[.08,.64],[.18,.64],[.64,.68],[.64,.86]];
  shade.stops.forEach((value,i)=>assert(Number.isFinite(value)&&value>=bounds[i][0]-.001&&value<=bounds[i][1]+.001,'Shading must stay between the two final states'));
 }
}
function assertSmoothShade(trace) {
 const first=trace.frames[0].shades,last=trace.frames.at(-1).shades;
 for(let frame=1;frame<trace.frames.length;frame++)for(let card=0;card<first.length;card++)for(let stop=0;stop<4;stop++) {
  const direction=Math.sign(last[card].stops[stop]-first[card].stops[stop]);
  const delta=trace.frames[frame].shades[card].stops[stop]-trace.frames[frame-1].shades[card].stops[stop];
  assert(direction?delta*direction>=-.002:Math.abs(delta)<.002,'Shading must not reverse direction for a frame');
 }
}
try {
 for(const width of [390,1440])for(const reducedMotion of ['no-preference','reduce'] as const)for(const [theme,colors]of Object.entries({light:'222d1f-f9fcf8-94ce88-beefcd-4a8b3c',dark:'ffffff-0c0a09-e98878-ffe291-a8655f'})) {
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion});
  try {
   await page.goto(`${base}/tervix?colors=${colors}&heading=System&body=System`);
   await page.locator('iframe[data-preview-ready=true]').waitFor();
   const frame=page.frames().find(f=>f.parentFrame());
   await frame.waitForSelector('[data-tervix-gallery]');
   await frame.waitForFunction(()=>document.documentElement.dataset.contrastReady==='true');
   const during=await traceTransition(frame,[2]);
   assertShade(during);
   assertSmoothShade(during);
   assert(reducedMotion==='reduce'?during.runningAfter260ms===0:during.runningAfter260ms>0,'Motion must finish normally and respect reduced motion');
   await frame.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect instanceof KeyframeEffect && a.effect.target instanceof Element && a.effect.target.closest('[data-preview-animated-artwork]') && Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished));});
   await frame.waitForFunction(()=>document.documentElement.dataset.contrastReady==='true');
   assert.equal(await frame.getByRole('tab',{selected:true}).getAttribute('id'),'tervix-gallery-tab-2');
   const rapid=await traceTransition(frame,[4,1,3]);
   assertShade(rapid);
   await frame.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect instanceof KeyframeEffect && a.effect.target instanceof Element && a.effect.target.closest('[data-preview-animated-artwork]') && Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished));});
   await frame.waitForFunction(()=>document.documentElement.dataset.contrastReady==='true');
   const selected=frame.locator('#tervix-gallery-panel-3');
   assert.equal(await frame.getByRole('tab',{selected:true}).getAttribute('id'),'tervix-gallery-tab-3');
   assert.equal(await selected.locator('[data-preview-text-surface]').count(),0);
   if(width===390)assert(await selected.evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}),'The selected mobile card must stay in view');
   await selected.getByRole('button',{name:/^Expand /}).click();
   await frame.getByRole('dialog').waitFor();
   await frame.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect instanceof KeyframeEffect && a.effect.target instanceof Element && a.effect.target.closest('[data-preview-animated-artwork]') && Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished));});
   await page.screenshot({path:`${out}/${width}-${theme}-${reducedMotion}-open.png`});
   await page.keyboard.press('Escape');await frame.getByRole('dialog').waitFor({state:'hidden'});
   await frame.getByRole('heading',{name:'What could your next chapter look like?',exact:true}).scrollIntoViewIfNeeded();
   await frame.evaluate(()=>scrollBy(0,-80));await page.mouse.move(1,1);
   await page.screenshot({path:`${out}/${width}-${theme}-${reducedMotion}-gallery.png`});
   results.push({width,theme,reducedMotion,runningAfter260ms:during.runningAfter260ms,shadeFrames:during.frames,rapidShadeFrames:rapid.frames,rapidSelectionPassed:true,closePassed:true});
  } finally {await page.close();}
 }
 console.log(`${results.length} motion, reduced-motion, rapid-selection, and close states passed.`);
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));}
