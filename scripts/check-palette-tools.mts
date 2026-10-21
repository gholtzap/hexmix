import {clickToolbarAction} from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {initialPalette,defaultDarkPalette,paletteQuery,paletteExport,paletteExportFormats} from '../src/lib/palette.ts';
import {fonts} from '../src/lib/fonts.ts';
const output='artifacts/palette-tools';await mkdir(output,{recursive:true});
const browser=await chromium.launch(),reports=[],actions=[],errors=[];
let completed=false;
async function audit(page,state,width,theme){
 await page.mouse.move(1,1);
 await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity));
 let report={findings:[]},attached=false;
 try{await expectUI(page,{attach:async(_,data)=>{attached=true;report=JSON.parse(String(data.body));}});}catch(error){if(!attached)throw error;}
 reports.push({state,width,theme,report});
}
try{
 for(const width of [1440,390])for(const [theme,palette] of [['light',initialPalette],['dark',defaultDarkPalette]] as const){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  const query=paletteQuery(palette)+'&heading=Arial&body=Verdana';
  await page.goto('http://127.0.0.1:3000/dashboards/infra-dashboard?'+query);await page.locator('[data-app-ready]').waitFor();
  await clickToolbarAction(page, 'Export palette');
  const dialog=page.getByRole('dialog',{name:'Export',exact:true});
  for(const [format,details] of Object.entries(paletteExportFormats)){
   await dialog.getByLabel('Format',{exact:true}).selectOption(format);
   const expected=paletteExport(format as keyof typeof paletteExportFormats,palette,fonts.Arial,fonts.Verdana);
   assert.equal(await dialog.locator('pre').textContent(),expected);
   await audit(page,`${format} export`,width,theme);
   await dialog.getByRole('button',{name:`Copy ${details.label}`,exact:true}).click();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
   const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:`Download ${details.label}`,exact:true}).click();
   const download=await pending;assert.equal(download.suggestedFilename(),details.filename);assert.equal(await readFile(await download.path(),'utf8'),expected);
   if(format==='json'){const json=JSON.parse(expected);assert.equal(json.colors.primary,palette.primary);assert.equal(json.fonts.heading,fonts.Arial);}
  }
  await page.screenshot({path:`${output}/export-${width}-${theme}.png`});
  await dialog.getByRole('button',{name:'Close export',exact:true}).click();
  await page.getByRole('button',{name:'Palettes',exact:true}).click();await page.getByRole('tab',{name:'Saved',exact:true}).click();await audit(page,'no saved palettes',width,theme);
  await page.getByRole('button',{name:'Save palette',exact:true}).click();
  const name=page.getByRole('textbox',{name:'Palette name',exact:true});
  await name.fill('   ');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('alert').filter({hasText:'Enter a palette name.'}).waitFor();await audit(page,'name validation',width,theme);
  await name.fill('Ocean launch');await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Apply Ocean launch',exact:true}).waitFor();assert.equal(await page.locator('.saved-row [data-capture=infrastructure]').count(),1);await audit(page,'named palette with page preview',width,theme);
  await page.locator('.toast').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'More actions for Ocean launch',exact:true}).click();await audit(page,'saved palette actions',width,theme);
  await page.getByRole('menuitem',{name:'Rename palette',exact:true}).click();await name.fill('Team colors');await audit(page,'rename palette',width,theme);await page.getByRole('button',{name:'Save name',exact:true}).click();
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1'))[0]);assert.equal(record.name,'Team colors');assert.deepEqual(record.colors,palette);
  await page.reload();await page.locator('[data-app-ready]').waitFor();await page.getByRole('button',{name:'Palettes',exact:true}).click();await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByRole('button',{name:'Apply Team colors',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1'))[0].id),record.id);
  await page.getByRole('button',{name:'Browse all palettes',exact:true}).click();const search=page.getByRole('searchbox',{name:'Search palettes',exact:true});await search.fill('team');assert.equal(await page.locator('.saved-row').count(),1);await search.fill('missing');await page.getByText('No palettes match your search.',{exact:true}).waitFor();await audit(page,'empty saved search',width,theme);await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.goto('http://127.0.0.1:3000/avenlo?'+query);await page.locator('[data-app-ready]').waitFor();await page.getByRole('button',{name:'Palettes',exact:true}).click();await page.getByRole('tab',{name:'Saved',exact:true}).click();assert.equal(await page.locator('.saved-row [data-capture=avenlo]').count(),1);await audit(page,'Avenlo saved preview',width,theme);await page.screenshot({path:`${output}/saved-${width}-${theme}.png`});
  await page.getByRole('button',{name:'Apply Team colors',exact:true}).click();
  await page.getByRole('button',{name:'Close palettes',exact:true}).click();await page.goto('http://127.0.0.1:3000/?'+paletteQuery(palette));await page.locator('[data-app-ready]').waitFor();await page.getByRole('button',{name:'Browse palettes',exact:true}).click();await page.getByRole('tab',{name:'Saved',exact:true}).click();assert.equal(await page.locator('.saved-row [data-capture=workspace]').count(),1);await audit(page,'home saved preview',width,theme);
  actions.push({width,theme,exports:3,savedId:record.id});await context.close();
 }
 assert.deepEqual(errors,[]);completed=true;
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({completed,actions,errors,reports},null,2));}
const findings=reports.flatMap(item=>item.report.findings);console.log(`${actions.length} complete flows, ${reports.length} UI states, ${findings.length} findings.`);assert.equal(findings.length,0,JSON.stringify(findings,null,2));
