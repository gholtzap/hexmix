import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-056','/dashboards/ai-chatbot/sites',async({frame,audit})=>{
 await frame.getByRole('searchbox',{name:'Search sites'}).fill('zz-no-match');await audit(frame,'empty-search');if(!await frame.locator('[data-nav=space]').isVisible())await frame.getByRole('button',{name:'Open sidebar',exact:true}).click();await frame.locator('[data-nav=space]').click();
 const create=frame.locator('[data-space-create]').filter({visible:true}).last();await create.click();await frame.getByRole('menuitem',{name:'Site',exact:true}).click();const d=frame.getByRole('dialog');await d.getByLabel('Name',{exact:true}).fill('Site created from Space');await d.getByRole('button',{name:'Save',exact:true}).click();
 await frame.getByRole('searchbox',{name:'Search sites'}).waitFor();assert.equal(await frame.getByRole('searchbox',{name:'Search sites'}).inputValue(),'');await frame.getByRole('button',{name:'Site created from Space',exact:true}).waitFor();await audit(frame,'created-site');
});
