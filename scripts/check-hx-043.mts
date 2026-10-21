import assert from 'node:assert/strict';
import {runBugCheck} from './lib/confirmed-bug.mts';
await runBugCheck('HX-043','/dashboards/ai-chatbot',async({page,frame,audit})=>{
 const file=frame.locator('#chat-files');await file.setInputFiles({name:'first.txt',mimeType:'text/plain',buffer:Buffer.from('First')});await frame.getByRole('button',{name:'Add files and more',exact:true}).click();const event=page.waitForEvent('filechooser');await frame.getByRole('menuitem',{name:'Add photos & files',exact:true}).click();await(await event).setFiles({name:'second.txt',mimeType:'text/plain',buffer:Buffer.from('Second')});assert.deepEqual(await frame.locator('.attachment').allTextContents(),['first.txt','second.txt']);await audit(frame,'both-attachments');
 await file.setInputFiles([{name:'third.txt',mimeType:'text/plain',buffer:Buffer.from('Third')},{name:'fourth.txt',mimeType:'text/plain',buffer:Buffer.from('Fourth')}]);assert.deepEqual(await frame.locator('.attachment').allTextContents(),['first.txt','second.txt','third.txt','fourth.txt']);await audit(frame,'multiple-added-files');
});
