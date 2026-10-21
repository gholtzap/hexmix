import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
const paths=['products/quotes-and-tenders','products/order-processing','integrations','solutions/distributors','solutions/manufacturers','success-stories','success-stories/story-a','success-stories/story-b','success-stories/story-c','about','careers','contact','privacy','imprint','terms'];
await checkBug('HX-061','/nuvexa/contact',async({page,audit})=>{
 for(const path of paths){const url=new URL(page.url());url.pathname='/nuvexa/'+path;await page.goto(url.href);await page.locator('iframe[data-preview-ready=true]').waitFor();const f=await(await page.locator('iframe').elementHandle()).contentFrame();await f.waitForLoadState('networkidle');const heading=await f.locator('h1').first().innerText();assert.equal(await f.title(),`${heading} — Nuvexa`,path);if(path==='contact')assert.equal(heading,'Let’s talk about how your team works.');if(path==='about')assert.equal(heading,'A team focused on simpler work.');if(['privacy','imprint','terms'].includes(path))assert.equal(await f.locator('.nuvexa-preview-note').count(),1);await audit(path.replaceAll('/','-'),null);}
});
