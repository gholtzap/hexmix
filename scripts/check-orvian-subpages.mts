import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';

const out='artifacts/orvian-subpages';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const reports=[],errors=[];
const paths=['blog','blog/1','terms','privacy','dpa'];
async function audit(page,path,width,theme,state='page'){
  let report={findings:[]};let attached=false;
  try{await expectUI(page,{attach:async(_,item)=>{report=JSON.parse(String(item.body));attached=true}})}catch(error){if(!attached)throw error}
  reports.push({path,width,theme,state,report});
  await page.screenshot({path:`${out}/${path.replaceAll('/','-')}-${width}-${theme}-${state}.png`});
}
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    for(const path of paths){
      await page.goto(`http://127.0.0.1:3000/orvian/${path}`);
      const frame=page.frameLocator('iframe');
      await frame.locator('html[data-editor-site="orvian"]').waitFor();
      await frame.locator('h1').waitFor();
      assert.equal(await page.locator('iframe').getAttribute('src'),`http://127.0.0.1:3002/${path}`);
      const body=await frame.locator('body').innerText();
      assert.doesNotMatch(body,/Orvian|Digital Workers|Conor|Manu Ebert|Ignore all previous instructions/i);
      await audit(page,path,width,'dark');
      let coverBefore;
      if(path==='blog'){
        assert.equal(await frame.locator('.orvian-card').count(),22);
        coverBefore=await frame.locator('.orvian-cover').first().evaluate(e=>getComputedStyle(e).backgroundImage);
        if(width===390)await frame.getByRole('button',{name:'Toggle menu'}).click();
        else await frame.getByRole('button',{name:'Resources'}).click();
        await frame.locator(width===390?'#mobile-menu':'#resources-menu').getByRole('link',{name:'Featured note'}).waitFor();
        await audit(page,path,width,'dark','menu');
        const afterMenu=await frame.locator('.orvian-cover').first().evaluate(e=>getComputedStyle(e).backgroundImage);
        assert.equal(coverBefore,afterMenu);
        if(width===390)await frame.getByRole('button',{name:'Toggle menu'}).click();
        else await frame.getByRole('button',{name:'Resources'}).click();
      }
      await page.getByRole('button',{name:'Use light palette'}).click();
      await frame.locator('html[data-editor-light="true"]').waitFor();
      if(path==='blog'){
        const changed=await frame.locator('.orvian-cover').first().evaluate(e=>getComputedStyle(e).backgroundImage);
        assert.notEqual(changed,coverBefore);
      }
      await audit(page,path,width,'light');
      if(path==='blog'){
        await frame.locator('.orvian-card').first().click();
        await page.waitForURL(url=>url.pathname==='/orvian/blog/1');
        await page.goBack();
        await page.waitForURL(url=>url.pathname==='/orvian/blog');
        await page.getByRole('button',{name:'Use light palette'}).click();
        await frame.locator('html[data-editor-light="true"]').waitFor();
        if(width===390)await frame.getByRole('button',{name:'Toggle menu'}).click();
        await frame.locator('[data-open-demo]:visible').first().click();
        await frame.getByRole('dialog').waitFor();
        await audit(page,path,width,'light','dialog');
        await frame.getByRole('dialog').press('Escape');
      }
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser.close();
  await writeFile(`${out}/ui.json`,JSON.stringify({reports,errors},null,2));
}
const findings=reports.reduce((n,item)=>n+item.report.findings.length,0);
console.log(`${reports.length} Orvian page states checked; ${findings} UI findings`);
if(findings)process.exitCode=1;
