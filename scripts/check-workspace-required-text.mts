import assert from 'node:assert/strict';
import {checkBug,openChatSidebar} from './lib/bug-flow.mts';
await checkBug('workspace-required-text',['/dashboards/ai-chatbot','/dashboards/ai-chatbot/plugins'],async({frame,path,audit})=>{
 const plugin=path.endsWith('plugins');
 if(plugin){await frame.getByRole('button',{name:'Add plugin',exact:true}).click();await frame.getByRole('menuitem',{name:'Create plugin',exact:true}).click();}
 else{await openChatSidebar(frame);await frame.getByRole('button',{name:'Add new project',exact:true}).click();}
 const panel=frame.getByRole('dialog'),field=panel.getByLabel(plugin?'Name':'Project name',{exact:true}),submit=panel.getByRole('button',{name:plugin?'Create plugin':'Create project',exact:true});
 await field.fill('   ');if(plugin)await panel.getByLabel('Description',{exact:true}).fill('A useful review plugin');await submit.click();await audit('invalid-name');
 assert.notEqual(await field.evaluate((el:HTMLInputElement)=>el.validationMessage),'');assert.equal(await panel.count(),1);
 await field.fill('Review planning');if(plugin){await panel.getByLabel('Description',{exact:true}).fill('   ');await submit.click();assert.notEqual(await panel.getByLabel('Description',{exact:true}).evaluate((el:HTMLInputElement)=>el.validationMessage),'');await panel.getByLabel('Description',{exact:true}).fill('A useful review plugin');}
 await submit.click();await panel.waitFor({state:'hidden'});await audit('valid-name');
});
