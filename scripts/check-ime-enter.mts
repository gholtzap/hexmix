import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('HX-053',['/dashboards/ai-chatbot','/dashboards/ai-chatbot/work','/compare?preview=workspace'],async({page,frame,context,path,width,audit})=>{
 const compare=path.startsWith('/compare');
 const child=async(side)=>{const outer=await (await page.locator(`iframe[title="Palette ${side} preview"]`).elementHandle()).contentFrame();await outer.frameLocator('iframe').getByRole('textbox',{name:'Ask Pebble',exact:true}).waitFor({state:'attached'});return outer.childFrames()[0];};
 const a=compare?await child('A'):frame,b=compare?await child('B'):null,input=a.getByRole('textbox',{name:path.endsWith('/work')?'Work with Pebble':'Ask Pebble',exact:true});
 for(const f of [a,b].filter(Boolean))await f.locator('textarea').evaluate((x:HTMLTextAreaElement)=>x.addEventListener('keydown',e=>{x.dataset.key=JSON.stringify({trusted:e.isTrusted,composing:e.isComposing});},{capture:true}));
 await input.focus();const cdp=await context.newCDPSession(page);await cdp.send('Input.imeSetComposition',{text:'未確定',selectionStart:3,selectionEnd:3});await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 assert.deepEqual(JSON.parse(await input.getAttribute('data-key')),{trusted:true,composing:true});assert.match(await input.inputValue(),/未確定/);assert.equal(await a.locator('.chat-message.user').count(),0);
 if(b){await expect(b.locator('textarea')).toHaveValue(await input.inputValue());assert.deepEqual(JSON.parse(await b.locator('textarea').getAttribute('data-key')),{trusted:false,composing:true});assert.equal(await b.locator('.chat-message.user').count(),0);}await audit('composing',a);
 await cdp.send('Input.insertText',{text:'Completed message'});const value=(await input.inputValue()).trim();assert.ok(value);await input.press('Enter');await expect(a.locator('.chat-message.user')).toHaveText([value]);await expect(input).toHaveValue('');
 if(b){await expect(b.locator('.chat-message.user')).toHaveText([value]);await expect(b.locator('textarea')).toHaveValue('');}await input.fill('Next draft');await audit('sent',a);
 if(b){if(width<=760)await page.getByRole('button',{name:'Show palette B',exact:true}).filter({visible:true}).first().click();await audit('sent-b',b);}
});
