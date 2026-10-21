import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {legacyPreviewRoutes,legacyPageRoutes,sitePreviews} from '../src/lib/previews.ts';
import {previewHref} from '../src/lib/preview-catalog.ts';
import {defaultDarkPalette,readPalette} from '../src/lib/palette.ts';

const base='http://127.0.0.1:3000',output='artifacts/preview-routes';
const samples={avenlo:'products/website-qualifier',tervix:'forward-deployed',orvian:'blog',nuvexa:'products/quotes-and-tenders'};
const palettes={dark:defaultDarkPalette,light:{text:'#171717',background:'#ffffff',primary:'#171717',secondary:'#eeeeee',accent:'#626262'}};
const redirects=[],actions=[],errors=[];
await mkdir(output,{recursive:true});

for(const route of legacyPreviewRoutes){
  for(const suffix of ['',route.source.includes('workspace')?'/work':route.source.includes('infrastructure')?'/deployments':'/contact']){
    const original=new URL(base+previewHref(route.source+suffix,defaultDarkPalette,'Arial','Verdana'));
    const response=await fetch(original,{redirect:'manual'});
    assert.equal(response.status,308);
    const target=new URL(response.headers.get('location'),base);
    assert.equal(target.pathname,route.destination+suffix);
    assert.equal(target.search,original.search);
    redirects.push({from:original.pathname,to:target.pathname,status:response.status});
  }
}
for(const route of legacyPageRoutes){
  const response=await fetch(base+route.source,{redirect:'manual'});
  assert.equal(response.status,308);
  assert.equal(new URL(response.headers.get('location'),base).pathname,route.destination);
  redirects.push({from:route.source,to:route.destination,status:response.status});
}

const browser=await chromium.launch();
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push({url:page.url(),message:error.message}));
    for(const [theme,palette] of Object.entries(palettes)){
      for(const [id,preview] of Object.entries(sitePreviews)){
        await page.goto(base+previewHref('/'+preview.slug,palette,'Arial','Verdana'));
        await page.getByRole('button',{name:'Switch site: '+preview.name,exact:true}).waitFor();
        const homeFrame=page.frameLocator('iframe');
        if(id==='tervix')await homeFrame.locator('html[data-home-ready="true"]').waitFor();
        await homeFrame.locator('a[data-preview-path]').first().waitFor({state:'attached'});
        const links=await homeFrame.locator('a[data-preview-path][href]').evaluateAll(elements=>elements.map(element=>element.getAttribute('href')).filter(Boolean));
        assert(links.length>0,`${id} has no local links`);
        for(const href of links){
          const url=new URL(href,base);
          assert(url.pathname==='/'+preview.slug||url.pathname.startsWith('/'+preview.slug+'/'),href);
        }
        await page.goto(base+previewHref('/'+preview.slug+'/'+samples[id],palette,'Arial','Verdana'));
        assert.equal(new URL(page.url()).pathname,'/'+preview.slug+'/'+samples[id]);
        assert.deepEqual(readPalette(new URL(page.url()).search),palette);
        const frameUrl=await page.locator('iframe').getAttribute('src');
        assert.equal(new URL(frameUrl).pathname,'/'+samples[id]);
        const frame=page.frameLocator('iframe');
        await frame.locator('html[data-contrast-ready="true"]').waitFor();
        const copy=await frame.locator('body').innerText();
        assert(copy.length>150,`${id} source page is empty`);
        assert(!/Avenlo|Tervix AI|Orvian|Nuvexa/.test(copy),`${id} still shows source branding`);
        await page.reload();
        await page.frameLocator('iframe').locator('html[data-contrast-ready="true"]').waitFor();
        actions.push(`${width} ${theme} ${id}: local links, source page, palette, reload`);
      }
    }
    await page.goto(base+'/dashboards/infrastructure/deployments?heading=Arial&body=Verdana');
    await page.frameLocator('iframe').getByRole('heading',{name:'Deployments',exact:true}).waitFor();
    assert.equal(new URL(page.url()).pathname,'/dashboards/infra-dashboard/deployments');
    const infra=page.frameLocator('iframe');
    if(width===390)await infra.locator('.vc-topbar-toggle').getByRole('button',{name:'Open sidebar',exact:true}).click();
    await infra.locator('.vc-sidebar-links').getByRole('button',{name:/^Logs/}).click();
    await page.waitForURL(url=>url.pathname==='/dashboards/infra-dashboard/logs');
    await page.goBack();
    await infra.getByRole('heading',{name:'Deployments',exact:true}).waitFor();
    await page.reload();
    await infra.getByRole('heading',{name:'Deployments',exact:true}).waitFor();
    await page.goto(base+'/dashboards/workspace');
    const chatbot=page.frameLocator('iframe');
    await chatbot.getByRole('radio',{name:'Work',exact:true}).waitFor();
    assert.equal(new URL(page.url()).pathname,'/dashboards/ai-chatbot');
    await chatbot.getByRole('radio',{name:'Work',exact:true}).click();
    await page.waitForURL(url=>url.pathname==='/dashboards/ai-chatbot/work');
    await page.goBack();
    await chatbot.getByRole('heading',{name:'What’s on your mind today?',exact:true}).waitFor();
    await page.reload();
    await chatbot.getByRole('heading',{name:'What’s on your mind today?',exact:true}).waitFor();
    actions.push(`${width}: dashboard redirects, navigation, Back and reload`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser.close();
  await writeFile(`${output}/redirects.json`,JSON.stringify(redirects,null,2));
  await writeFile(`${output}/actions.json`,JSON.stringify({actions,errors},null,2));
}
console.log(`${redirects.length} redirects and ${actions.length} route/action groups passed.`);
