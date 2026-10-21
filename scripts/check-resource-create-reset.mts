import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-060','/dashboards/infra-dashboard/environment-variables',async({frame:f,audit})=>{
 const open=()=>f.getByRole('button',{name:'Create Variable',exact:true}).click(),d=f.getByRole('dialog');
 await open();await d.getByLabel('Name',{exact:true}).fill('FIRST_SAMPLE');await d.getByLabel('Value',{exact:true}).fill('first value');await d.getByRole('button',{name:'Create Variable',exact:true}).click();await d.waitFor({state:'hidden'});
 await open();await f.waitForTimeout(200);assert.equal(await d.getByLabel('Name',{exact:true}).inputValue(),'');assert.equal(await d.getByLabel('Value',{exact:true}).inputValue(),'');await audit('new-form-empty');
 await d.getByLabel('Name',{exact:true}).fill('SECOND_SAMPLE');await d.getByLabel('Value',{exact:true}).fill('second value');await d.getByRole('button',{name:'Create Variable',exact:true}).click();await d.waitFor({state:'hidden'});for(const name of ['FIRST_SAMPLE','SECOND_SAMPLE'])await f.getByRole('button',{name,exact:true}).waitFor();await audit('both-created');
 await f.getByRole('button',{name:'Actions for FIRST_SAMPLE',exact:true}).click();await f.getByRole('menuitem',{name:'Edit',exact:true}).click();assert.equal(await d.getByLabel('Value',{exact:true}).inputValue(),'first value');await audit('saved-value-preserved');
});
