import { clickToolbarAction, openSiteSwitcher } from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {checkPage} from 'lintapple';
import {previewCatalog,previewHref} from '../src/lib/preview-catalog.ts';
import {defaultDarkPalette,readPalette} from '../src/lib/palette.ts';
const out='artifacts/site-switcher';await mkdir(out,{recursive:true});
const base=process.env.APP_URL??'http://127.0.0.1:3000';
const logos={avenlo:'.nav__logo img',tervix:'nav a[data-preview-path="/"]',orvian:'img[alt="Orvian"]',nuvexa:'nav img[alt="Nuvexa"]',workspace:'.side-title, .mobile-toggle',infrastructure:'[data-site-switcher-slot], .vc-topbar-team'};
const wordmarkWidths={avenlo:0.66,orvian:0.63,nuvexa:0.72};
const browser=await chromium.launch(),reports=[],errors=[];
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
async function audit(page,state,width){let report={findings:[]};try{await expectUI(page,{attach:async(_,a)=>report=JSON.parse(String(a.body))},policy);}catch(e){if(!report.findings.length)throw e;}reports.push({state,width,report});console.log(width,state,report.findings.length);}
async function logoBox(page,id){
 await page.locator('iframe[data-preview-ready=true]').waitFor();
 const frame=page.frames().find(frame=>frame.parentFrame())!;
 await frame.waitForFunction(selector=>[...document.querySelectorAll(selector)].some(element=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0&&box.y>=0&&box.y<100;}),logos[id]);
 for(const element of await page.frameLocator('iframe').locator(logos[id]).all()){const box=await element.boundingBox();if(box&&box.width>0&&box.y>=0&&box.y<100)return box;}throw new Error(`${id} logo is not visible`);
}
try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));for(const mode of ['dark','light']){const palette=mode==='dark'?defaultDarkPalette:{text:'#171717',background:'#ffffff',primary:'#171717',secondary:'#eeeeee',accent:'#626262'};
for(const site of previewCatalog){await page.goto(base+previewHref(site.path,palette,'Arial','Verdana'));await page.locator('[data-app-ready]').waitFor();const switcher=page.locator('.preview-site-switcher .site-switcher-trigger');await switcher.waitFor({state:'visible'});const logo=await logoBox(page,site.id),box=await switcher.boundingBox();if(site.id==='infrastructure'&&width===1440)assert(box&&Math.abs(box.x-logo.x)<1&&Math.abs(box.y-logo.y)<1&&Math.abs(box.width-logo.width)<1&&Math.abs(box.height-logo.height)<1,'The site selector must replace the full team row');else assert(box&&Math.abs(box.x-logo.x-logo.width*(wordmarkWidths[site.id]??1))<8&&Math.abs(box.y+box.height/2-logo.y-logo.height/2)<8,`${site.name} switcher must sit beside its logo`);await audit(page,site.id+' '+mode+' closed',width);
if(site.id==='infrastructure'){
 const frame=page.frames().find(frame=>frame.parentFrame())!;
 await frame.waitForFunction(palette=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===['text','background','primary','secondary','accent'].map(role=>palette[role]).join('|'),palette);await frame.evaluate(()=>document.fonts.ready);
 assert.equal(await frame.getByRole('button',{name:/Switch team/}).count(),0);
 if(width===390){
  await frame.locator('.vc-topbar-toggle').getByRole('button',{name:'Open sidebar',exact:true}).click();
  await page.locator('.preview-site-switcher[data-slot]').waitFor();
  const slot=await frame.locator('[data-site-switcher-slot]').boundingBox();assert(slot);
  await page.waitForFunction(slot=>{const box=document.querySelector('.preview-site-switcher .site-switcher-trigger')!.getBoundingClientRect();return Math.abs(box.x-slot.x)<1&&Math.abs(box.y-slot.y)<1&&Math.abs(box.width-slot.width)<1&&Math.abs(box.height-slot.height)<1;},slot);
 }
 await frame.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 await frame.waitForFunction(()=>document.documentElement.dataset.contrastReady==='true');
 reports.push({state:site.id+' '+mode+' sidebar',width,report:await checkPage(frame,policy)});
 await page.locator('.site-switcher-trigger').click({position:{x:60,y:14}});
}else await openSiteSwitcher(page);assert.equal(await page.getByRole('menuitem',{name:'All sites',exact:true}).count(),1);assert.equal(await page.getByRole('menuitem',{name:/^(Infrastructure|Workspace) pages$/}).count(),0);for(const target of previewCatalog){const link=page.getByRole('menuitem',{name:target.name,exact:true});assert.equal(await link.count(),1);const url=new URL(await link.getAttribute('href'),'http://localhost');assert.deepEqual(readPalette(url.search),palette);assert.equal(url.searchParams.get('heading'),'Arial');assert.equal(url.searchParams.get('body'),'Verdana');}
await audit(page,site.id+' '+mode+' menu',width);if(site.id==='infrastructure'&&mode==='dark')await page.screenshot({path:`${out}/switcher-${width}.png`});await page.keyboard.press('Escape');if(await page.getByRole('menu').count())await page.keyboard.press('Escape');assert.equal(await page.getByRole('menu').count(),0);await page.waitForFunction(()=>document.activeElement?.matches('.site-switcher-trigger, .toolbar-more'));if(site.id==='infrastructure'&&width===390){await page.frameLocator('iframe').getByRole('button',{name:'Close sidebar',exact:true}).click();await page.locator('.preview-site-switcher:not([data-slot])').waitFor();}
}
await openSiteSwitcher(page);await page.getByRole('menuitem',{name:'Avenlo',exact:true}).click();await page.waitForURL(/\/avenlo\?/);await page.locator('[data-app-ready]').waitFor();assert.deepEqual(readPalette(new URL(page.url()).search),palette);
await openSiteSwitcher(page);await page.getByRole('menuitem',{name:'Infra Dashboard',exact:true}).click();await page.waitForURL(/\/dashboards\/infra-dashboard\?/);await page.locator('[data-app-ready]').waitFor();await clickToolbarAction(page, 'Fonts');assert.equal(await page.getByLabel('Headings',{exact:true}).inputValue(),'Arial');assert.equal(await page.getByLabel('Body',{exact:true}).inputValue(),'Verdana');await openSiteSwitcher(page);assert.equal(await page.getByLabel('Headings',{exact:true}).count(),0);await page.getByRole('menuitem',{name:'All sites',exact:true}).click();await page.waitForURL(u=>u.pathname==='/');await page.locator('[data-app-ready]').waitFor();await audit(page,mode+' gallery',width);const gallery=page.getByRole('link',{name:'Infra Dashboard',exact:true});assert.equal(new URL(await gallery.getAttribute('href'),'http://localhost').searchParams.get('body'),'Verdana');await gallery.click();await page.waitForURL(/\/dashboards\/infra-dashboard\?/);await page.goBack();await page.locator('[data-app-ready]').waitFor();assert.equal(new URL(page.url()).pathname,'/');
}await page.close();}assert.deepEqual(errors,[]);}finally{await browser.close();await writeFile(`${out}/ui.json`,JSON.stringify(reports,null,2));await writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2));}const n=reports.reduce((s,r)=>s+r.report.findings.length,0);console.log(`${reports.length} states; ${n} findings`);if(n)process.exitCode=1;
