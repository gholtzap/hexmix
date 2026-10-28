import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
import {contrast} from '../src/lib/palette.ts';
import {measure} from './lib/measure-text-contrast.mts';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = 'artifacts/nuvexa-stories';
await mkdir(output, {recursive:true});
const browser = await chromium.launch(), checks = [], reports = [];
try {
 for (const width of [390,1440]) for (const [theme,colors] of [
  ['light','1d0b20-fff8f7-e55a19-fea818-fee67e'],
  ['dark','fff8f7-1d0b20-e55a19-fea818-fee67e'],
 ]) {
  const page = await browser.newPage({viewport:{width,height:900},colorScheme:theme as 'light'|'dark',reducedMotion:'reduce'});
  page.setDefaultTimeout(15000);
  try {
   await page.goto(`${base}/nuvexa?colors=${colors}&heading=System&body=System`);
   await page.frameLocator('iframe').locator('html[data-copy-ready=true][data-contrast-ready=true]').waitFor();
   await page.waitForLoadState('networkidle');
   const frame = page.frames().find(item=>item.parentFrame())!;
   const carousel = frame.locator('#stories-carousel');
   const card = carousel.locator('[data-framer-name="Case Study Card"] a:visible').first();
   await card.scrollIntoViewIfNeeded();
   for (const state of ['normal','hover','focus']) {
    if(state==='hover')await card.hover();
    if(state==='focus'){await page.mouse.move(0,0);await card.focus();}
    await frame.evaluate(async()=>{
     await document.fonts.ready;
     await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
    });
    await frame.waitForFunction(colors=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===colors.split('-').map(c=>'#'+c).join('|'),colors);
    const surfaces = await carousel.locator('[data-preview-text-surface]').count();
    assert.equal(surfaces,0,`${width} ${theme} ${state}: separate text backgrounds`);
    const text = (await measure(frame)).filter(item=>item.selector.includes('framer-text')&&['Example team','Example business','Example company','Shared goals','New possibilities','More','Less','Next','Read the story','Explore the story','“A clearer view of what comes next.”','“A simple way to bring our ideas together.”','“More room to focus on the bigger picture.”'].includes(item.label));
    assert.ok(text.length, 'Story text must be measured');
    assert.deepEqual(text.filter(item=>contrast(item.foreground,item.background)<4.5),[]);
    assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'Page must fit the viewport');
    checks.push({width,theme,state,text,surfaces});
    reports.push({width,theme,state,host:await checkPage(page,policy),preview:await checkPage(frame,policy)});
    await page.screenshot({path:`${output}/${width}-${theme}-${state}.png`});
   }
   const before = await carousel.evaluate(node=>node.scrollLeft);
   await frame.locator('[data-framer-name="Carousel Arrows"] button[aria-label="Next"]').click();
   await frame.waitForFunction(before=>document.getElementById('stories-carousel')!.scrollLeft>before,before);
   await card.scrollIntoViewIfNeeded();
   await card.click();
   await page.waitForURL(url=>url.pathname==='/nuvexa/success-stories/story-a');
  } finally {await page.close();}
 }
} finally {
 await browser.close();
 await writeFile(`${output}/report.json`,JSON.stringify({checks,reports},null,2));
}
const findings = reports.reduce((sum,item)=>sum+item.host.findings.length+item.preview.findings.length,0);
console.log(`${checks.length} story states checked. ${findings} UI findings. Report: ${output}/report.json`);
if(findings)process.exitCode=1;
