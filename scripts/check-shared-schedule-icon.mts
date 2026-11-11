import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('shared-schedule-icon','/tervix/demo',async({frame,share,open,audit})=>{
 await frame.locator('#search').fill('Team');await frame.locator('#interval').click();assert.equal(await frame.locator('#interval svg').count(),1);
 const recipient=await open(await share());await recipient.frame.locator('#interval').waitFor();await audit(recipient.frame,'shared-schedule');
 assert.match(await recipient.frame.locator('#interval').innerText(),/Every week/);assert.equal(await recipient.frame.locator('#interval svg').count(),1);await recipient.frame.locator('#interval').click();assert.match(await recipient.frame.locator('#interval').innerText(),/Every month/);assert.equal(await recipient.frame.locator('#interval svg').count(),1);await audit(recipient.frame,'changed-shared-schedule');
});
