import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {checkPage} from 'lintapple';
import {initialPalette,defaultDarkPalette,paletteQuery} from '../src/lib/palette.ts';
import {copyTheme} from '../src/lib/theme-transfer.ts';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const base=process.env.APP_URL||'http://127.0.0.1:3100',out='artifacts/native-paste';
const policy=JSON.parse(await readFile('ui-policy.json','utf8')),reports=[],errors=[];
await mkdir(out,{recursive:true});const browser=await chromium.launch();
async function audit(page,state,width,theme){await assertSingleRow(page);let report={findings:[]};try{await expectUI(page,{attach:async(_,a)=>{report=JSON.parse(String(a.body));}},policy);}finally{reports.push({state,width,theme,report});await writeFile(`${out}/ui.json`,JSON.stringify(reports,null,2));}}
async function assertSingleRow(page){
 const bar=page.locator('.color-toolbar');if(!await bar.isVisible())return;
 const bounds=await bar.boundingBox();assert(bounds.height<=76,`Toolbar uses more than one row: ${bounds.height}px`);
 const viewport=await page.evaluate(()=>innerWidth);assert(bounds.x>=0&&bounds.x+bounds.width<=viewport, 'Toolbar exceeds the viewport');
 for(const control of await bar.locator('button:visible').all()){const box=await control.boundingBox();assert(box.y>=bounds.y&&box.y+box.height<=bounds.y+bounds.height&&box.x>=bounds.x&&box.x+box.width<=bounds.x+bounds.width,'Toolbar control exceeds its row');}
}
async function paletteInURL(page,expected){await page.waitForFunction(colors=>new URLSearchParams(location.search).get('colors')===colors,new URLSearchParams(paletteQuery(expected)).get('colors'));}
async function clipboard(page,text){await page.evaluate(text=>navigator.clipboard.writeText(text),text);}
async function nativePaste(page,text){await clipboard(page,text);await page.keyboard.press('ControlOrMeta+V');}
async function focusBody(page){await page.locator('body').evaluate(n=>{n.tabIndex=-1;n.focus();});}
const raw='#111 #eee #abc #def #123',parsed={text:'#111111',background:'#eeeeee',primary:'#aabbcc',secondary:'#ddeeff',accent:'#112233'};
try{
 for(const width of [320,390,768,1024,1440,1920])for(const theme of ['light','dark'] as const){
  const context=await browser.newContext({viewport:{width,height:width<=390?844:900},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const original=theme==='light'?initialPalette:defaultDarkPalette;
  await page.goto(`${base}/?${paletteQuery(original)}&heading=Arial&body=Verdana`,{waitUntil:'domcontentloaded'});await page.locator('[data-app-ready]').waitFor();
  const more=page.getByRole('button',{name:'More tools',exact:true});
  if(await more.isVisible()){await more.click();if(width<=1200)for(const label of ['Copy palette','Paste palette or theme','Copy theme and settings','Copy for AI','Undo paste'])assert.equal((await page.getByRole('menuitem',{name:label,exact:true}).innerText()).trim(),label);await audit(page,'More tools menu',width,theme);await page.keyboard.press('Escape');}
  for(const [label,check] of [['Copy palette',text=>assert.deepEqual(JSON.parse(text),original)],['Copy theme and settings',text=>assert.deepEqual(JSON.parse(text).fonts,{heading:'Arial',body:'Verdana'})],['Copy for AI',text=>{assert(text.includes('4.5:1'));assert(text.includes('--color-primary'));assert(text.includes('Arial'));}]] as const){await clickToolbarAction(page,label);check(await page.evaluate(()=>navigator.clipboard.readText()));assert.equal(await page.locator('dialog[open]').count(),0);await page.mouse.move(1,1);await audit(page,label,width,theme);}
  const elements=[{path:'/avenlo',selector:'body > main:nth-of-type(1)',property:'color',role:'accent'}] as const;
  await focusBody(page);await nativePaste(page,copyTheme({colors:initialPalette,fonts:{heading:'Inter',body:'Lora'},elements:[...elements]}));await paletteInURL(page,initialPalette);await page.waitForFunction(()=>new URLSearchParams(location.search).get('heading')==='Inter');assert.deepEqual(JSON.parse(new URL(page.url()).searchParams.get('elements')),elements);assert.equal(await page.locator('dialog[open]').count(),0);await audit(page,'page-level keyboard theme paste',width,theme);
  await page.keyboard.press('ControlOrMeta+V');await page.getByRole('status').filter({hasText:'Theme already applied.'}).waitFor();await clickToolbarAction(page,'Undo paste');await paletteInURL(page,original);assert.equal(new URL(page.url()).searchParams.get('heading'),'Arial');assert.equal(new URL(page.url()).searchParams.has('elements'),false);
  await focusBody(page);await nativePaste(page,'not a palette');await page.getByRole('status').filter({hasText:'Clipboard has no valid palette or theme.'}).waitFor();await paletteInURL(page,original);assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.getByRole('button',{name:'Edit pasted theme',exact:true}).count(),0);await audit(page,'invalid paste without a modal',width,theme);
  // A denied Clipboard API does not block the browser's normal keyboard paste event.
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'readText',{configurable:true,value:()=>Promise.reject(new Error('denied'))}));await clickToolbarAction(page,'Paste palette or theme');await page.getByRole('status').filter({hasText:'Use Command+V or Ctrl+V'}).waitFor();assert.equal(await page.locator('dialog[open]').count(),0);await audit(page,'clipboard permission denial without a modal',width,theme);
  await focusBody(page);await nativePaste(page,raw);await paletteInURL(page,parsed);await audit(page,'native paste without read permission',width,theme);
  await clickToolbarAction(page,'Hide color toolbar');await focusBody(page);await nativePaste(page,'#222 #fff #999 #aaa #bbb');await paletteInURL(page,{text:'#222222',background:'#ffffff',primary:'#999999',secondary:'#aaaaaa',accent:'#bbbbbb'});await page.getByRole('button',{name:'Open color toolbar',exact:true}).click();
  const unchanged=new URL(page.url()).searchParams.get('colors');
  for(const tag of ['textarea','div']){await page.evaluate(tag=>{const node=document.createElement(tag);node.id='native-paste-field';if(tag==='div')node.contentEditable='true';document.body.append(node);node.focus();},tag);await nativePaste(page,raw);assert.equal(await page.locator('#native-paste-field').evaluate(n=>n instanceof HTMLTextAreaElement?n.value:n.textContent),raw);assert.equal(new URL(page.url()).searchParams.get('colors'),unchanged);await page.locator('#native-paste-field').evaluate(n=>n.remove());}
  await page.evaluate(()=>{const node=document.createElement('input');node.type='button';node.id='paste-button-fixture';document.body.append(node);node.focus();});await nativePaste(page,raw);await paletteInURL(page,parsed);await page.locator('#paste-button-fixture').evaluate(n=>n.remove());
  await page.mouse.move(1,1);await page.screenshot({path:`${out}/${width}-${theme}.png`});await context.close();
 }
 for(const route of ['/editor','/avenlo','/tervix','/orvian','/nuvexa','/dashboards/ai-chatbot','/dashboards/infra-dashboard'])for(const width of [390,1440])for(const theme of ['light','dark'] as const){const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();await page.goto(`${base}${route}`);await page.locator('[data-app-ready]').waitFor();if(route==='/editor')await focusBody(page);else{const preview=page.frameLocator('iframe');await page.locator('iframe[data-preview-ready=true]').waitFor();await preview.locator('body').click({position:{x:4,y:4}});}await nativePaste(page,raw);await paletteInURL(page,parsed);assert.equal(await page.locator('dialog[open]').count(),0);await audit(page,`${route} keyboard paste`,width,theme);if(route==='/dashboards/ai-chatbot'){const input=page.frameLocator('iframe').locator('.composer textarea');await input.focus();await nativePaste(page,raw);assert.equal(await input.inputValue(),raw);await paletteInURL(page,parsed);}await context.close();}
 for(const width of [390,1440])for(const theme of ['light','dark'] as const){const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();await page.goto(`${base}/compare?preview=avenlo`);await page.locator('[data-app-ready]').waitFor();const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());await frame.locator('[data-app-ready]').waitFor();await focusBody(page);await nativePaste(page,raw);await frame.waitForFunction(()=>document.querySelector<HTMLButtonElement>('[aria-label="Undo paste"]')?.disabled===false);await clickToolbarAction(frame,'Copy palette');assert.deepEqual(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())),parsed);await page.mouse.move(1,1);await assertSingleRow(frame);const report=await checkPage(frame,policy);reports.push({state:'comparison parent keyboard paste',width,theme,report});assert.deepEqual(report.findings,[]);assert.equal(await frame.locator('dialog[open]').count(),0);await context.close();}
 assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(`${out}/ui.json`,JSON.stringify(reports,null,2));}
console.log(`${reports.length} UI checks passed: native keyboard paste, invalid input, denied API access, iframe previews, full-theme undo, comparison paste, and native text editing.`);
