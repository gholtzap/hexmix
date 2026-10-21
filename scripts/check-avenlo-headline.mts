import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
const base=process.env.APP_URL||'http://127.0.0.1:3000',output='artifacts/avenlo-headline';
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch(),results=[],reports=[];
try {
 for(const width of [320,390,1440])for(const theme of ['light','dark'] as const)for(const heading of ['System','Playfair Display']){
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  const colors=theme==='light'?'171717-ffffff-e98878-ffe291-a8655f':'ededed-171717-e98878-333333-a8655f';
  await page.goto(`${base}/avenlo?colors=${colors}&heading=${encodeURIComponent(heading)}&body=System`);
  const frame=page.frameLocator('iframe');await frame.locator('html[data-contrast-ready=true]').waitFor();await frame.locator('html').evaluate(()=>document.fonts.ready);
  const states=await frame.locator('.hero__type').evaluate(node=>{
   const typed=node.querySelector('.hero__typed'),words=[...node.querySelectorAll('.hero__sizer')].map(n=>n.textContent),original=typed.textContent;
   const results=['',...words].map(word=>{typed.textContent=word;return {word,titleHeight:document.querySelector('.hero__title').getBoundingClientRect().height,ledeTop:document.querySelector('.hero__lede').getBoundingClientRect().top,ctaTop:document.querySelector('.hero__cta').getBoundingClientRect().top};});typed.textContent=original;return results;
  });
  for(const metric of ['titleHeight','ledeTop','ctaTop'])assert(Math.max(...states.map(s=>s[metric]))-Math.min(...states.map(s=>s[metric]))<1,`${width} ${theme} ${heading}: ${metric} shifts`);
  results.push({width,theme,heading,states});
  for(const state of ['full','empty']){
   if(state==='empty')await frame.locator('.hero__typed').evaluate(n=>{n.textContent='';});
   let report={findings:[]};try{await expectUI(page,{attach:async(_,a)=>{report=JSON.parse(String(a.body));}},policy);}finally{reports.push({width,theme,heading,state,report});}
  }
  if(heading==='System')await page.screenshot({path:`${output}/${width}-${theme}-empty.png`});await page.close();
 }
 for(const theme of ['light','dark'] as const){
  const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:theme,reducedMotion:'no-preference'});
  await page.goto(`${base}/avenlo?colors=${theme==='light'?'171717-ffffff-e98878-ffe291-a8655f':'ededed-171717-e98878-333333-a8655f'}`);
  const frame=page.frameLocator('iframe');await frame.locator('html[data-contrast-ready=true]').waitFor();
  const motion=await frame.locator('.hero__typed').evaluate(async typed=>{
   await document.fonts.ready;const samples=[],start=performance.now();
   await new Promise<void>(resolve=>{function sample(){samples.push({word:typed.textContent,top:document.querySelector('.hero__lede').getBoundingClientRect().top});if(performance.now()-start<7200)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
   return {emptySeen:samples.some(s=>s.word===''),words:[...new Set(samples.map(s=>s.word))],min:Math.min(...samples.map(s=>s.top)),max:Math.max(...samples.map(s=>s.top))};
  });assert(!motion.emptySeen,'The editor must keep the changing word clickable');assert(motion.words.length>=3);assert(motion.max-motion.min<1,JSON.stringify(motion));
  await frame.locator('.hero__typed').hover();
  await frame.locator('.hero__typed').click({modifiers:['Alt']});
  await page.locator('.element-panel').waitFor();
  const selected=await frame.locator('.hero__typed').textContent();
  assert(await frame.locator('.hero__sizer').allTextContents().then(words=>words.includes(selected)));
  await page.mouse.move(1,100);await page.waitForTimeout(2400);
  assert.equal(await frame.locator('.hero__typed').textContent(),selected,'The selected word must stay in place');
  await page.keyboard.press('Escape');await frame.locator('[data-hexmix-selected]').waitFor({state:'detached'});
  results.push({theme,motion,selected});await page.close();
 }
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({results,reports},null,2));}
console.log(`${results.length-2} layouts, ${reports.length} UI checks, and two live animation checks passed.`);
