import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('created-resource-visibility',['/dashboards/infra-dashboard/flags','/dashboards/infra-dashboard/storage'],async({frame,path,audit})=>{
 const flag=path.endsWith('flags'),name=flag?'review-checkout':'review-store',create=flag?'Create Flag':'Create Database',search=flag?'Search flags':'Search storage';
 await frame.getByRole('button',{name:flag?'Environment: All':'Provider: All',exact:true}).click();await frame.getByRole('menuitem',{name:flag?'Preview':'Blob',exact:true}).click();await frame.getByRole('searchbox',{name:search,exact:true}).fill(flag?'beta':'uploads');await frame.getByRole('button',{name:create,exact:true}).click();const panel=frame.getByRole('dialog');await panel.getByLabel(flag?'Key':'Name',{exact:true}).fill(name);await panel.getByRole('button',{name:create,exact:true}).click();await audit('created-resource');assert.equal(await frame.getByRole('button',{name,exact:true}).count(),1);assert.equal(await frame.getByRole('searchbox',{name:search,exact:true}).inputValue(),'');
});
