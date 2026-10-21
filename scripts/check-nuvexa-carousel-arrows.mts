import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-067',['/nuvexa/products/quotes-and-tenders','/nuvexa/products/order-processing','/nuvexa/solutions/distributors'],async({frame:f,audit})=>{
 const carousel=f.locator('#stories-video'),section=carousel.locator('xpath=ancestor::section[1]');assert(await carousel.evaluate(e=>e.scrollWidth>e.clientWidth));await section.getByRole('button',{name:'Next',exact:true}).filter({visible:true}).click();await expect.poll(()=>carousel.evaluate(e=>e.scrollLeft)).toBeGreaterThan(20);await f.waitForTimeout(500);await audit('next-story',null);await section.getByRole('button',{name:'Previous',exact:true}).filter({visible:true}).click();await expect.poll(()=>carousel.evaluate(e=>e.scrollLeft)).toBeLessThan(2);await audit('previous-story',null);
});
