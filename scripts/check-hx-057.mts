import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-057','/tervix/demo',async({page,frame,audit})=>{
 await frame.locator('#search').fill('Team');const description='A unique plan for our next launch';await frame.locator('#agent-prompt').fill(description);await frame.locator('#generate-action').click();assert.equal(await frame.locator('#demo-description').innerText(),description);await frame.locator('#save-action').click();assert.match(await frame.locator('#demo-dialog').innerText(),/Plan saved/);await audit(frame,'save-confirmation');await frame.locator('#dialog-close').click();
 await frame.locator('#workflow-tabs button').nth(1).click();assert.notEqual(await frame.locator('#demo-description').innerText(),description);await frame.locator('#workflow-tabs button').first().click();assert.equal(await frame.locator('#demo-description').innerText(),description);await page.mouse.move(0,0);await frame.waitForTimeout(500);await audit(frame,'saved-plan-restored');await frame.locator('#display-action').hover();await frame.getByRole('tooltip',{name:'Change display',exact:true}).waitFor();await audit(frame,'display-tooltip');
});
