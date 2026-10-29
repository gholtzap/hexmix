import assert from 'node:assert/strict';
import {checkBug,openChatSidebar} from './lib/bug-flow.mts';

await checkBug('chat-project-history','/dashboards/ai-chatbot',async({page,frame,audit})=>{
 const choose=async(name:string)=>{await openChatSidebar(frame);await frame.locator('[data-project]').filter({hasText:name}).click();if(await frame.locator('body.drawer-open').count())await frame.getByRole('button',{name:'Toggle sidebar',exact:true}).click();};
 const send=async(text:string)=>{await frame.getByRole('textbox',{name:'Ask Pebble'}).fill(text);await frame.getByRole('button',{name:'Send message',exact:true}).click();};
 await choose('Design studio');await send('Project history check A');
 await openChatSidebar(frame);await frame.getByRole('button',{name:'New chat',exact:true}).click();
 await choose('Business priorities');await send('Project history check B');
 await openChatSidebar(frame);await frame.locator('[data-sample-chat="Project history check A"]').click();
 await frame.locator('.chat-message.user').filter({hasText:'Project history check A'}).waitFor();
 if(await frame.locator('body.drawer-open').count())await frame.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
 await audit('reopened-project');
 assert.equal(await frame.locator('.project-badge').innerText(),'Design studio');
});
