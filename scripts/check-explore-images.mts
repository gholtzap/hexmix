import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {checkBug,openChatSidebar} from './lib/bug-flow.mts';
await checkBug('HX-054','/dashboards/ai-chatbot/space',async({page,frame:f,audit})=>{
 await openChatSidebar(f);await f.locator('[data-space-type="Pages"]').click();await f.getByRole('tab',{name:'Favorites',exact:true}).click();await f.getByRole('searchbox',{name:'Search Space',exact:true}).fill('No matching image');
 await openChatSidebar(f);await f.getByRole('button',{name:'Explore',exact:true}).click();await audit('explore');await f.getByRole('menuitem',{name:'Images',exact:true}).click();
 await expect(f.getByRole('heading',{name:'Images',exact:true})).toBeVisible();await expect(f.locator('[data-space-type="Images"]')).toHaveClass(/active/);await expect(f.getByRole('tab',{name:'Your items',exact:true})).toHaveAttribute('aria-selected','true');await expect(f.getByRole('searchbox',{name:'Search Space',exact:true})).toHaveValue('');assert.deepEqual(await f.locator('.space-item-name').allTextContents(),['Team illustration']);
 await f.getByRole('searchbox',{name:'Search Space',exact:true}).fill('Team illustration');await audit('images');await page.reload();await page.locator('[data-app-ready]').waitFor();const reloaded=page.frames().find(x=>x!==page.mainFrame());await reloaded.getByRole('heading',{name:'Images',exact:true}).waitFor();assert.deepEqual(await reloaded.locator('.space-item-name').allTextContents(),['Team illustration']);await audit('reloaded',reloaded);
});
