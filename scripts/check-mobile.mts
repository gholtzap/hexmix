import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,type Page,type Locator} from 'playwright';
import {checkPage} from 'lintapple';
import {clickToolbarAction} from './lib/studio-toolbar.mts';

const base=process.env.APP_URL||'http://127.0.0.1:3000',output='artifacts/mobile-improvements';
await mkdir(output,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const browser=await chromium.launch(),reports=[],actions=[],errors=[];
let complete=false;
async function audit(page:Page,state:string,width:number,theme:string){
 await page.mouse.move(1,1);
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 const report=await checkPage(page,policy);reports.push({state,width,theme,report});
 await page.screenshot({path:`${output}/${width}-${theme}-${state}.png`});
}
async function inside(page:Page,selector:string){
 const box=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};});
 assert(box.left>=-1&&box.right<=box.width+1&&box.top>=-1&&box.bottom<=box.height+1,`${selector} must fit: ${JSON.stringify(box)}`);
}
try{
 for(const[width,height]of[[320,568],[390,844],[844,390],[1440,900]])for(const theme of['light','dark']){
  const compact=width<=560||(height<=500&&width<=1000);
  const context=await browser.newContext({viewport:{width,height},hasTouch:compact,isMobile:compact,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const press=(control:Locator)=>compact?control.tap():control.click();
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const colors=theme==='light'?'171717-ffffff-e98878-ffe291-a8655f':'ededed-171717-e98878-333333-a8655f';
  await page.goto(`${base}/?colors=${colors}`);await page.locator('[data-app-ready]').waitFor();
  await inside(page,'.toolbar-anchor');
  if(compact){
   assert((await page.locator('.toolbar-anchor').boundingBox()).height<=68,'The toolbar must remain one row');
   for(const name of['Text','Background','Primary','Secondary','Accent']){
    const box=await page.getByRole('button',{name:`${name} color`,exact:true}).boundingBox();assert(box.width>=44&&box.height>=44);
   }
   await press(page.getByRole('button',{name:'More tools',exact:true}));await inside(page,'[role="menu"]');await audit(page,'tools',width,theme);await page.keyboard.press('Escape');
  }
  await audit(page,'home',width,theme);
  await clickToolbarAction(page,theme==='dark'?'Use light palette':'Use dark palette');
  await clickToolbarAction(page,theme==='dark'?'Use dark palette':'Use light palette');
  assert.equal(new URL(page.url()).searchParams.get('colors'),colors);
  for(const role of['Text','Background','Primary','Secondary','Accent']){
   await press(page.getByRole('button',{name:`${role} color`,exact:true}));await inside(page,'.color-picker-content');
   const hex=page.getByRole('textbox',{name:'Hex',exact:true});await hex.fill('147d92');await hex.press('Enter');
   if(role==='Primary'){
    await audit(page,'picker',width,theme);
    if(compact){
     await page.setViewportSize({width,height:300});await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--visible-height')==='300px');
     await hex.scrollIntoViewIfNeeded();await inside(page,'.color-picker-content');await inside(page,'input[aria-label="Hex"]');
     await audit(page,'short-screen-picker',width,theme);await page.setViewportSize({width,height});
     for(const offset of[0,48]){
      await page.evaluate(offset=>{
       Object.defineProperty(visualViewport,'height',{value:200,configurable:true});
       Object.defineProperty(visualViewport,'offsetTop',{value:offset,configurable:true});
       visualViewport.dispatchEvent(new Event('resize'));
      },offset);
      await hex.scrollIntoViewIfNeeded();
      const bounds=await page.locator('.color-picker-content').boundingBox();
      assert(bounds.y>=offset-1&&bounds.y+bounds.height<=offset+201,'The picker must stay above the keyboard and within the panned visual viewport');
      await page.evaluate(()=>{Reflect.deleteProperty(visualViewport,'height');Reflect.deleteProperty(visualViewport,'offsetTop');visualViewport.dispatchEvent(new Event('resize'));});
     }
    }
   }
   if(role==='Background'&&compact){
    await press(page.getByRole('button',{name:'Lock background',exact:true}));
    await press(page.getByRole('button',{name:'Close color picker',exact:true}));await inside(page,'.toolbar-anchor');await audit(page,'locked-background',width,theme);
    await press(page.getByRole('button',{name:'Background color',exact:true}));await press(page.getByRole('button',{name:'Unlock background',exact:true}));
   }
   await press(page.getByRole('button',{name:'Close color picker',exact:true}));
  }
  await clickToolbarAction(page,'Fonts');await inside(page,'.font-panel');await page.getByLabel('Headings',{exact:true}).selectOption('Arial');await page.getByLabel('Body',{exact:true}).selectOption('Verdana');await audit(page,'fonts',width,theme);await press(page.getByRole('button',{name:'Close fonts',exact:true}));
  if(compact)await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='More tools');
  await clickToolbarAction(page,'Palettes');await press(page.getByRole('tab',{name:'Saved',exact:true}));await audit(page,'saved-empty',width,theme);
  await press(page.getByRole('button',{name:'Save palette',exact:true}));await page.getByLabel('Palette name',{exact:true}).fill(' ');await press(page.getByRole('button',{name:'Save',exact:true}));await audit(page,'name-error',width,theme);
  await page.getByLabel('Palette name',{exact:true}).fill('Phone colors');await press(page.getByRole('button',{name:'Save',exact:true}));await page.getByRole('button',{name:'Apply Phone colors',exact:true}).waitFor();
  await press(page.getByRole('button',{name:'Browse all palettes',exact:true}));await inside(page,'.palette-panel');await press(page.getByRole('tab',{name:'Presets',exact:true}));await press(page.getByRole('button',{name:'Load more',exact:true}));
  await audit(page,'palette-browser',width,theme);
  await page.getByRole('searchbox',{name:'Search palettes',exact:true}).fill('no-such-mobile-palette');await page.getByText('No palettes match your search.',{exact:true}).waitFor();await audit(page,'search-empty',width,theme);
  await press(page.getByRole('button',{name:'Close palettes',exact:true}));if(compact)await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='More tools');
  await clickToolbarAction(page,'Shuffle palette');await clickToolbarAction(page,'Undo palette');await clickToolbarAction(page,'Redo palette');
  await clickToolbarAction(page,'Export palette');await inside(page,'.export-dialog');await audit(page,'export',width,theme);await press(page.getByRole('button',{name:'Close export',exact:true}));
  await clickToolbarAction(page,'Hide color toolbar');await press(page.getByRole('button',{name:'Open color toolbar',exact:true}));await inside(page,'.toolbar-anchor');
  if(compact){
   await press(page.getByRole('button',{name:'More tools',exact:true}));
   await press(page.getByRole('menuitem',{name:'Previews',exact:true}));
   await press(page.getByRole('menu',{name:'Previews',exact:true}).getByRole('menuitem',{name:'Orvian',exact:true}));
   await page.waitForURL(url=>url.pathname==='/orvian');await page.locator('iframe[data-preview-ready=true]').waitFor();await inside(page,'.toolbar-anchor');
  }
  actions.push({width,height,theme});await context.close();console.log('Passed',width,height,theme);
 }
 assert.deepEqual(errors,[]);complete=true;
}finally{await browser.close();await writeFile(`${output}/mobile-report.json`,JSON.stringify({complete,actions,reports,errors},null,2));}
const findings=reports.reduce((n,r)=>n+r.report.findings.length,0);console.log(`${actions.length} flows; ${reports.length} UI states; ${findings} findings.`);if(findings)process.exitCode=1;
