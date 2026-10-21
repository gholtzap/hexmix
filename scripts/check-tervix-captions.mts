import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
import {contrast} from '../src/lib/palette.ts';

const base = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const output = 'artifacts/tervix-captions';
await mkdir(output, {recursive:true});
const browser = await chromium.launch(), reports = [], flows = [];
const palettes = {
 light:'0c0a09-ffffff-e98878-ffe291-a8655f',
 dark:'ffffff-0c0a09-e98878-ffe291-a8655f',
 greenLight:'222d1f-f9fcf8-94ce88-beefcd-4a8b3c',
 greenDark:'f9fcf8-222d1f-94ce88-beefcd-4a8b3c',
 lowContrastLight:'ffffff-ffffff-e98878-ffe291-a8655f',
 lowContrastDark:'000000-0c0a09-e98878-ffe291-a8655f',
};
try {
 for (const width of [390,1440]) for (const [theme,colors] of Object.entries(palettes)) {
  const page = await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  try {
   await page.goto(`${base}/tervix?colors=${colors}&heading=System&body=System`);
   await page.locator('iframe[data-preview-ready=true]').waitFor();
   const frame = page.frames().find(item=>item.parentFrame());
   await frame.waitForFunction(colors=>document.documentElement.dataset.homeReady==='true' && document.documentElement.dataset.contrastReady==='true' && document.documentElement.dataset.contrastPalette===colors.split('-').map(color=>'#'+color).join('|'),colors);
   const cards = frame.locator('main [class~="transition-[flex]"]');
   assert.equal(await cards.count(),6);
   for (const state of ['caption','labels']) {
    await cards.first().scrollIntoViewIfNeeded();
    if (state==='labels'&&width===390)await cards.last().scrollIntoViewIfNeeded();
    await frame.waitForFunction(()=>document.documentElement.dataset.contrastReady==='true');
    const text = await cards.locator('.items-end :is(h4,p),.items-center span').evaluateAll(nodes=>nodes.filter(node=>node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).map(node=>{
     const css=getComputedStyle(node), overlay=node.closest('.items-center')||node.parentElement, bounds=node.getBoundingClientRect(), region=overlay.getBoundingClientRect();
     return {label:node.textContent.trim(),foreground:css.color,surface:getComputedStyle(node.closest('[data-preview-readable-artwork]')).getPropertyValue('--preview-readable-surface').trim(),backing:node.hasAttribute('data-preview-text-surface'),background:css.backgroundColor,withinSurface:bounds.top>=region.top && bounds.bottom<=region.bottom,vertical:!!node.closest('.items-center')};
    }));
    const hex = (value,background='#000000') => {if(value.startsWith('#'))return value;const values=value.match(/[\d.]+/g).map(Number),alpha=values[3]??1;if(value.startsWith('color(srgb'))for(let i=0;i<3;i++)values[i]*=255;return '#'+values.slice(0,3).map((channel,i)=>Math.round(channel*alpha+parseInt(background.slice(1+i*2,3+i*2),16)*(1-alpha)).toString(16).padStart(2,'0')).join('');};
    for (const item of text) {
     assert(!item.backing,`${item.label} has a separate text background`);
     assert.equal(item.background,'rgba(0, 0, 0, 0)');
     assert(item.vertical||item.withinSurface,`${item.label} leaves its caption surface`);
     assert(contrast(hex(item.foreground,item.surface),hex(item.surface))>=4.5,`${item.label} has low contrast`);
    }
    if(width===390) {
     assert(await cards.evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().width>=44)));
     assert(await cards.first().evaluate(node=>{const row=node.parentElement.getBoundingClientRect();return row.left>=0&&row.right<=innerWidth;}));
    }
    flows.push({width,theme,state,text});
    reports.push({width,theme,state,host:await checkPage(page,policy),preview:await checkPage(frame,policy)});
    await page.screenshot({path:`${output}/${width}-${theme}-${state}.png`});
   }
  } finally {await page.close();}
 }
 assert.deepEqual(reports.flatMap(item=>item.host.findings),[]);
 console.log(`${flows.length} caption states passed. ${reports.length} app-host checks passed. Embedded-page findings: ${reports.reduce((sum,item)=>sum+item.preview.findings.length,0)}.`);
} finally {
 await browser.close();
 await writeFile(`${output}/report.json`,JSON.stringify({flows,reports},null,2));
}
