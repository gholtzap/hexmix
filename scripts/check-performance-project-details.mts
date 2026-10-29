import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('performance-project-details','/dashboards/infra-dashboard/speed-insights',async({frame,audit})=>{
 await frame.getByRole('region',{name:'Project performance',exact:true}).getByRole('button',{name:'atlas-commerce',exact:true}).click();await audit('project-details');
 const row=frame.getByRole('dialog').locator('dl > div').filter({has:frame.locator('dt').getByText('Project',{exact:true})});assert.equal(await row.locator('dd').innerText(),'atlas-commerce');
});
