import assert from 'node:assert/strict';
import {checkBug,openChatSidebar} from './lib/bug-flow.mts';
await checkBug('HX-050','/dashboards/ai-chatbot',async({frame:f,audit})=>{
 const input=f.getByRole('textbox',{name:'Ask Pebble',exact:true}),files=f.locator('#chat-files'),draft=f.locator('.chat-input-area > .attachments .attachment');
 const first={name:'first<&>.txt',mimeType:'text/plain',buffer:Buffer.from('first')},second={name:'second.txt',mimeType:'text/plain',buffer:Buffer.from('second')};
 await files.setInputFiles([first,second]);await input.fill('First message');await audit('attached');await f.getByRole('button',{name:'Send message',exact:true}).click();assert.equal(await draft.count(),0);assert.equal(await files.evaluate((x:HTMLInputElement)=>x.files.length),0);assert.deepEqual(await f.locator('.chat-message.user .attachment').allTextContents(),[first.name,second.name]);await input.fill('Second message');await audit('sent');
 await files.setInputFiles(first);assert.deepEqual(await draft.allTextContents(),[first.name]);await f.getByRole('button',{name:'Send message',exact:true}).click();assert.equal(await draft.count(),0);assert.deepEqual(await f.locator('.chat-message.user').last().locator('.attachment').allTextContents(),[first.name]);
 await openChatSidebar(f);await f.getByRole('button',{name:'New chat',exact:true}).click();assert.equal(await draft.count(),0);await openChatSidebar(f);await f.locator('[data-chat-recents]').getByRole('button',{name:'First message',exact:true}).click();assert.deepEqual(await f.locator('.chat-message.user').first().locator('.attachment').allTextContents(),[first.name,second.name]);await input.fill('Next draft');await audit('reopened');
});
