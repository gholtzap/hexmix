import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-040','/dashboards/infra-dashboard/settings',async({page,frame,nav,audit})=>{
 await frame.getByRole('button',{name:'Members',exact:true}).click();await frame.getByRole('button',{name:'General',exact:true}).click();await nav('Projects');const usage=frame.locator('.vc-insight-tabs').getByRole('radio',{name:'Usage',exact:true});if(page.viewportSize()!.width<600){await usage.waitFor();await usage.click();}await frame.getByRole('button',{name:'Billing',exact:true}).click();await frame.getByRole('heading',{name:'Pro plan',exact:true}).waitFor();assert.equal(await frame.getByRole('button',{name:'Billing',exact:true}).getAttribute('aria-pressed'),'true');await audit(frame,'billing-destination');
});
