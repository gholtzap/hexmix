import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-035','/dashboards/infra-dashboard/settings',async({frame,nav,share,open,audit})=>{
 await frame.getByLabel('Team name',{exact:true}).fill('Renamed studio');await frame.getByRole('button',{name:'Save changes',exact:true}).click();assert.equal(await frame.locator('.vc-topbar-team').textContent(),'Renamed studio');await audit(frame,'renamed-settings');
 await nav('Projects');await frame.getByRole('button',{name:'acme-web',exact:true}).waitFor();
 const team=frame.getByRole('button',{name:'Renamed studio Pro · Switch team',exact:true});if(!await team.isVisible())await frame.locator('.vc-topbar-toggle').getByRole('button',{name:'Open sidebar',exact:true}).click();await team.click();await frame.getByRole('menuitem',{name:'Personal',exact:true}).click();
 const personal=frame.getByRole('button',{name:'Personal Pro · Switch team',exact:true});if(!await personal.isVisible())await frame.locator('.vc-topbar-toggle').getByRole('button',{name:'Open sidebar',exact:true}).click();await personal.click();await frame.getByRole('menuitem',{name:'Renamed studio',exact:true}).click();await frame.getByRole('button',{name:'acme-web',exact:true}).waitFor();
 const recipient=await open(await share());assert.equal(await recipient.frame.locator('.vc-topbar-team').textContent(),'Renamed studio');await audit(recipient.frame,'shared-team-name');
});
