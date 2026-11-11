import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
await checkBug('tooltip-escape',['/dashboards/ai-chatbot','/tervix/demo'],async({page,frame,path,audit})=>{
 const workspace=path.includes('chatbot'),button=frame.locator(workspace?'.dictate':'#display-action'),tip=frame.locator(workspace?'.ui-tooltip:visible':'.demo-tip:visible');
 if(!workspace)await frame.locator('#search').fill('Team');
 await button.focus();assert.equal(await tip.count(),1);await audit('focused-tooltip');
 await page.keyboard.press('Escape');await audit('dismissed-tooltip');
 assert.equal(await tip.count(),0);assert.equal(await button.evaluate(el=>el===document.activeElement),true);
 await button.blur();await button.hover();assert.equal(await tip.count(),1);await page.keyboard.press('Escape');assert.equal(await tip.count(),0);
});
