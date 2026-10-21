import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-047','/dashboards/infra-dashboard/speed-insights',async({frame:f,audit})=>{
 await f.getByRole('searchbox',{name:'Search',exact:true}).fill('atlas-commerce');
 const row=f.getByRole('row').filter({has:f.getByRole('button',{name:'atlas-commerce',exact:true})});
 const desktop=await row.locator('td').allTextContents();assert.equal(desktop[1],'91');assert.equal(desktop[5],'0.04');await audit('all-projects');
 const select=async(value)=>{await f.getByRole('button',{name:/^Project:/}).click();await f.getByRole('menuitem',{name:value,exact:true}).click();};
 await select('atlas-commerce');assert.deepEqual(await row.locator('td').allTextContents(),desktop);await audit('selected-project');
 await f.getByRole('button',{name:'Mobile',exact:true}).click();const mobile=await row.locator('td').allTextContents();assert.equal(mobile[1],'83');await select('All projects');assert.deepEqual(await row.locator('td').allTextContents(),mobile);await audit('mobile-metrics');
 await f.getByRole('searchbox',{name:'Search',exact:true}).fill('no-matching-project');await f.getByText('No results',{exact:true}).waitFor();await audit('empty-results');
});
