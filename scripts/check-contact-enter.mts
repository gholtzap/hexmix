import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-064','/tervix/contact',async({frame:f,audit})=>{
 const d=f.locator('dialog.tervix-dialog');await d.waitFor({state:'visible'});const email=d.getByLabel('Email',{exact:true});await email.fill('person@example.com');await d.getByLabel('Note',{exact:true}).fill('Review this sample plan.');await email.press('Enter');await f.waitForTimeout(100);assert.equal(await d.evaluate((d:HTMLDialogElement)=>d.open),true);assert.equal(await d.getByRole('status').innerText(),'Your note is ready to share.');await audit('enter-confirms');
 await d.getByRole('button',{name:'Close',exact:true}).click();await f.getByRole('link',{name:'Book a scoping call',exact:true}).first().click();await email.fill('');await email.press('Enter');assert.equal(await d.evaluate((d:HTMLDialogElement)=>d.open),true);assert.equal(await d.getByRole('status').innerText(),'');assert.equal(await email.evaluate((e:HTMLInputElement)=>e.checkValidity()),false);await audit('invalid-enter');await d.getByRole('button',{name:'Close',exact:true}).click();await d.waitFor({state:'hidden'});
});
