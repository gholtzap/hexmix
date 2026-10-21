import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
import {initialPalette,defaultDarkPalette,paletteQuery,readPalette} from '../src/lib/palette.ts';
const base=process.env.APP_URL??'http://127.0.0.1:3381',out='artifacts/mobile-quick-actions';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),reports=[];
try{for(const width of [320,390,1440])for(const [theme,palette] of Object.entries({light:initialPalette,dark:defaultDarkPalette})){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await page.goto(`${base}/?${paletteQuery(palette)}`);await page.locator('[data-app-ready]').waitFor();
 const undo=page.getByRole('button',{name:'Undo palette',exact:true}),shuffle=page.getByRole('button',{name:'Shuffle palette',exact:true});
 await expect(undo).toBeDisabled();await expect(shuffle).toBeVisible();await shuffle.click();await expect(undo).toBeEnabled();
 assert.notDeepEqual(readPalette(new URL(page.url()).search),palette);await undo.click();await expect.poll(()=>readPalette(new URL(page.url()).search)).toEqual(palette);await expect(undo).toBeDisabled();
 const boxes=await page.locator('.color-trigger,[data-quick-action],.toolbar-more').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height).map(r=>({x:r.x,right:r.right,y:r.y,height:r.height})));
 assert(boxes.every(r=>r.x>=0&&r.right<=width));assert(Math.max(...boxes.map(r=>r.y+r.height/2))-Math.min(...boxes.map(r=>r.y+r.height/2))<5,'Toolbar must stay on one row');
 await page.mouse.move(0,0);const ui=await checkPage(page,policy);reports.push({width,theme,ui});assert.deepEqual(ui.findings,[]);await page.screenshot({path:`${out}/${width}-${theme}.png`});await page.close();
}}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));}console.log('Passed direct Shuffle and Undo, disabled history, and single-row layout in six states.');
