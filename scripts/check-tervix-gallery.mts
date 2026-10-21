import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import {expectUI} from 'lintapple/playwright';
import policy from '../ui-policy.json' with {type:'json'};
import {contrast} from '../src/lib/palette.ts';

const base=process.env.APP_URL??'http://127.0.0.1:3100',out='artifacts/tervix-gallery';
await mkdir(out,{recursive:true});
const browser=await chromium.launch(),reports=[],flows=[];
try {
 for(const width of [390,1440])for(const [theme,colors]of Object.entries({light:'0c0a09-ffffff-e98878-ffe291-a8655f',dark:'ffffff-0c0a09-e98878-ffe291-a8655f'})) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',hasTouch:width===390}),page=await context.newPage();
  try {
   await page.goto(`${base}/tervix?colors=${colors}&heading=System&body=System`);
   await page.locator('iframe[data-preview-ready=true]').waitFor();
   const frame=page.frames().find(f=>f.parentFrame());
   await frame.waitForSelector('html[data-home-ready=true][data-contrast-ready=true]');
   const cards=frame.locator('[data-tervix-gallery] > [role=tabpanel]'),tabs=frame.getByRole('tablist',{name:'Work priorities'}).getByRole('tab');
   assert.equal(await cards.count(),6);assert.equal(await tabs.count(),6);
   const audit=async state=>{
    await frame.waitForFunction(()=>document.documentElement.dataset.contrastReady==='true');
    let host;
    await expectUI(page,{attach:async(_,attachment)=>{host=JSON.parse(String(attachment.body));}});
    reports.push({width,theme,state,host,preview:await checkPage(frame,policy)});
    await page.screenshot({path:`${out}/${width}-${theme}-${state}.png`});
   };
   for(let index=0;index<6;index++) {
    if(width===390)await tabs.nth(index).tap();else await tabs.nth(index).click();
    assert.equal(await tabs.nth(index).getAttribute('aria-selected'),'true');
    assert.equal(await frame.getByRole('tab',{selected:true}).count(),1);
    await cards.nth(index).locator('h4').waitFor({state:'visible'});
    assert.equal(await cards.locator('.items-end[aria-hidden="false"]').count(),1);
    assert.equal(await cards.nth(index).locator('[data-preview-text-surface]').count(),0);
    const expand=cards.nth(index).getByRole('button',{name:/^Expand /});
    await expand.click();
    const dialog=frame.getByRole('dialog');await dialog.waitFor();
    assert.equal(await dialog.locator('h2').textContent(),await cards.nth(index).locator('h4').textContent());
    const text=await dialog.locator('h2,p').evaluateAll(nodes=>nodes.map(node=>{
     const rect=node.getBoundingClientRect(),css=getComputedStyle(node);
     const rgb=value=>'#'+value.match(/\d+/g).slice(0,3).map(c=>Number(c).toString(16).padStart(2,'0')).join('');
     return {foreground:rgb(css.webkitTextFillColor||css.color),background:rgb(getComputedStyle(node.closest('dialog')).backgroundColor),visible:[.05,.5,.95].every(fraction=>node.contains(document.elementFromPoint(rect.left+rect.width*fraction,rect.top+rect.height/2)))};
    }));
    for(const item of text){assert(item.visible,'Dialog text must not be covered');assert(contrast(item.foreground,item.background)>=4.5,'Dialog text must be readable');}
    if(index===0||index===5)await audit(`open-${index}`);
    if(index%2)await dialog.getByRole('button',{name:'Close gallery preview',exact:true}).click();else await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    assert(await expand.evaluate(n=>n===document.activeElement));
    flows.push({width,theme,index,selected:true,expanded:true,closed:true,focusRestored:true,text});
   }
   await tabs.last().focus();await page.keyboard.press('ArrowRight');assert.equal(await tabs.first().getAttribute('aria-selected'),'true');
   await page.keyboard.press('End');assert.equal(await tabs.last().getAttribute('aria-selected'),'true');
   await page.keyboard.press('Home');assert.equal(await tabs.first().getAttribute('aria-selected'),'true');
   await page.keyboard.press('ArrowLeft');assert.equal(await tabs.last().getAttribute('aria-selected'),'true');
   const firstCard=cards.first().locator(':scope > .items-center');
   if(width===390)await firstCard.tap();else await firstCard.click();
   assert.equal(await tabs.first().getAttribute('aria-selected'),'true');
   await audit('selected');
  } finally {await context.close();}
 }
 console.log(`${flows.length} selection, expand, close, and focus flows passed; keyboard navigation passed in all four layouts. ${reports.length} app-host UI checks passed.`);
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({flows,reports},null,2));}
