import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
const out='artifacts/tervix-load';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),reports=[],errors=[];
try {
 const media=await readFile('tervix/public/home-media.js','utf8');
 const sanitize=media.slice(media.indexOf('function sanitizeElement('),media.indexOf('function sanitizeMetadata('));
 const probe=await browser.newPage();
 const images=await probe.evaluate(sanitize=>{
  const run=new Function('namePattern','nameChanges',sanitize+';return sanitizeElement;')(/old-brand/g,new Map());
  return [null,'data-editor-gradient','data-editor-icon','data-editor-wordmark'].map(attribute=>{
   const image=document.createElement('img');image.setAttribute('src','data:image/svg+xml,test');image.setAttribute('alt','Tervix');if(attribute)image.setAttribute(attribute,'true');run(image);
   return {attribute,src:image.getAttribute('src'),alt:image.getAttribute('alt')};
  });
 },sanitize);
 assert.equal(images[0].alt,'');assert.match(images[0].src,/media-/);
 for(const image of images.slice(1)){assert.equal(image.src,'data:image/svg+xml,test');assert.equal(image.alt,'Tervix');}
 await probe.close();
 for(const width of [390,1440])for(const [theme,colors] of Object.entries({light:'222d1f-f9fcf8-94ce88-beefcd-4a8b3c',dark:'f9fcf8-222d1f-94ce88-beefcd-4a8b3c'})) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push({width,theme,message:e.message}));
  const url=`http://127.0.0.1:3000/tervix?colors=${colors}&heading=System&body=System`;
  await page.goto(url);const frame=page.frameLocator('iframe');await frame.locator('html[data-home-ready=true][data-copy-ready=true]').waitFor();
  const source=page.frames().find(f=>f.parentFrame());
  await source.waitForFunction(colors=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===colors.split('-').map(c=>'#'+c).join('|'),colors);
  await frame.locator('h1').first().waitFor();
  assert.equal(await frame.getByText('This page couldn’t load',{exact:true}).count(),0);
  await source.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(() => resolve()))));
  const background=frame.locator('main > section:first-of-type .rounded-2xl.mt-4 > .absolute.inset-0 > img');
  const fills=await background.evaluate(n=>{const a=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1;});assert(fills,'The hero background must fill its container');
  const changes=await source.evaluate(()=>new Promise<number>(resolve=>{
   let changes=0;const observer=new MutationObserver(records=>{changes+=records.length;});
   const logo=document.querySelector('img[data-editor-wordmark],img[data-editor-gradient],img[data-editor-icon]');if(!logo)throw new Error('The preview image is missing');
   observer.observe(logo,{attributes:true,attributeFilter:['src','alt']});
   setTimeout(()=>{observer.disconnect();resolve(changes);},1000);
  }));assert(changes<=1,'The preview image must not repeat source or label updates');
  const audit=async state=>{await source.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});reports.push({width,theme,state,report:await checkPage(source,policy)});await page.screenshot({path:`${out}/${width}-${theme}-${state}.png`});};
  await audit('loaded');
  if(width===1440) {await frame.getByRole('button',{name:'Platform',exact:true}).click();await frame.locator('nav').getByRole('link',{name:/^Integrations/}).waitFor();assert((await frame.locator('nav a:visible').count())>5);await audit('menu');await page.keyboard.press('Escape');}
  else {assert((await frame.locator('nav a:visible').count())>=2);}
  await page.reload();await frame.locator('h1').first().waitFor();
  assert.equal(await frame.getByText('This page couldn’t load',{exact:true}).count(),0);await page.close();
 }
 const fatal=errors.filter(e=>!/Minified React error #418/.test(e.message));assert.deepEqual(fatal,[]);
 console.log('Four page loads, reloads, and navigation states passed.');console.log(`${reports.reduce((n,r)=>n+r.report.findings.length,0)} UI findings; ${errors.length} recoverable hydration warnings.`);
 if(reports.some(r=>r.report.findings.length))process.exitCode=1;
}finally{await browser.close();await writeFile(`${out}/ui.json`,JSON.stringify({reports,errors},null,2));}
