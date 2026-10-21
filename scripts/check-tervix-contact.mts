import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-046','/tervix/contact',async({frame:f,audit})=>{
 const dialog=f.locator('dialog[open]');await dialog.waitFor();assert.equal(await f.locator('h1').innerText(),'Start a conversation');
 await dialog.getByLabel('Email',{exact:true}).fill('invalid');await dialog.getByLabel('Note',{exact:true}).fill('A test note.');await dialog.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await dialog.locator('form').evaluate((form:HTMLFormElement)=>form.checkValidity()),false);await audit('invalid-email');
 await dialog.getByLabel('Email',{exact:true}).fill('test@example.com');await dialog.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await dialog.getByRole('status').innerText(),'Your note is ready to share.');await audit('ready');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await f.getByRole('link',{name:'Book a scoping call',exact:true}).first().click();await dialog.waitFor();assert.equal(await dialog.getByRole('heading').innerText(),'Schedule a conversation');await audit('reopened');
});
