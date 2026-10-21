import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-038','/dashboards/infra-dashboard?preview=acme-web',async({page,frame,share,open,audit})=>{
 await frame.getByRole('dialog').getByRole('button',{name:'Contact',exact:true}).click();await frame.getByLabel('Feedback',{exact:true}).fill('A feedback draft to retain');const link=await share();assert(!page.url().includes('feedback draft'));const recipient=await open(link);assert.equal(await recipient.frame.getByLabel('Feedback',{exact:true}).inputValue(),'A feedback draft to retain');assert.equal(await recipient.frame.getByRole('status').filter({hasText:'Feedback saved'}).count(),0);await audit(recipient.frame,'restored-feedback');
});
