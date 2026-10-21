import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
import {initialPalette,defaultDarkPalette,paletteQuery,roles} from '../src/lib/palette.ts';
const base=process.env.APP_URL??'http://127.0.0.1:3381';
const out='artifacts/mobile-swatches';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),reports=[];
try {
 for(const width of [320,390,1440])for(const [theme,palette] of Object.entries({light:initialPalette,dark:defaultDarkPalette})) {
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme as 'light'|'dark',reducedMotion:'reduce'});
  await page.goto(`${base}/?${paletteQuery(palette)}`);await page.locator('[data-app-ready]').waitFor();
  for(const role of roles) {
   const name=role[0].toUpperCase()+role.slice(1)+' color',button=page.getByRole('button',{name,exact:true});
   const text=button.locator('.color-trigger-name');assert.equal(await text.isVisible(),width>1200);
   const box=await button.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width&&box.height>=44);
   if(width<=1200){await button.hover();await expect(page.locator(`[id="${await button.getAttribute('aria-describedby')}"]`)).toBeVisible();}
   await button.click();await page.getByRole('heading',{name:role[0].toUpperCase()+role.slice(1),exact:true}).waitFor();
   await page.getByRole('button',{name:'Close color picker',exact:true}).click();
  }
  await page.getByRole('button',{name:'Text color',exact:true}).click();await page.getByRole('textbox',{name:'Hex',exact:true}).fill('243841');await page.getByRole('textbox',{name:'Hex',exact:true}).press('Enter');await page.getByRole('button',{name:'Close color picker',exact:true}).click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('colors')?.split('-')[0]).toBe('243841');
  await page.mouse.move(0,0);const ui=await checkPage(page,policy);reports.push({width,theme,ui});assert.deepEqual(ui.findings,[]);
  await page.screenshot({path:`${out}/${width}-${theme}.png`});await page.close();
 }
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));}
console.log('Passed six mobile and desktop swatch states, all five pickers, tooltips, and color edits.');
