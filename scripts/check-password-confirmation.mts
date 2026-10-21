import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-049','/tervix/register',async({frame:f,audit})=>{
 assert.equal(await f.locator('h1').evaluate(x=>getComputedStyle(x).fontFamily.includes('system-ui')),true);
 const email=f.locator('#email'),password=f.locator('#password'),confirm=f.locator('#confirm'),submit=f.locator('#submit-label');
 await email.fill('test@example.com');await password.fill('first-password-123');await confirm.fill('second-password-456');await submit.click();assert.equal(await confirm.evaluate((x:HTMLInputElement)=>x.validationMessage),'Passwords must match.');await audit('mismatch');
 await password.fill('second-password-456');assert.equal(await confirm.evaluate((x:HTMLInputElement)=>x.validationMessage),'');assert.equal(await f.locator('form').evaluate((x:HTMLFormElement)=>x.checkValidity()),true);await audit('corrected-password');await submit.click();assert.match(await f.locator('#form-status').innerText(),/did not create an account/);
 await email.fill('test@example.com');await password.fill('third-password-789');await confirm.fill('fourth-password-789');await submit.click();assert.equal(await confirm.evaluate((x:HTMLInputElement)=>x.validationMessage),'Passwords must match.');await confirm.fill('third-password-789');assert.equal(await f.locator('form').evaluate((x:HTMLFormElement)=>x.checkValidity()),true);await audit('corrected-confirmation');await submit.click();assert.match(await f.locator('#form-status').innerText(),/did not create an account/);
});
