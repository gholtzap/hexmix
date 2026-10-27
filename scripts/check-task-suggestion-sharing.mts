import assert from 'node:assert/strict';
import {openChatSidebar} from './lib/bug-flow.mts';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('task-suggestion-sharing','/dashboards/ai-chatbot/scheduled',async({page,frame,share,open,audit})=>{
 await frame.getByRole('button',{name:'Business updates',exact:false}).click();
 const source=await Promise.all(['Title','Prompt','Schedule'].map(label=>frame.getByLabel(label,{exact:true}).inputValue()));const link=await share();
 const recipient=await open(link);await recipient.frame.getByRole('dialog').waitFor();await audit(recipient.frame,'shared-suggestion');
 assert.deepEqual(await Promise.all(['Title','Prompt','Schedule'].map(label=>recipient.frame.getByLabel(label,{exact:true}).inputValue())),source);
 if(page.viewportSize()!.width<1000)return;
 await frame.getByLabel('Title',{exact:true}).fill('Saved review task');await frame.getByRole('button',{name:'Save',exact:true}).click();await openChatSidebar(frame);await frame.locator('[data-sched-task]').filter({hasText:'Saved review task'}).click();await frame.getByLabel('Title',{exact:true}).fill('Edited saved task draft');const saved=await open(await share());await saved.frame.getByRole('dialog').waitFor();await audit(saved.frame,'shared-saved-draft');assert.equal(await saved.frame.getByLabel('Title',{exact:true}).inputValue(),'Edited saved task draft');
});
