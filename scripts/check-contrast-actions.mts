import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {measure} from './lib/measure-text-contrast.mts';
import {contrast} from '../src/lib/palette.ts';
const appUrl=process.env.APP_URL??'http://127.0.0.1:3000';
const directory='artifacts/all-surface-contrast';await mkdir(directory,{recursive:true});
const browser=await chromium.launch();const reports=[],failures=[];
try {
 for(const width of [390,1440])for(const [theme,colors] of [['light','ffffff-ffffff-e98878-ffe291-a8655f'],['dark','000000-0c0a09-e98878-ffe291-a8655f']] as const){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
  let source,frame,path;
  const settle=()=>source.waitForFunction(colors=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===colors.split('-').map(color=>'#'+color).join('|'),colors);
  const open=async route=>{path=route;await page.goto(`${appUrl}${route}?colors=${colors}`,{waitUntil:'domcontentloaded'});frame=page.frameLocator('iframe');await frame.locator('html[data-contrast-ready=true]').waitFor();await frame.locator('body').waitFor({state:'visible'});source=page.frames().find(frame=>frame.parentFrame());await settle();};
  const check=async state=>{await source.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>animation.effect.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));});await settle();const text=await measure(source);const bad=text.filter(item=>contrast(item.foreground,item.background)<4.5);let ui={findings:[]};try{await expectUI(page,{attach:async(_,a)=>ui=JSON.parse(String(a.body))});}catch(error){if(!ui.findings.length)throw error;}const record={path,width,theme,state,measurements:text.length,failures:bad,ui};reports.push(record);if(bad.length||ui.findings.length)failures.push(record);await page.screenshot({path:`${directory}/action-${path.replaceAll('/','_')}-${width}-${theme}-${state.replaceAll(' ','-')}.png`});};
  try {
   await open('/avenlo');if(width===390)await frame.locator('.nav__toggle').click();else await frame.getByRole('button',{name:'Solutions',exact:true}).click();await check('navigation open');
   await open('/tervix');if(width===390)assert.ok(await frame.locator('nav a:visible').count());else await frame.getByRole('button',{name:'Platform',exact:true}).click();await check('navigation open');
   await open('/nuvexa');if(width===390)await frame.locator('.mh-header [data-framer-name="Menu Button"]').click();else await frame.locator('.mh-header [data-framer-name="Products"]').hover();await check('navigation open');
   await open('/dashboards/ai-chatbot');await frame.locator('.add-button').click();await check('attachment menu');await frame.getByRole('menuitem',{name:'Add browser tabs',exact:true}).or(frame.locator('.menu button').filter({hasText:'Add browser tabs'})).first().click();await frame.getByRole('dialog').waitFor();await check('page dialog');
   await open('/dashboards/infra-dashboard');
   if(width===390){for(const tab of ['Usage','Alerts','Recents']){await frame.getByRole('radio',{name:tab,exact:true}).click();await check(`selected ${tab.toLowerCase()}`);}
   await frame.getByRole('radio',{name:'Recents',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await frame.getByRole('radio',{name:'Usage',exact:true}).getAttribute('aria-checked'),'true');await check('keyboard tab change');}
   await frame.getByRole('button',{name:'Add New',exact:true}).click();await check('add menu');await frame.getByRole('menuitem',{name:'Project',exact:true}).click();await frame.getByRole('dialog').waitFor();await check('new project dialog');await frame.getByRole('button',{name:'Create Project',exact:true}).click();await frame.getByRole('alert').filter({hasText:'Enter a name.'}).waitFor();await check('validation error');await frame.getByRole('button',{name:'Close dialog',exact:true}).click();await frame.getByRole('searchbox',{name:'Search projects',exact:true}).fill('no-such-project');await check('empty search');
  }catch(error){failures.push({path,width,theme,error:error.message});}
  await page.close();
 }
}finally{await browser.close();await writeFile(`${directory}/actions.json`,JSON.stringify({reports,failures},null,2));}
console.log(`Checked ${reports.length} open menus, dialogs, errors, empty results, and plan states; ${failures.length} failed states.`);if(failures.length){console.log(JSON.stringify(failures.map(f=>({path:f.path,width:f.width,theme:f.theme,state:f.state,error:f.error,failures:f.failures})),null,2));process.exitCode=1;}
