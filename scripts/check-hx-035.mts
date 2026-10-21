import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-035','/dashboards/infra-dashboard/settings',async({frame,nav,share,open,audit})=>{
 await frame.getByLabel('Team name',{exact:true}).fill('Renamed studio');await frame.getByRole('button',{name:'Save changes',exact:true}).click();assert.equal(await frame.locator('.vc-topbar-team').textContent(),'Renamed studio');await audit(frame,'renamed-settings');
 await nav('Projects');await frame.getByRole('button',{name:'acme-web',exact:true}).waitFor();
 assert.equal(await frame.locator('[data-site-switcher-slot]').textContent(),'Renamed studio Pro');
 const recipient=await open(await share());assert.equal(await recipient.frame.locator('.vc-topbar-team').textContent(),'Renamed studio');await audit(recipient.frame,'shared-team-name');
});
