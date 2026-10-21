import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const base=process.env.APP_URL||'http://127.0.0.1:3000',out='artifacts/fullscreen-pages';
const routes=['/','/editor','/avenlo','/avenlo/blog/note-44','/tervix','/tervix/forward-deployed','/orvian','/orvian/blog','/nuvexa','/nuvexa/products/quotes-and-tenders','/dashboards/ai-chatbot','/dashboards/ai-chatbot/plugins','/dashboards/infra-dashboard','/dashboards/infra-dashboard/deployments'];
await mkdir(out,{recursive:true});const browser=await chromium.launch(),reports=[],metrics=[];let complete=false;
try {
 for(const width of [390,1440])for(const [theme,colors]of Object.entries({light:'171717-ffffff-e98878-ffe291-a8655f',dark:'ededed-171717-e98878-333333-a8655f'})) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
  for(const route of routes) {
   const response=await page.goto(`${base}${route}?colors=${colors}`);assert(response.ok(),route);
   await page.locator('[data-app-ready]').waitFor();const content=page.locator('.studio > .website-frame, .home-page');await content.waitFor();
   if(await page.locator('iframe[data-preview-ready]').count())await page.locator('iframe[data-preview-ready=true]').waitFor();
   await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>{const r=document.querySelector('.studio > .website-frame, .home-page')?.getBoundingClientRect();return r&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1;});
   const measure=()=>content.evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,toolbar:document.querySelector('.toolbar-anchor')?.getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));
   const initial=await measure();assert(Math.abs(initial.rect.width-width)<1,route);assert(Math.abs(initial.rect.height-900)<1,route);assert.equal(initial.rect.top,0);if(initial.toolbar)assert(initial.rect.bottom>initial.toolbar.top);assert.equal(initial.overflow,false);
   let report={findings:[]};await expectUI(page,{attach:async(_,a)=>{report=JSON.parse(String(a.body));}}).catch(e=>{if(!report.findings.length)throw e;});reports.push({route,width,theme,report});
   if(initial.toolbar&&(route==='/'||route==='/avenlo/blog/note-44')) {
    await clickToolbarAction(page,'Hide color toolbar');assert(Math.abs((await measure()).rect.height-900)<1);await page.getByRole('button',{name:'Open color toolbar',exact:true}).click();assert(Math.abs((await measure()).rect.height-900)<1);
    if(width===390)await page.screenshot({path:`${out}/${route==='/'?'gallery':'article'}-${theme}.png`});
   }
   metrics.push({route,width,theme,...initial});
  }
  await page.close();
 }
 // The saved-preview fallback uses the same viewport rule even when no live iframe is available.
 const page=await browser.newPage({viewport:{width:390,height:900}});await page.goto(base+'/editor');await page.locator('[data-app-ready]').waitFor();
 const fallback=await page.evaluate(()=>{const n=document.createElement('div');n.className='website-frame remote-preview';const studio=document.querySelector('.studio');studio.append(n);const r=n.getBoundingClientRect();n.remove();return {width:r.width,height:r.height};});assert.equal(fallback.height,900);assert.equal(fallback.width,390);await page.close();complete=true;
} finally {await browser.close();await writeFile(`${out}/ui.json.gz`,gzipSync(JSON.stringify(reports)));await writeFile(`${out}/summary.json`,JSON.stringify({complete,layouts:metrics.length,routes,metrics,findings:reports.reduce((n,r)=>n+r.report.findings.length,0),report:`${out}/ui.json.gz`},null,2));}
const findings=reports.reduce((n,r)=>n+r.report.findings.length,0);console.log(`${metrics.length} fullscreen layouts; ${findings} UI findings`);if(findings)process.exitCode=1;
