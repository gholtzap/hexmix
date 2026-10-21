import { clickToolbarAction } from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type Frame, type FrameLocator } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { checkPage } from 'lintapple';

const base=process.env.APP_URL||'http://127.0.0.1:3000';
const output='artifacts/confirmed-fixes';await mkdir(output,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const browser=await chromium.launch();const actions=[],ui=[],errors=[];
const combinations=process.env.FIX_QUICK?[{width:1440,theme:'light'}]:[390,1440].flatMap(width=>['light','dark'].map(theme=>({width,theme})));
const selected=process.argv.slice(2);
async function drawer(f:FrameLocator){const open=f.getByRole('button',{name:'Open sidebar',exact:true});if(await open.isVisible()&&!await f.locator('body').evaluate(e=>e.classList.contains('drawer-open')))await open.click();}
async function audit(p:Page,state:string,width:number,theme:string,child=true){
 await p.mouse.move(1,1);
 await p.waitForTimeout(1000);
 const f=p.frames().find(f=>f.parentFrame());
 if(f)await f.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 let host={findings:[]};let attached=false;
 try{await expectUI(p,{attach:async(_,a)=>{attached=true;host=JSON.parse(String(a.body));}},policy);}catch(e){if(!attached)throw e;}
 ui.push({state,width,theme,surface:'editor',report:host});
 if(child&&f)ui.push({state,width,theme,surface:'preview',report:await checkPage(f,policy)});
 await p.screenshot({path:`${output}/${state}-${width}-${theme}.png`});
}
async function run(id:string,path:string,width:number,theme:string,test:(p:Page,f:FrameLocator)=>Promise<void>){
 if(selected.length&&!selected.includes(id))return;
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push({id,width,theme,error:e.message}));
 const colors=theme==='dark'?'ededed-171717-e98878-333333-a8655f':'171717-ffffff-e98878-ffe291-a8655f';
 try{await p.goto(`${base}${path}?colors=${colors}`);await p.locator('[data-app-ready]').waitFor();const f=p.frameLocator('iframe');if(path!=='/')await f.locator('[data-app-ready]').waitFor();await test(p,f);actions.push({id,width,theme,passed:true});console.log(id,width,theme,'passed');}
 catch(e){actions.push({id,width,theme,passed:false,error:e.message});console.error(id,width,theme,e.message);await p.screenshot({path:`${output}/failed-${id}-${width}-${theme}.png`}).catch(()=>{});}
 finally{await context.close();}
}
try{for(const {width,theme}of combinations){
 await run('palettes','/',width,theme,async(p)=>{
  const save=async(page:Page,name:string)=>{await clickToolbarAction(page, 'Palettes');await page.getByRole('button',{name:'Save palette',exact:true}).click();await page.getByLabel('Palette name',{exact:true}).fill(name);await page.getByRole('button',{name:'Save',exact:true}).click();};
  const second=await p.context().newPage();await second.goto(base+'/?colors=111111-eeeeee-ffaa00-aa00ff-00aaff');await second.locator('[data-app-ready]').waitFor();
  await save(p,'Palette A');await save(second,'Palette B');await second.waitForFunction(()=>JSON.parse(localStorage.getItem('hue-palettes-v1')||'[]').some(p=>p.name==='Palette B'));
  assert.equal((await second.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1')||'[]'))).length,2);
  await p.getByRole('button',{name:'Apply Palette B',exact:true}).waitFor();
  await p.getByRole('button',{name:'More actions for Palette A',exact:true}).click();await p.getByRole('menuitem',{name:'Rename palette',exact:true}).click();await p.getByLabel('Palette name',{exact:true}).fill('Renamed A');await p.getByRole('button',{name:'Save name',exact:true}).click();await second.getByRole('button',{name:'Apply Renamed A',exact:true}).waitFor();
  await second.getByRole('button',{name:'More actions for Palette B',exact:true}).click();await second.getByRole('menuitem',{name:'Remove palette',exact:true}).click();await p.getByRole('button',{name:'Apply Palette B',exact:true}).waitFor({state:'detached'});
  await audit(p,'palette-sync',width,theme,false);
  const pages=await Promise.all([333333,444444].map(async value=>{const page=await p.context().newPage();await page.goto(`${base}/?colors=171717-ffffff-${value}-eeeeee-aaaaaa`);await page.locator('[data-app-ready]').waitFor();return page;}));
  await Promise.all(pages.map((page,i)=>save(page,`Concurrent ${i}`)));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('hue-palettes-v1')||'[]').length===3);
  const storage=await p.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1')||'[]'));assert.deepEqual(storage.map(p=>p.name).sort(),['Concurrent 0','Concurrent 1','Renamed A']);
  await p.getByRole('button',{name:'Close palettes',exact:true}).click();const color=p.getByRole('button',{name:'Text color',exact:true});await color.click();await p.getByRole('textbox',{name:'Hex',exact:true}).waitFor();await audit(p,'toolbar-color-picker',width,theme,false);
 });
 await run('project-names','/dashboards/infra-dashboard',width,theme,async(p,f)=>{
  await f.getByRole('button',{name:'Project Menu · acme-web',exact:true}).click();await f.getByRole('menuitem',{name:'Settings',exact:true}).click();await f.getByLabel('Project name',{exact:true}).fill('atlas-commerce');await f.getByRole('button',{name:'Save changes',exact:true}).click();assert.match(await f.getByRole('dialog').getByRole('alert').innerText(),/already exists/);await audit(p,'duplicate-project-error',width,theme);
  await f.getByLabel('Project name',{exact:true}).fill('renamed-project');await f.getByRole('button',{name:'Save changes',exact:true}).click();await f.getByRole('button',{name:'renamed-project',exact:true}).waitFor();assert.equal(await f.getByRole('button',{name:'atlas-commerce',exact:true}).count(),1);await audit(p,'project-renamed',width,theme);
 });
 await run('domains','/dashboards/infra-dashboard',width,theme,async(p,f)=>{
  await f.getByRole('button',{name:'Project Menu · acme-web',exact:true}).click();await f.getByRole('menuitem',{name:'Settings',exact:true}).click();await f.getByLabel('Domain',{exact:true}).fill('-bad..com');await f.getByRole('button',{name:'Save changes',exact:true}).click();await f.getByRole('dialog').getByRole('alert').waitFor();await audit(p,'domain-error',width,theme);
  await f.getByLabel('Domain',{exact:true}).fill('app.example.com');await f.getByRole('button',{name:'Save changes',exact:true}).click();await f.getByRole('button',{name:'app.example.com',exact:true}).waitFor();
 });
 await run('repository','/dashboards/infra-dashboard',width,theme,async(p,f)=>{
  const card=f.locator('.vc-project').filter({has:f.getByRole('button',{name:'acme-web',exact:true})});await card.getByRole('button',{name:'Connect Git Repository',exact:true}).click();await f.getByLabel('Repository',{exact:true}).fill('test/linked-repo');await f.getByRole('button',{name:'Connect repository',exact:true}).click();assert.match(await card.locator('.vc-repository').innerText(),/test\/linked-repo/);await card.getByRole('button',{name:'acme-web',exact:true}).click();assert.equal(await f.getByRole('dialog').locator('dt').filter({hasText:'Source'}).evaluate(e=>e.nextElementSibling?.textContent),'test/linked-repo');await audit(p,'repository-details',width,theme);
 });
 await run('support','/dashboards/infra-dashboard/support',width,theme,async(p,f)=>{
  for(const message of ['First case','Second case']){await f.getByRole('button',{name:'New case',exact:true}).click();await f.getByLabel('Subject',{exact:true}).fill('Repeated subject');await f.getByLabel('Message',{exact:true}).fill(message);await f.getByRole('button',{name:'Create case',exact:true}).click();}
  const rows=f.getByRole('row').filter({hasText:'Repeated subject'});await f.getByRole('button',{name:'Repeated subject',exact:true}).first().click();await f.getByRole('button',{name:'Close case',exact:true}).click();const values=await rows.allInnerTexts();assert.equal(values.filter(x=>x.includes('Closed')).length,1);assert.equal(values.filter(x=>x.includes('Open')).length,1);await audit(p,'separate-cases',width,theme);
 });
 await run('trash','/dashboards/ai-chatbot/sites',width,theme,async(p,f)=>{
  await f.getByRole('button',{name:'Actions for Studio portfolio',exact:true}).click();await f.getByRole('menuitem',{name:'Move to trash',exact:true}).click();await drawer(f);await f.getByRole('button',{name:'Trash',exact:true}).click();await f.getByRole('heading',{name:'Trash',exact:true}).waitFor();await f.getByRole('button',{name:'Actions for Studio portfolio',exact:true}).click();await audit(p,'site-trash-menu',width,theme);await f.getByRole('menuitem',{name:'Restore',exact:true}).click();await audit(p,'trash-empty',width,theme);await drawer(f);await f.locator('.rail [data-nav=sites]').click();await f.getByRole('button',{name:'Actions for Studio portfolio',exact:true}).waitFor();
 });
 await run('chat-search','/dashboards/ai-chatbot',width,theme,async(p,f)=>{
  await drawer(f);await f.getByRole('button',{name:'Plan the next quarter',exact:true}).click();await f.getByRole('textbox',{name:'Ask Pebble',exact:true}).fill('Keep this reply in this conversation');await f.getByRole('textbox',{name:'Ask Pebble',exact:true}).press('Enter');const before=await f.locator('.chat-message').allInnerTexts();assert.equal(before.length,4);
  await drawer(f);await f.getByRole('button',{name:'Search',exact:true}).click();await f.getByRole('searchbox',{name:'Search chats',exact:true}).fill('Plan the next quarter');await audit(p,'chat-search-dialog',width,theme);await f.getByRole('dialog').getByRole('button',{name:'Plan the next quarter',exact:true}).click();assert.deepEqual(await f.locator('.chat-message').allInnerTexts(),before);await audit(p,'chat-restored',width,theme);
 });
 await run('draft','/dashboards/ai-chatbot',width,theme,async(p,f)=>{
  const text='Keep this draft while I choose a file';await f.getByRole('textbox',{name:'Ask Pebble',exact:true}).fill(text);await f.getByRole('button',{name:'Add files and more',exact:true}).click();await f.getByRole('menuitem',{name:'Add from library',exact:true}).click();await f.getByRole('heading',{name:'All',exact:true}).waitFor();await drawer(f);await f.locator('.rail [data-nav=chat]').click();assert.equal(await f.getByRole('textbox',{name:'Ask Pebble',exact:true}).inputValue(),text);await audit(p,'draft-restored',width,theme);await drawer(f);await f.getByRole('button',{name:'New chat',exact:true}).click();assert.equal(await f.getByRole('textbox',{name:'Ask Pebble',exact:true}).inputValue(),'');
 });
 await run('profile','/dashboards/ai-chatbot',width,theme,async(p,f)=>{
  await drawer(f);await f.locator('.avatar').click();await f.getByRole('menuitem',{name:'Settings',exact:true}).click();await f.getByLabel('Display name',{exact:true}).fill('Test Person');await f.getByRole('button',{name:'Save settings',exact:true}).click();await drawer(f);await f.locator('.rail [data-nav=space]').click();await f.getByRole('heading',{name:'All',exact:true}).waitFor();await drawer(f);assert.equal(await f.locator('.avatar').getAttribute('aria-label'),'TP · Test Person · Open profile menu');assert.equal(await f.locator('.avatar span[aria-hidden=true]').innerText(),'TP');await f.locator('.avatar').click();await f.getByRole('menuitem',{name:'Test Person · Personal account',exact:true}).waitFor();await audit(p,'saved-profile-menu',width,theme);
 });
 await run('selection','/dashboards/ai-chatbot/space',width,theme,async(p,f)=>{
  await f.getByRole('checkbox',{name:'Select all items',exact:true}).check();await f.getByRole('searchbox',{name:'Search Space',exact:true}).fill('Team notes.md');assert.equal(await f.getByRole('checkbox',{name:'Select Team notes.md',exact:true}).isChecked(),true);assert.equal(await f.getByRole('checkbox',{name:'Select all items',exact:true}).isChecked(),true);await audit(p,'filtered-selection',width,theme);await f.getByRole('searchbox',{name:'Search Space',exact:true}).fill('');await f.getByRole('checkbox',{name:'Select Team notes.md',exact:true}).uncheck();assert.equal(await f.getByRole('checkbox',{name:'Select all items',exact:true}).evaluate((e:HTMLInputElement)=>e.indeterminate),true);await audit(p,'partial-selection',width,theme);
 });
}}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({actions,ui,errors},null,2));}
assert.deepEqual(actions.filter(a=>!a.passed),[]);assert.deepEqual(errors,[]);
const findings=ui.reduce((n,r)=>n+r.report.findings.length,0);console.log(`${actions.length} action flows, ${ui.length} UI checks, ${findings} UI findings.`);if(findings)process.exitCode=1;
