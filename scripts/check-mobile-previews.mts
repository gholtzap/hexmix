import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
const base=process.env.APP_URL||'http://127.0.0.1:3000',output='artifacts/mobile-improvements';
await mkdir(output,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const browser=await chromium.launch(),reports=[],actions=[];
try{
 for(const width of[320,390])for(const theme of['light','dark'])for(const route of['avenlo','tervix','orvian','nuvexa','dashboards/ai-chatbot','dashboards/infra-dashboard']){
  const page=await browser.newPage({viewport:{width,height:width===320?568:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});page.setDefaultTimeout(20000);
  const colors=theme==='light'?'171717-ffffff-e98878-ffe291-a8655f':'ededed-171717-e98878-333333-a8655f';
  await page.goto(`${base}/${route}?colors=${colors}`);await page.locator('iframe[data-preview-ready=true]').waitFor();
  const frame=page.frames().find(f=>f.parentFrame());assert(frame);
  await frame.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/mobile-preview.css')));
  await frame.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
  const measure=()=>frame.evaluate(()=>{
   const controls=[...document.querySelectorAll<HTMLElement>('button,[role=button],[role=menuitem],[role=tab],summary,select,nav a,header a,a[class*="button"],a[class*="btn"],a[class*="inline-flex"]')].filter(e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).map(e=>{const r=e.getBoundingClientRect();return{name:(e.getAttribute('aria-label')||e.innerText).trim().slice(0,80),width:r.width,height:r.height,x:r.x,y:r.y};}).filter(r=>r.width&&r.height&&r.y>=0&&r.y<innerHeight&&r.x>=0&&r.x<innerWidth);
   return{width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),controls,small:controls.filter(r=>r.width<43.5||r.height<43.5)};
  });
  const metrics=await measure();assert.equal(metrics.scrollWidth,metrics.width,`${route} must not scroll horizontally`);assert.deepEqual(metrics.small,[],`${route} controls must have 44px touch areas`);
  const report=await checkPage(frame,policy);reports.push({route,width,theme,state:'page',metrics,report});
  if(['avenlo','orvian','dashboards/ai-chatbot','dashboards/infra-dashboard'].includes(route)){
   const button=route==='avenlo'?frame.locator('.nav__toggle'):route==='orvian'?frame.getByRole('button',{name:'Toggle menu',exact:true}):route.includes('infra')?frame.locator('.vc-topbar-toggle').getByRole('button',{name:'Open sidebar',exact:true}):frame.getByRole('button',{name:'Open sidebar',exact:true});
   if(await button.isVisible()){
    await button.tap();await frame.waitForTimeout(250);const openMetrics=await measure();assert.deepEqual(openMetrics.small,[],`${route} open controls must have 44px touch areas`);
    reports.push({route,width,theme,state:'menu',metrics:openMetrics,report:await checkPage(frame,policy)});
   }
  }
  await page.screenshot({path:`${output}/${width}-${theme}-${route.replaceAll('/','-')}.png`});
  actions.push({route,width,theme});console.log('Passed',route,width,theme);await page.close();
 }
}finally{await browser.close();await writeFile(`${output}/preview-report.json`,JSON.stringify({actions,reports},null,2));}
const findings=reports.reduce((n,r)=>n+r.report.findings.length,0);console.log(`${actions.length} page checks; ${reports.length} UI reports; ${findings} findings.`);if(findings)process.exitCode=1;
