import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {chromium} from 'playwright';
import {sitePreviews} from '../src/lib/previews.ts';
import {previewHref} from '../src/lib/preview-catalog.ts';

const output='artifacts/business-copy';
const samples={avenlo:'products/website-qualifier',tervix:'forward-deployed',orvian:'blog',nuvexa:'products/quotes-and-tenders'};
const palettes={light:{text:'#171717',background:'#ffffff',primary:'#242424',secondary:'#eeeeee',accent:'#626262'},dark:{text:'#ededed',background:'#171717',primary:'#db9b86',secondary:'#333333',accent:'#c7b299'}};
const checks=[],errors=[];
await mkdir(output,{recursive:true});

const browser=await chromium.launch();
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    for(const [site,preview] of Object.entries(sitePreviews)){
      for(const [theme,palette] of Object.entries(palettes)){
        for(const suffix of ['',samples[site]]){
          await page.goto('http://127.0.0.1:3000'+previewHref('/'+preview.slug+(suffix?'/'+suffix:''),palette,'Arial','Verdana'));
          const frame=page.frameLocator('iframe');
          await frame.locator('html[data-contrast-ready="true"]').waitFor();
          if(site==='tervix'&&!suffix)await frame.locator('html[data-home-ready="true"]').waitFor();
          const text=await frame.locator('body').innerText();
          assert(text.length>150,`${site}/${suffix} has no copy`);
          assert(text.includes(preview.name), `${site}/${suffix} must show its preview name`);
          checks.push({site,path:suffix||'home',theme,width});
        }
      }
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser.close();
  await writeFile(`${output}/checks.json`,JSON.stringify({checks,errors},null,2));
}
console.log(`${checks.length} homepage and source-page copy states passed.`);
