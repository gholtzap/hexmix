import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
import {initialPalette,defaultDarkPalette,paletteQuery,readPalette} from '../src/lib/palette.ts';
const base=process.env.APP_URL??'http://127.0.0.1:3381',out='artifacts/preview-loading';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),reports=[];
try{for(const width of [390,1440])for(const [theme,palette] of Object.entries({light:initialPalette,dark:defaultDarkPalette}))for(const path of ['/avenlo','/dashboards/infra-dashboard']){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:width===390?'reduce':'no-preference'});page.setDefaultTimeout(15000);await page.clock.install();let release;const gate=new Promise<void>(resolve=>{release=resolve;});let requests=0;
 await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(request.isNavigationRequest()&&(url.pathname.startsWith('/render/')||url.pathname.startsWith('/dashboard-previews/'))){requests++;await gate;}await route.continue().catch(()=>{});});
 try{
  await page.goto(`${base}${path}?${paletteQuery(palette)}`,{waitUntil:'domcontentloaded'});await page.locator('[data-app-ready]').waitFor();const status=page.getByRole('status',{name:'Page preview loading',exact:true});await status.waitFor();
  await page.getByRole('button',{name:'Text color',exact:true}).click();await page.getByRole('button',{name:'Close color picker',exact:true}).click();await page.mouse.move(0,0);
  const loadingUI=await checkPage(page,policy);assert.deepEqual(loadingUI.findings,[]);const animation=await status.locator('svg').evaluate(node=>getComputedStyle(node).animationName);assert.equal(animation==='none',width===390);
  await page.clock.fastForward(16000);await page.getByRole('button',{name:'Reload preview',exact:true}).waitFor();await page.mouse.move(0,0);const slowUI=await checkPage(page,policy);assert.deepEqual(slowUI.findings,[]);await page.screenshot({path:`${out}/${width}-${theme}-${path.includes('avenlo')?'website':'dashboard'}-slow.png`});
  const before=requests;await page.getByRole('button',{name:'Reload preview',exact:true}).click();await expect.poll(()=>requests).toBeGreaterThan(before);assert.deepEqual(readPalette(new URL(page.url()).search),palette);
  release();await status.waitFor({state:'hidden'});await page.locator('iframe[data-preview-ready=true]').waitFor();await page.frameLocator('iframe').getByRole('heading').first().waitFor();assert.equal(await page.locator('iframe').getAttribute('aria-busy'),'false');
  reports.push({width,theme,path,loadingUI,slowUI,retry:true,palettePreserved:true,ready:true});await page.screenshot({path:`${out}/${width}-${theme}-${path.includes('avenlo')?'website':'dashboard'}-ready.png`});
 }finally{release();await page.close();}
}
 const failed=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});await failed.clock.install();await failed.route('**/render/avenlo',route=>route.abort('failed'));await failed.goto(`${base}/avenlo`,{waitUntil:'domcontentloaded'});await failed.locator('[data-app-ready]').waitFor();await failed.getByRole('status',{name:'Page preview loading',exact:true}).waitFor();await failed.clock.fastForward(16000);await failed.getByRole('button',{name:'Reload preview',exact:true}).waitFor();const failureUI=await checkPage(failed,policy);assert.deepEqual(failureUI.findings,[]);await failed.unroute('**/render/avenlo');await failed.getByRole('button',{name:'Reload preview',exact:true}).click();await failed.getByRole('status',{name:'Page preview loading',exact:true}).waitFor({state:'hidden'});reports.push({failedRequest:true,retryRecovered:true,failureUI});await failed.close();
 const home=await browser.newPage();await home.goto(base);await home.locator('[data-app-ready]').waitFor();assert.equal(await home.getByRole('status',{name:'Page preview loading',exact:true}).count(),0);await home.close();
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));}console.log('Passed eight delayed website/dashboard loads, slow states, retries, palette retention, and reduced motion.');
