import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-058','/nuvexa',async({page,frame,open,share,audit})=>{
 await page.waitForLoadState('networkidle');await frame.getByRole('button',{name:'Next',exact:true}).last().click();await frame.waitForFunction(()=>document.getElementById('stories-video').scrollLeft>0);await frame.waitForTimeout(600);
 const position=()=>{const x=document.getElementById('stories-video');return x.scrollLeft/(x.scrollWidth-x.clientWidth);};const vertical=()=>scrollY/(document.documentElement.scrollHeight-innerHeight);const beforeVertical=await frame.evaluate(vertical);const before=await frame.evaluate(position);assert(before>0);await audit(page,'carousel-selected');
 const restored=await open(await share());await restored.page.waitForLoadState('networkidle');await restored.frame.waitForTimeout(600);const after=await restored.frame.evaluate(position);assert(Math.abs(await restored.frame.evaluate(vertical)-beforeVertical)<.03,'Vertical scroll must stay in place.');assert(Math.abs(after-before)<.03,`Expected horizontal fraction ${before}; got ${after}`);await audit(restored.page,'carousel-restored');
});
