import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-062','/avenlo/blog',async({frame:f,audit})=>{
 const rows=f.locator('.bl-list > li'),more=f.getByRole('button',{name:'Load More',exact:true}),count=()=>rows.evaluateAll(xs=>xs.filter((x:HTMLElement)=>!x.hidden).length);const initial=await count(),total=await rows.count();assert(total>initial);await more.click();assert.equal(await count(),Math.min(total,initial+20));await audit('first-batch',null);
 while(await more.isVisible())await more.click();assert.equal(await count(),total);assert.equal(await more.isVisible(),false);await audit('all-articles',null);const last=rows.last().getByRole('link');const target=new URL(await last.getAttribute('href'),f.url()).pathname;await last.click();await f.page().waitForURL(url=>url.pathname===target);await f.page().locator('iframe[data-preview-ready=true]').waitFor();
});
