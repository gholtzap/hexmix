import {clickToolbarAction} from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
const base=process.env.APP_URL || 'http://127.0.0.1:3000';
const out='artifacts/dashboards';await mkdir(out,{recursive:true});
const browser=await chromium.launch();const reports=[],errors=[];
const views=['chat','work','space','scheduled','plugins','sites','skills'];
async function audit(page,view,state,width,theme){
 const record=async mode=>{await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity));let report={findings:[]};try{await expectUI(page,{attach:async(_,a)=>{report=JSON.parse(String(a.body));}});}catch(e){if(!report.findings.length)throw e;}reports.push({view,state,width,theme:mode,report});};
 await record(theme);
 if(theme==='dark'&&state!=='default'&&view!=='editor'){
  const saved=await page.locator('html').getAttribute('style');
  await page.evaluate(()=>Object.entries({text:'#171717',background:'#ffffff',primary:'#171717',secondary:'#f1f1f1',accent:'#626262'}).forEach(([k,v])=>document.documentElement.style.setProperty('--p-'+k,v)));
  await record('light');
  await page.evaluate(style=>{if(style===null)document.documentElement.removeAttribute('style');else document.documentElement.setAttribute('style',style);},saved);
  await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity));
 }
}
async function drawer(page,width){if(width<700)await page.getByRole('button',{name:'Open sidebar',exact:true}).click();}
try{
 for(const width of (process.env.DASHBOARD_QUICK ? [1440] : [1440,390])){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource: the server responded with a status of 503/.test(message.text()))errors.push(message.text());});
  for(const view of views){
   await page.goto(`${base}/dashboard-previews/workspace/index.html?view=${view}`);await page.locator('[data-app-ready]').waitFor();
   if(view==='chat'||view==='work')assert.equal(await page.locator('.side-title').innerText(),'Pebble');
   await audit(page,view,'default',width,'dark');await page.screenshot({path:`${out}/${view}-${width}.png`});
   const media=page.locator('.space-template-art img, img.plug-logo').first();
   let darkMedia;
   if(['space','plugins'].includes(view)){await media.waitFor({state:'attached'});assert.match(await media.getAttribute('src'),/^data:image\/svg\+xml,/);darkMedia=await media.evaluate(node=>getComputedStyle(node).backgroundImage);}
   await page.evaluate(()=>Object.entries({text:'#171717',background:'#ffffff',primary:'#171717',secondary:'#f1f1f1',accent:'#626262'}).forEach(([k,v])=>document.documentElement.style.setProperty('--p-'+k,v)));
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.side-title')).color==='rgb(23, 23, 23)');await audit(page,view,'default',width,'light');
   if(darkMedia)assert.notEqual(await media.evaluate(node=>getComputedStyle(node).backgroundImage),darkMedia,`${view} media must follow the palette`);
   await page.evaluate(()=>Object.entries({text:'#ededed',background:'#0f0f0f',primary:'#ffffff',secondary:'#212121',accent:'#afafaf'}).forEach(([k,v])=>document.documentElement.style.setProperty('--p-'+k,v)));
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.side-title')).color==='rgb(237, 237, 237)');
   if(process.env.DASHBOARD_QUICK)continue;
   if(view==='chat'||view==='work'){
    assert.equal(await page.locator('[data-component=halaska-segmented-control] [role=radiogroup]').count(),1);
    await page.getByRole('button',{name:/Select Pebble model/}).click();await audit(page,view,'model menu',width,'dark');assert.equal(await page.locator('[data-component=halaska-slider] input').count(),1);await page.getByRole('slider',{name:'Thinking effort',exact:true}).press('Home');await page.getByRole('slider',{name:'Thinking effort',exact:true}).press('ArrowRight');await page.getByRole('slider',{name:'Thinking effort',exact:true}).press('ArrowRight');await page.keyboard.press('Escape');assert.equal(await page.locator('.power-label').innerText(),'High');
    await page.getByRole('button',{name:'Add files and more',exact:true}).click();await audit(page,view,'add menu',width,'dark');assert.equal(await page.locator('[data-component=halaska-dropdown-menu] [role=menu]').count(),1);await page.keyboard.press('Escape');
    if(view==='chat'&&width===1440){
     await page.getByRole('button',{name:'Add files and more',exact:true}).click();await page.getByRole('menuitem',{name:'Sketch',exact:true}).click();
     const canvas=page.locator('.sketch-canvas');await canvas.waitFor();
     const box=await canvas.boundingBox();await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.mouse.move(box.x+100,box.y+40,{steps:5});await page.mouse.up();
     const sample=()=>canvas.evaluate(node=>{const data=(node as HTMLCanvasElement).getContext('2d').getImageData(0,0,(node as HTMLCanvasElement).width,(node as HTMLCanvasElement).height).data;return{background:[...data.slice(0,3)],ink:[...data].filter((_,index)=>index%4===0&&data[index]!==data[0]).length};});
     assert((await sample()).ink>0,'Sketch must retain a drawn line');
     await page.evaluate(()=>{document.documentElement.style.setProperty('--p-background','#f3f8ff');document.documentElement.style.setProperty('--p-text','#19304c');});
     await page.waitForFunction(()=>{const data=(document.querySelector('.sketch-canvas') as HTMLCanvasElement)?.getContext('2d').getImageData(0,0,1,1).data;return data?.[0]===243&&data?.[1]===248&&data?.[2]===255;});
     assert((await sample()).ink>0,'Sketch must keep its line after a palette change');
     await page.keyboard.press('Escape');
     await page.evaluate(()=>{document.documentElement.style.setProperty('--p-background','#0f0f0f');document.documentElement.style.setProperty('--p-text','#ededed');});
    }
    await page.getByRole('button',{name:'Start Voice',exact:true}).click();await audit(page,view,'voice dialog',width,'dark');assert.equal(await page.locator('[data-component=halaska-card-dialog] [data-component=aicss-orb]').count(),1);await page.getByRole('button',{name:'Close dialog',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Use message');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Close dialog');await page.keyboard.press('Escape');
    await page.locator('textarea').fill('<b>Plan a launch</b>');await page.locator('textarea').press('Enter');assert.equal(await page.locator('.chat-message.user').innerText(),'<b>Plan a launch</b>');assert.equal(await page.locator('.chat-message.user b').count(),0);await audit(page,view,'conversation',width,'dark');assert((await page.locator('[data-component=aicss-text-response]').innerText()).includes('Plan a launch'));
    await drawer(page,width);await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('searchbox',{name:'Search chats'}).fill('zzzzzzzz');assert.equal(await page.getByText('No chats found',{exact:true}).count(),1);await audit(page,view,'empty search dialog',width,'dark');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    if(view==='chat'){await page.getByRole('button',{name:'Explore',exact:true}).click();await audit(page,view,'Explore menu',width,'dark');await page.getByRole('menuitem',{name:'Projects',exact:true}).click();await audit(page,view,'project dialog',width,'dark');await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'JD · Jamie Davis · Open profile menu',exact:true}).click();await audit(page,view,'profile menu',width,'dark');await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await audit(page,view,'settings dialog',width,'dark');await page.getByRole('button',{name:'Close dialog',exact:true}).click();}
   }else if(view==='space'||view==='sites'){
    await page.getByRole('button',{name:'Grid view',exact:true}).click();assert.equal(await page.locator('.space-file-grid').count(),1);await audit(page,view,'grid',width,'dark');await page.getByRole('button',{name:'List view',exact:true}).click();
    await page.locator('#space-search').fill('zzzzzzzz');assert.equal(await page.getByText('Folder is empty',{exact:true}).count(),1);await audit(page,view,'empty search',width,'dark');await page.locator('#space-search').fill('');
    if(view==='space'){await page.getByRole('tab',{name:'Shared with you',exact:true}).click();assert.equal(await page.getByText('Folder is empty',{exact:true}).count(),1);await page.getByRole('tab',{name:'Your items',exact:true}).click();await page.locator('main [data-space-open]').filter({hasText:'Team notes.md'}).last().click();}else await page.locator('[data-space-open]').filter({hasText:'Studio portfolio'}).last().click();
    await audit(page,view,'document dialog',width,'dark');await page.locator('[role=dialog] textarea').fill('Saved sample content');await page.getByRole('button',{name:'Save',exact:true}).click();
   }else if(view==='scheduled'){
    await page.getByRole('button',{name:/Business updates Send/}).click();await audit(page,view,'task dialog',width,'dark');await page.getByLabel('Title',{exact:true}).fill('<b>News sample</b>');await page.getByRole('button',{name:'Save',exact:true}).click();await drawer(page,width);await page.getByRole('button',{name:'<b>News sample</b>',exact:true}).click();assert.equal(await page.locator('[role=dialog] b').count(),0);await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'<b>News sample</b> Paused',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await page.getByText('No scheduled tasks',{exact:true}).count(),1);
   }else if(view==='plugins'){
    await page.getByRole('searchbox',{name:'Search plugins',exact:true}).fill('zzzzzzzz');await audit(page,view,'empty search',width,'dark');await page.getByRole('searchbox',{name:'Search plugins',exact:true}).fill('');await page.getByRole('tab',{name:'Personal',exact:true}).click();await audit(page,view,'personal',width,'dark');await page.getByRole('tab',{name:'Public',exact:true}).click();await page.locator('[data-plug-detail="Team tool 05"]').last().click();await audit(page,view,'plugin dialog',width,'dark');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
   }else{await page.locator('[data-plug-skill]').first().click();await audit(page,view,'skill dialog',width,'dark');await page.getByRole('button',{name:'Close dialog',exact:true}).click();}
   if(width===390){await page.goto(`${base}/dashboard-previews/workspace/index.html?view=${view}`);await page.locator('[data-app-ready]').waitFor();await drawer(page,width);await audit(page,view,'sidebar open',width,'dark');}
  }
  if(process.env.DASHBOARD_QUICK){await context.close();continue;}
  await page.route('**/catalog.json',route=>route.fulfill({status:503,body:'Not available'}));
  await page.goto(base+'/dashboard-previews/workspace/index.html?view=plugins');await page.getByText('The plugin catalogue could not load.',{exact:false}).waitFor();await audit(page,'plugins','load error',width,'dark');await page.unroute('**/catalog.json');
  // The editor must keep the palette and use the current route when sharing.
  await page.goto(base+'/dashboards/ai-chatbot');await page.locator('[data-app-ready]').waitFor();let frame=page.frameLocator('iframe');await frame.getByRole('radio',{name:'Work',exact:true}).click();await page.waitForURL('**/dashboards/ai-chatbot/work');assert.equal(await frame.getByRole('heading',{name:'What should we work on?',exact:true}).count(),1);await page.goBack();await page.waitForURL('**/dashboards/ai-chatbot');await frame.getByRole('heading',{name:'What’s on your mind today?',exact:true}).waitFor();await page.goForward();await page.waitForURL('**/dashboards/ai-chatbot/work');await frame.getByRole('heading',{name:'What should we work on?',exact:true}).waitFor();
  await clickToolbarAction(page, 'Use light palette');assert.notEqual(await frame.locator('html').evaluate(e=>e.style.getPropertyValue('--p-background')),'#0f0f0f');await clickToolbarAction(page, 'Reset palette and fonts');assert.equal(await frame.locator('html').evaluate(e=>e.style.getPropertyValue('--p-background')),'#0f0f0f');
  await clickToolbarAction(page, 'Share palette');assert.equal(new URL(await page.evaluate(()=>navigator.clipboard.readText())).pathname,'/dashboards/ai-chatbot/work');await page.reload();await page.locator('[data-app-ready]').waitFor();await frame.getByRole('heading',{name:'What should we work on?',exact:true}).waitFor();await audit(page,'editor','toolbar',width,'dark');
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('All dashboard actions passed at desktop and mobile sizes.');
}finally{await browser.close();await writeFile(`${out}/ui-states.json`,JSON.stringify(reports,null,2));await writeFile(`${out}/browser-errors.json`,JSON.stringify(errors,null,2));}
const count=reports.reduce((n,r)=>n+r.report.findings.length,0);console.log(`${reports.length} UI states checked; ${count} findings. Report: ${out}/ui-states.json`);if(count)process.exitCode=1;
