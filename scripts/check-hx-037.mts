import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-037','/tervix/templates',async({frame,audit})=>{
 const filters=frame.locator('main .flex.flex-wrap.items-center.gap-2 button'),cards=frame.locator('main .grid.md\\:grid-cols-2 > a');const count=await cards.count();assert(count>1);await filters.first().click();assert.equal(await filters.first().getAttribute('aria-pressed'),'true');const hidden=await cards.locator('[data-filter-hidden=true]').count();const visible=await cards.evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').length);assert(visible>0&&visible<count);await audit(frame,'filtered-templates');await filters.first().click();assert.equal(await filters.first().getAttribute('aria-pressed'),'false');assert.equal(await cards.evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').length),count);await audit(frame,'all-templates');
});
