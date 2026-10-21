import assert from 'node:assert/strict';
import {checkBug,openChatSidebar} from './lib/bug-flow.mts';
await checkBug('HX-051',['/dashboards/ai-chatbot','/dashboards/ai-chatbot/work'],async({frame:f,path,audit})=>{
 const input=f.getByRole('textbox',{name:path.endsWith('/work')?'Work with Pebble':'Ask Pebble',exact:true}),temporary=f.getByRole('button',{name:'Temporary chat',exact:true});
 const send=async(text)=>{await input.fill(text);await f.getByRole('button',{name:'Send message',exact:true}).click();};
 await send('Normal retained');await temporary.click();assert.equal(await temporary.getAttribute('aria-pressed'),'true');assert.equal(await f.locator('.chat-message').count(),0);
 await send('Temporary secret');await input.fill('Unsent temporary draft');assert.equal(await f.locator('[data-chat-recents] [data-sample-chat="Temporary secret"]').count(),0);await audit('temporary');
 await temporary.click();assert.equal(await temporary.getAttribute('aria-pressed'),'false');assert.equal(await f.locator('.chat-message').count(),0);assert.equal(await input.inputValue(),'');await send('After temporary');await input.fill('Next normal draft');await audit('normal');
 await openChatSidebar(f);await f.locator('[data-chat-recents]').getByRole('button',{name:'Normal retained',exact:true}).click();assert.deepEqual(await f.locator('.chat-message.user').allTextContents(),['Normal retained']);await input.fill('Normal conversation kept');await audit('history-kept');
 await openChatSidebar(f);await f.getByRole('button',{name:'Search',exact:true}).click();await f.getByRole('searchbox',{name:'Search chats',exact:true}).fill('Temporary secret');await f.getByText('No chats found',{exact:true}).waitFor();await audit('secret-not-saved');
});
