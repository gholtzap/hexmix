import assert from 'node:assert/strict';
import {checkBug,openChatSidebar} from './lib/bug-flow.mts';

await checkBug('explore-project-selection','/dashboards/ai-chatbot',async({frame,audit})=>{
 await openChatSidebar(frame);await frame.getByRole('button',{name:'Explore',exact:true}).click();
 await frame.getByRole('menuitem',{name:'Projects',exact:true}).click();
 await frame.getByRole('dialog').getByRole('button',{name:'Design studio',exact:true}).click();
 await frame.locator('[data-app-ready]').waitFor();await audit('selected-project');
 assert.equal(await frame.locator('.project-badge').innerText(),'Design studio');
 await openChatSidebar(frame);await frame.getByRole('button',{name:'Add new project',exact:true}).click();
 await frame.getByRole('dialog').getByLabel('Project name',{exact:true}).fill('New review project');
 await frame.getByRole('dialog').getByRole('button',{name:'Create project',exact:true}).click();
 await openChatSidebar(frame);await frame.getByRole('button',{name:'Explore',exact:true}).click();await frame.getByRole('menuitem',{name:'Projects',exact:true}).click();
 assert.equal(await frame.getByRole('dialog').getByRole('button',{name:'New review project',exact:true}).count(),1);
 await audit('current-project-list');
});
