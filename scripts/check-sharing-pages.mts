import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import {pageIds} from '../src/components/dashboards/infrastructure/pages/registry.ts';
import {sitePreviews} from '../src/lib/previews.ts';

const childOnly=process.env.CHILD_ONLY==='1';
const base=process.env.APP_URL||'http://127.0.0.1:3300',output=childOnly?'artifacts/shareability/child-pages':'artifacts/shareability/pages';await mkdir(output,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const browser=await chromium.launch(),results=[],errors=[];let complete=false;
const basePaths=['/','/editor','/compare?preview=infrastructure',...Object.values(sitePreviews).map(value=>'/'+value.slug),...pageIds.map(id=>'/dashboards/infra-dashboard'+(id==='projects'?'':'/'+id)),...['','work','space','scheduled','plugins','sites','skills'].map(view=>'/dashboards/ai-chatbot'+(view?'/'+view:''))];
const destinations=JSON.parse(await readFile('src/lib/site-destinations.json','utf8'));
const childPaths=[...new Set(Object.entries(destinations).flatMap(([site,records])=>Object.keys(records).map(path=>'/'+sitePreviews[site].slug+'/'+path.replace(/^\.\//,'').replace(/^\.$/,''))).filter(path=>!path.endsWith('/')))];
const paths=childOnly?childPaths:[...basePaths,...childPaths];
try{
 for(const width of[390,1440])for(const theme of['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme as 'light'|'dark',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push({path:page.url(),message:error.message}));
  for(const path of paths){
   const url=new URL(path,base);url.searchParams.set('colors',theme==='dark'?'ededed-171717-e98878-333333-a8655f':'171717-ffffff-e98878-ffe291-a8655f');
   await page.goto(url.href);await page.locator('[data-app-ready]').waitFor();let searchRestored=false,childReport;
   const frames=page.locator('iframe');
   if(path.startsWith('/dashboards/')){
    const frame=frames.first().contentFrame();await frame.locator('[data-app-ready]').waitFor();
    const search=frame.locator('input[type=search]').first();
    if(await search.count()){
     await search.fill('no-match-sharing');await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));const href=page.url();
     const recipient=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const receiver=await recipient.newPage();await receiver.goto(href);await receiver.locator('[data-app-ready]').waitFor();const target=receiver.locator('iframe').contentFrame();await target.locator('[data-app-ready]').waitFor();assert.equal(await target.locator('input[type=search]').first().inputValue(),'no-match-sharing',`${path}: search must restore in a new browser`);await recipient.close();searchRestored=true;
    }
    await frame.locator('body').evaluate(async()=>document.fonts.ready);
    const handle=await frames.first().elementHandle(),child=await handle.contentFrame();childReport=await checkPage(child,policy);
   }else if(Object.values(sitePreviews).some(value=>path==='/'+value.slug||path.startsWith('/'+value.slug+'/'))){
    await frames.first().getAttribute('data-preview-ready');await page.locator('iframe[data-preview-ready=true]').waitFor();const child=await(await frames.first().elementHandle()).contentFrame();await child.evaluate(async()=>document.fonts.ready);childReport=await checkPage(child,policy);
   }
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
   const root=await checkPage(page,policy);const file=`${output}/${width}-${theme}-${path.replace(/[^a-z0-9]+/gi,'_')||'home'}.json`;
   await writeFile(file,JSON.stringify({path,width,theme,root,child:childReport},null,2));results.push({path,width,theme,searchRestored,rootFindings:root.findings.length,childFindings:childReport?.findings.length??0,file});
  }
  await context.close();console.log('Checked',paths.length,'pages at',width,theme);
 }
 assert.deepEqual(errors,[]);complete=true;
}finally{await browser.close();await writeFile(childOnly?'artifacts/shareability/child-pages-report.json':'artifacts/shareability/pages-report.json',JSON.stringify({complete,results,errors},null,2));}
const findings=results.reduce((sum,result)=>sum+result.rootFindings+result.childFindings,0);console.log(`${results.length} page/theme/size checks; ${results.filter(result=>result.searchRestored).length} fresh-browser search checks; ${findings} UI findings.`);if(findings)process.exitCode=1;
