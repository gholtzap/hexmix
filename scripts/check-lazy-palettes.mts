import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {checkPage} from 'lintapple';
import {initialPalette,defaultDarkPalette,paletteQuery,readPalette} from '../src/lib/palette.ts';
import {presets} from '../src/lib/palette-presets.ts';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const base=process.env.APP_URL||'http://127.0.0.1:3335',out='artifacts/lazy-palettes';
await mkdir(out,{recursive:true});const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const browser=await chromium.launch(),flows=[],reports=[],errors=[];
async function audit(page,state){let report={findings:[]},attached=false;try{await expectUI(page,{attach:async(_,data)=>{attached=true;report=JSON.parse(String(data.body));}},policy);}catch(error){if(!attached)throw error;}reports.push({state,report});}
const libraryResponse=page=>page.waitForResponse(async r=>r.url().includes('/_next/static/')&&r.url().includes('.js')&&(await r.text()).includes('Sanzo Wada '));
try{
for(const width of [390,1440])for(const[mode,palette]of[['light',initialPalette],['dark',defaultDarkPalette]]as const){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:mode});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 try{
  const scripts=[],pending=[];page.on('response',r=>{if(r.url().includes('/_next/static/')&&r.url().includes('.js'))pending.push(r.text().then(text=>scripts.push(text)));});
  await page.goto(`${base}/?${paletteQuery(palette)}`);await page.locator('[data-app-ready]').waitFor();await page.waitForLoadState('networkidle');await Promise.all(pending);
  assert.equal(scripts.some(text=>text.includes('Sanzo Wada ')),false,'The full palette library must not load before intent');
  const library=libraryResponse(page);
  if(width===1440){const trigger=page.getByRole('button',{name:'Palettes',exact:true});if(mode==='light')await trigger.hover();else await trigger.focus();await library;assert.equal(await page.locator('.palette-panel').count(),0);await trigger.press('Enter');}
  else {await clickToolbarAction(page,'Palettes');await library;}
  await page.getByRole('button',{name:'Save palette',exact:true}).waitFor();await audit(page,`${width}-${mode}-open`);
  await page.getByRole('button',{name:'Browse all palettes',exact:true}).click();const search=page.getByRole('searchbox',{name:'Search palettes'});await search.fill('Sanzo Wada');
  const list=page.locator(width===390?'.palette-panel-body':'[data-collection="presets"]:visible');
  const scroll=await list.evaluate(n=>{n.scrollTop=120;n.dispatchEvent(new Event('scroll'));return n.scrollTop;});assert(scroll>0);
  await page.getByRole('button',{name:'Close palettes',exact:true}).click();await clickToolbarAction(page,'Palettes');await search.waitFor();assert.equal(await search.inputValue(),'Sanzo Wada');assert.equal(await list.evaluate(n=>n.scrollTop),scroll,'Close must preserve list scroll');
  await search.fill('Sanzo Wada 24');const shared=page.url();await audit(page,`${width}-${mode}-filtered`);
  await search.fill('no-match-deferred-check');await page.getByText('No palettes match your search.',{exact:true}).waitFor();await audit(page,`${width}-${mode}-empty`);
  await search.fill('Sanzo Wada 1');await page.getByRole('button',{name:'Apply Sanzo Wada 1',exact:true}).click();assert.equal(readPalette(new URL(page.url()).search)?.primary,presets.find(p=>p.id==='sanzo-wada-1')!.colors.primary);
  await page.getByRole('button',{name:'Save palette',exact:true}).click();await page.getByRole('textbox',{name:'Palette name',exact:true}).fill('');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('Enter a palette name.',{exact:true}).waitFor();await audit(page,`${width}-${mode}-name-error`);
  await page.getByRole('textbox',{name:'Palette name',exact:true}).fill('Deferred check');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Apply Deferred check',exact:true}).waitFor();await audit(page,`${width}-${mode}-saved`);
  await page.screenshot({path:`${out}/${width}-${mode}-saved.png`});assert.equal(scripts.filter(text=>text.includes('Sanzo Wada ')).length,1,'Reopening must reuse the library');
  const restored=await context.newPage();await restored.goto(shared);await restored.getByRole('searchbox',{name:'Search palettes'}).waitFor();assert.equal(await restored.getByRole('searchbox',{name:'Search palettes'}).inputValue(),'Sanzo Wada 24');await audit(restored,`${width}-${mode}-shared-view`);await restored.close();
  flows.push({width,mode,state:'palette actions and shared view',passed:true});
 }finally{await context.close();}
 // Hold the deferred requests to verify the first-open loading state and dismissal.
 const slow=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:mode});const slowPage=await slow.newPage();slowPage.setDefaultTimeout(15000);let release;const gate=new Promise<void>(r=>{release=r;});
 try{
  await slowPage.goto(`${base}/?${paletteQuery(palette)}`);await slowPage.locator('[data-app-ready]').waitFor();await slowPage.waitForLoadState('networkidle');
  await slowPage.route('**/_next/static/**/*.js',async route=>{await gate;await route.continue();});
  await clickToolbarAction(slowPage,'Palettes');await slowPage.getByRole('status').filter({hasText:'Loading palettes…'}).waitFor();await audit(slowPage,`${width}-${mode}-loading`);await slowPage.screenshot({path:`${out}/${width}-${mode}-loading.png`});
  await slowPage.keyboard.press('Escape');await slowPage.locator('.palette-panel').waitFor({state:'hidden'});await slowPage.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,width===390?'More tools':'Palettes');await clickToolbarAction(slowPage,'Palettes');release();await slowPage.getByRole('button',{name:'Save palette',exact:true}).waitFor();
  flows.push({width,mode,state:'slow first load and reopen',passed:true});
 }finally{release();await slow.close();}
 const compare=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:mode});const cp=await compare.newPage();cp.setDefaultTimeout(15000);
 try{
  await cp.goto(`${base}/compare?preview=workspace&mode=${mode}`);await cp.locator('[data-app-ready]').waitFor();
  for(const side of['A','B']){if(width===390)await cp.getByRole('button',{name:`Show palette ${side}`,exact:true}).filter({visible:true}).click();const frame=await(await cp.locator(`iframe[title="Palette ${side} preview"]`).elementHandle())!.contentFrame();await frame!.locator('[data-app-ready]').waitFor();const trigger=frame!.getByRole('button',{name:'Palettes',exact:true});if(await trigger.isVisible()){await trigger.focus();await trigger.press('Enter');}else{const more=frame!.getByRole('button',{name:'More tools',exact:true});await more.focus();await more.press('Enter');const item=frame!.getByRole('menuitem',{name:'Palettes',exact:true});if(!await item.isVisible()){const edit=frame!.getByRole('menuitem',{name:'Edit',exact:true});await edit.focus();await edit.press('Enter');}await item.focus();await item.press('Enter');}await frame!.getByRole('button',{name:'Save palette',exact:true}).waitFor();assert.equal(await frame!.getByRole('tab',{name:'Saved',exact:true}).getAttribute('aria-selected'),'true');await frame!.getByText('No saved palettes yet.',{exact:true}).waitFor();const report=await checkPage(frame!,policy);reports.push({state:`${width}-${mode}-compare-${side}`,report});await frame!.getByRole('button',{name:'Close palettes',exact:true}).click();}
  flows.push({width,mode,state:'both comparison toolbars',passed:true});
 }finally{await compare.close();}
 console.log(width,mode,'passed');
}
assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(`${out}/actions.json`,JSON.stringify({flows,reports,errors},null,2));}
const findings=reports.reduce((n,x)=>n+x.report.findings.length,0);console.log(flows.length,'flows;',reports.length,'UI scans;',findings,'findings');if(findings)process.exitCode=1;
