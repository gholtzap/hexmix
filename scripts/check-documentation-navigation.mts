import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-065','/tervix/quickstart/workflows',async({frame:f,page,width,audit})=>{
 const sidebar=f.locator('#sidebar'),trigger=f.getByRole('button',{name:/^Navigation/});
 if(width<1024){await trigger.click();const d=f.getByRole('dialog',{name:'Documentation',exact:true});await d.waitFor();assert.equal(await trigger.getAttribute('aria-expanded'),'true');assert.equal(await sidebar.isVisible(),true);await audit('navigation-open',f);await d.getByRole('button',{name:'Close navigation',exact:true}).focus();await audit('close-tooltip',f);await d.getByRole('button',{name:'Close navigation',exact:true}).click();await expect.poll(()=>trigger.getAttribute('aria-expanded')).toBe('false');assert.equal(await sidebar.isVisible(),false);
  await trigger.click();await d.waitFor();await page.setViewportSize({width:1440,height:900});await expect.poll(()=>d.isVisible()).toBe(false);assert.equal(await sidebar.isVisible(),true);await page.setViewportSize({width,height:900});await trigger.click();await d.waitFor();
 }else{assert.equal(await sidebar.isVisible(),true);await audit('desktop-sidebar',null);}
 const link=sidebar.locator('a[data-preview-path="/on-premise/setup"]').first();await link.click();await page.waitForURL(u=>u.pathname==='/tervix/on-premise/setup');await page.locator('iframe[data-preview-ready=true]').waitFor();
});
