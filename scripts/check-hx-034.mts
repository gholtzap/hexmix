import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-034','/dashboards/infra-dashboard?preview=acme-web',async({page,frame,share,open,audit})=>{
 await frame.getByRole('dialog').waitFor();await frame.getByRole('button',{name:'Close dialog',exact:true}).click();assert.equal(await frame.getByRole('dialog').count(),0);await page.reload();await page.locator('iframe[data-preview-ready=true]').waitFor();const current=page.frameLocator('iframe');await current.locator('[data-app-ready]').waitFor();assert.equal(await current.getByRole('dialog').count(),0);await audit(page,'closed-after-reload');
 const recipient=await open(await share());assert.equal(await recipient.frame.getByRole('dialog').count(),0);await audit(recipient.frame,'closed-shared-preview');
});
