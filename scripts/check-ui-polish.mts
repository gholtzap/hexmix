import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const output='artifacts/ui-polish';await mkdir(output,{recursive:true});
const browser=await chromium.launch(),reports=[],actions=[],errors=[];let completed=false;
async function audit(page,state,width,theme){
 await page.mouse.move(1,1);await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity));
 let report={findings:[]},attached=false;try{await expectUI(page,{attach:async(_,data)=>{attached=true;report=JSON.parse(String(data.body));}});}catch(error){if(!attached)throw error;}
 reports.push({state,width,theme,report});if(report.findings.length)await page.screenshot({path:`${output}/finding-${width}-${theme}-${state.replaceAll(' ','-')}.png`});
}
async function clearance(page,width){
 const metrics=await page.locator('iframe').evaluate(e=>({bottom:e.getBoundingClientRect().bottom,top:document.querySelector('.toolbar-anchor').getBoundingClientRect().top,height:document.querySelector('.toolbar-anchor').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.ok(metrics.bottom<=metrics.top-8,JSON.stringify(metrics));assert.equal(metrics.overflow,false);if(width<=560)assert.ok(metrics.height<180,JSON.stringify(metrics));return metrics;
}
try{
 for(const width of [390,1440])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const colors=theme==='light'?'171717-ffffff-e98878-ffe291-a8655f':'ededed-171717-e98878-333333-a8655f';
  await page.goto('http://127.0.0.1:3000/?colors='+colors);await page.locator('[data-app-ready]').waitFor();
  if(width===1440){const gap=await page.locator('.home-intro h1').evaluate(e=>document.querySelector('.home-palette-heading h2').getBoundingClientRect().top-e.getBoundingClientRect().bottom);assert.ok(gap>=32);}
  await audit(page,'home alignment',width,theme);await page.screenshot({path:`${output}/home-${width}-${theme}.png`});
  for(const [name,path] of [['avenlo','/avenlo'],['chat','/dashboards/ai-chatbot'],['infra','/dashboards/infra-dashboard']] as const){
   await page.goto(`http://127.0.0.1:3000${path}?colors=${colors}`);await page.locator('[data-app-ready]').waitFor();const frame=page.frames().find(f=>f.parentFrame());await frame.locator('[data-app-ready]').waitFor();
   const metrics=await clearance(page,width);
   if(name==='avenlo'){
    await frame.locator('html[data-copy-ready=true][data-contrast-ready=true]').waitFor();
    const button=frame.locator('.hero__btn');const style=await button.evaluate(e=>({image:getComputedStyle(e).backgroundImage,label:getComputedStyle(e.querySelector('.shader-btn__label')).color,fill:getComputedStyle(e).color,children:[...e.querySelectorAll('.shader-btn__fallback,.shader-btn__canvas')].map(n=>getComputedStyle(n).display)}));assert.equal(style.image,'none');assert.equal(style.label,style.fill);assert.ok(style.children.every(display=>display==='none'));
   }
   await audit(page,`${name} layout`,width,theme);await page.screenshot({path:`${output}/${name}-${width}-${theme}.png`});
   if(name==='infra'){
    const add=frame.getByRole('button',{name:'Add New',exact:true});if(width===390){const icons=await add.locator('svg:visible').count();assert.equal(icons,1);const physical=await add.boundingBox();assert.ok(physical.width>=44&&physical.height>=44);}
    await add.click();await frame.getByRole('menuitem',{name:'Project',exact:true}).waitFor();await audit(page,'add menu',width,theme);await frame.getByRole('menuitem',{name:'Project',exact:true}).click();await frame.getByRole('dialog').waitFor();await audit(page,'new project dialog',width,theme);await frame.getByRole('button',{name:'Close dialog',exact:true}).click();
    if(width===390){await page.getByRole('button',{name:'More tools',exact:true}).click();await audit(page,'more tools menu',width,theme);await page.getByRole('menuitem',{name:'Undo palette',exact:true}).waitFor();assert.equal(await page.getByRole('menuitem',{name:'Undo palette',exact:true}).getAttribute('aria-disabled'),'true');await page.keyboard.press('Escape');}
    else assert.equal(await page.getByRole('button',{name:'More tools',exact:true}).isVisible(),false);
    const primary=()=>frame.locator('html').evaluate(e=>e.style.getPropertyValue('--p-primary'));
    const original=await primary();await page.getByRole('button',{name:'Shuffle palette',exact:true}).click();await page.waitForFunction(original=>document.querySelector('iframe').contentDocument.documentElement.style.getPropertyValue('--p-primary')!==original,original);const shuffled=await primary();await clickToolbarAction(page,'Undo palette');assert.equal(await primary(),original);await clickToolbarAction(page,'Redo palette');assert.equal(await primary(),shuffled);
    await clickToolbarAction(page,'Share palette');assert.equal(new URL(await page.evaluate(()=>navigator.clipboard.readText())).pathname,path);
    await clickToolbarAction(page,'Export palette');await page.getByRole('dialog',{name:'Export',exact:true}).waitFor();assert.ok(await page.getByRole('dialog',{name:'Export',exact:true}).evaluate(e=>e.contains(document.activeElement)));await audit(page,'export from tools',width,theme);await page.keyboard.press('Escape');
    await clickToolbarAction(page,'Reset palette and fonts');
    await page.getByRole('button',{name:'Fonts',exact:true}).click();await audit(page,'font panel',width,theme);await page.getByRole('button',{name:'Close fonts',exact:true}).click();
    await page.getByRole('button',{name:'Primary color',exact:true}).click();await audit(page,'color picker',width,theme);await page.getByRole('button',{name:'Close color picker',exact:true}).click();
    await clickToolbarAction(page,'Hide color toolbar');await page.getByRole('button',{name:'Open color toolbar',exact:true}).waitFor();const height=await page.locator('iframe').evaluate(e=>e.getBoundingClientRect().height);assert.ok(Math.abs(height-(width===390?844:900))<1);await audit(page,'toolbar hidden',width,theme);await page.getByRole('button',{name:'Open color toolbar',exact:true}).click();await clearance(page,width);
   }
   actions.push({width,theme,path,toolbarHeight:metrics.height});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);completed=true;
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({completed,actions,errors,reports},null,2));}
const findings=reports.flatMap(r=>r.report.findings);console.log(`${actions.length} page flows; ${reports.length} UI states; ${findings.length} findings.`);assert.equal(findings.length,0,JSON.stringify(findings,null,2));
