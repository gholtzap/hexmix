import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-045','/dashboards/infra-dashboard/environment-variables',async({frame,audit})=>{
 const edit=async(name:string)=>{await frame.getByRole('button',{name:`Actions for ${name}`,exact:true}).click();await frame.getByRole('menuitem',{name:'Edit',exact:true}).click();};
 await edit('NEXT_PUBLIC_SITE_URL');const dialog=frame.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill('bad-key');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/uppercase/);await audit(frame,'invalid-record');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await edit('DATABASE_URL');await frame.waitForTimeout(300);assert.equal(await dialog.getByLabel('Name',{exact:true}).inputValue(),'DATABASE_URL');assert.equal(await dialog.getByRole('alert').count(),0);await audit(frame,'different-record');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();assert.equal(await frame.getByRole('dialog').count(),0);
});
