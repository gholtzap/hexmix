import assert from 'node:assert/strict';
import {checkBug,openChatSidebar} from './lib/bug-flow.mts';
await checkBug('temporary-history','/dashboards/ai-chatbot',async({frame,audit})=>{
 const send=async(text:string)=>{await frame.getByRole('textbox',{name:'Ask Pebble'}).fill(text);await frame.getByRole('button',{name:'Send message',exact:true}).click();};
 await send('Saved review conversation');await frame.getByRole('button',{name:'Temporary chat',exact:true}).click();await openChatSidebar(frame);await frame.locator('[data-sample-chat="Saved review conversation"]').click();
 if(await frame.locator('body.drawer-open').count())await frame.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
 await audit('opened-saved-history');assert.equal(await frame.getByRole('button',{name:'Temporary chat',exact:true}).getAttribute('aria-pressed'),'false');
 await frame.getByRole('button',{name:'Temporary chat',exact:true}).click();await send('Private review message');await frame.getByRole('button',{name:'Temporary chat',exact:true}).click();await openChatSidebar(frame);assert.equal(await frame.locator('[data-sample-chat="Private review message"]').count(),0);await frame.locator('[data-sample-chat="Saved review conversation"]').click();assert.equal(await frame.locator('.chat-message.user').filter({hasText:'Private review message'}).count(),0);
});
