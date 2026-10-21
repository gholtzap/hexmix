import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {previewCatalog,previewHref} from '../src/lib/preview-catalog.ts';
import {defaultDarkPalette,initialPalette,readPalette} from '../src/lib/palette.ts';
const out='artifacts/menu-previews';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),reports=[],errors=[];
const options=[...previewCatalog.filter(p=>p.category==='Homepages'),...previewCatalog.filter(p=>p.category==='Dashboards'),{id:'gallery',path:'/',name:'All sites'}];
async function audit(page,state,width,mode){let report={findings:[]},attached=false;try{await expectUI(page,{attach:async(_,a)=>{report=JSON.parse(String(a.body));attached=true;}});}catch(e){if(!attached)throw e;}reports.push({state,width,mode,report});}
async function checkPreview(page,target){
 const preview=page.locator(`[data-page-preview="${target.id}"]`);await preview.waitFor();await page.waitForFunction(id=>document.querySelectorAll('[data-page-preview]').length===1&&Boolean(document.querySelector(`[data-page-preview="${id}"]`)),target.id);
 assert.equal(await preview.locator('[data-capture]').count(),target.id==='gallery'?6:1);
 if(target.id!=='gallery')assert.equal(await preview.locator('[data-capture]').getAttribute('data-capture'),target.id);
 const bounds=await preview.boundingBox(),viewport=page.viewportSize();assert(bounds.width>=250);assert(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1);assert(bounds.y>=0&&bounds.y+bounds.height<=viewport.height+1);
}
try{for(const viewport of [{width:1440,height:900},{width:390,height:900},{width:900,height:600}]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
 for(const [mode,palette]of Object.entries({dark:defaultDarkPalette,light:initialPalette})){
  await page.goto('http://127.0.0.1:3000'+previewHref('/dashboards/infra-dashboard',palette,'Arial','Verdana'));await page.locator('[data-app-ready]').waitFor();
  const trigger=page.getByRole('button',{name:'Switch site: Infra Dashboard',exact:true});await trigger.click();
  for(const target of options){await page.getByRole('menuitem',{name:target.name,exact:true}).hover();await checkPreview(page,target);await audit(page,target.name+' hover',viewport.width,mode);}
  await page.keyboard.press('Escape');await page.getByRole('menu').waitFor({state:'hidden'});assert.equal(await page.locator('[data-page-preview]').count(),0);await trigger.focus();await page.keyboard.press('ArrowDown');
  for(let i=0;i<options.length;i++){if(i)await page.keyboard.press('ArrowDown');const target=options[i];assert.equal(await page.getByRole('menuitem',{name:target.name,exact:true}).evaluate(e=>e===document.activeElement),true);await checkPreview(page,target);await audit(page,target.name+' focus',viewport.width,mode);}
  await page.screenshot({path:`${out}/${viewport.width}-${mode}.png`});await page.keyboard.press('Escape');await page.getByRole('menu').waitFor({state:'hidden'});await trigger.click();await page.getByRole('menuitem',{name:'Orvian',exact:true}).hover();await checkPreview(page,options.find(p=>p.name==='Orvian'));await page.screenshot({path:`${out}/page-${viewport.width}-${mode}.png`});await page.getByRole('menuitem',{name:'Orvian',exact:true}).click();await page.waitForURL(u=>u.pathname==='/orvian');assert.deepEqual(readPalette(new URL(page.url()).search),palette);assert.equal(new URL(page.url()).searchParams.get('body'),'Verdana');assert.equal(await page.locator('[data-page-preview]').count(),0);
 }
 await page.close();
}assert.deepEqual(errors,[]);}finally{await browser.close();await writeFile(`${out}/ui.json`,JSON.stringify(reports,null,2));await writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2));}
const findings=reports.reduce((n,r)=>n+r.report.findings.length,0);console.log(`${reports.length} UI states; ${findings} findings`);if(findings)process.exitCode=1;
