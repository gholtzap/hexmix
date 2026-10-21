import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {checkPage} from 'lintapple';
import {sitePreviews} from '../src/lib/previews.ts';
import {roles, initialPalette} from '../src/lib/palette.ts';
import {previewHref} from '../src/lib/preview-catalog.ts';

const output = 'artifacts/preview-navigation';
const base = process.env.APP_URL || 'http://127.0.0.1:3000';
await mkdir(output, {recursive:true});
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const palettes = {dark:{text:'#f9fcf8',background:'#222d1f',primary:'#94ce88',secondary:'#beefcd',accent:'#4a8b3c'},light:initialPalette};
const reports = [], checks = [];
const requested = process.argv.slice(2);
const browser = await chromium.launch();
try {
  for (const width of [390,1440]) for (const [theme,palette] of Object.entries(palettes)) {
    for (const [site,preview] of Object.entries(sitePreviews)) {
      if(requested.length && !requested.includes(`${site}:${width}:${theme}`))continue;
      const page = await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
      page.setDefaultTimeout(20000);
      await page.goto(base+previewHref('/'+site,palette,'System','System'));
      await page.locator('[data-app-ready]').waitFor();
      await page.evaluate(() => { window.__navigationDocument = crypto.randomUUID(); window.__navigationToolbar = document.querySelector('[aria-label="Color toolbar"]'); });
      const documentId = await page.evaluate(() => window.__navigationDocument);
      const paints = [];
      await page.exposeFunction('recordPreviewPaint', state => paints.push(state));
      await page.evaluate(() => {
        const inspect = () => {
          const iframe = document.querySelector('iframe');
          window.recordPreviewPaint({src:iframe?.src,visible:iframe && getComputedStyle(iframe).visibility,ready:iframe?.dataset.previewReady});
        };
        new MutationObserver(inspect).observe(document.querySelector('main'), {subtree:true,childList:true,attributes:true,attributeFilter:['src','style','data-preview-ready']});
      });
      const ready = async () => {
        await page.locator('[data-app-ready]').waitFor();
        await page.locator('iframe[data-preview-ready="true"]').waitFor();
        const frame = page.frames().find(frame=>frame.parentFrame());
        assert(frame, 'The site preview must exist');
        await frame.waitForFunction(expected=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===expected,roles.map(role=>palette[role]).join('|'));
        await frame.locator('body').waitFor({state:'visible'});
        await frame.locator('a[data-preview-path]').first().waitFor({state:'attached'});
        assert.equal(page.frames().length,2,'Only the editor and its site preview can exist');
        assert.equal(await page.getByRole('region',{name:'Color toolbar',exact:true}).count(),1);
        assert.equal(await frame.locator('[aria-label="Color toolbar"]').count(),0,'The preview cannot contain an editor');
        return frame;
      };
      const audit = async state => {
        const frame = await ready();
        for (const [surface,target] of [['editor',page],['preview',frame]] as const) {
          let report = {findings:[]};
          try { if(surface==='preview') report=await checkPage(target,policy); else await expectUI(page,{attach:async(_,attachment)=>{report=JSON.parse(String(attachment.body));}},policy); }
          catch (error) { if (!report.findings.length) throw error; }
          reports.push({site,width,theme,state,surface,...report});
        }
        return frame;
      };
      let frame = await audit('home');
      const selector = site==='avenlo'?'a[data-preview-path="/enterprise"]:visible':site==='orvian'?'footer a[data-preview-path="/blog"]:visible':'a[data-preview-path]:not([data-preview-path="/"]):visible';
      const link = frame.locator(selector).first();
      const path = await link.getAttribute('data-preview-path');
      await link.click();
      await page.waitForURL(url=>url.pathname==='/'+site+path);
      assert.equal(new URL(page.url()).searchParams.get('colors'),new URLSearchParams(previewHref('',palette,'System','System').slice(1)).get('colors'));
      frame = await audit('page link');
      assert.equal(await page.evaluate(() => window.__navigationDocument),documentId,'Page links must keep the editor document');
      assert(await page.evaluate(() => window.__navigationToolbar === document.querySelector('[aria-label="Color toolbar"]')),'Page links must keep the same toolbar');
      assert(paints.filter(state=>state.visible==='visible').every(state=>state.ready==='true'),'Only a ready preview can be visible');
      await page.evaluate(() => history.back());
      await page.waitForURL(url=>url.pathname==='/'+site);
      await ready();
      assert.equal(await page.evaluate(() => window.__navigationDocument),documentId,'Back must keep the editor document');
      await page.evaluate(() => history.forward());
      await page.waitForURL(url=>url.pathname==='/'+site+path);
      await ready();
      checks.push({site,width,theme,path,frames:page.frames().length,palette,paints});
      console.log(`Checked ${site} ${width} ${theme}`);
      if(site==='avenlo')await page.screenshot({path:`${output}/avenlo-${width}-${theme}.png`});
      await page.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/actions.json`,JSON.stringify(checks,null,2));
  await writeFile(`${output}/ui.json`,JSON.stringify(reports,null,2));
}
assert.equal(checks.length,requested.length || 16);
console.log(`Passed ${checks.length} page navigation checks. UI findings: ${reports.reduce((sum,report)=>sum+report.findings.length,0)}.`);
process.exitCode=reports.some(report=>report.findings.length)?1:0;
