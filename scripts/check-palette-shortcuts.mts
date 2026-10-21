import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {initialPalette,defaultDarkPalette,paletteQuery,readPalette} from '../src/lib/palette.ts';
const base=process.env.APP_URL??'http://127.0.0.1:3381',out='artifacts/palette-shortcuts';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),results=[];
try{for(const width of [390,1440])for(const [theme,palette] of Object.entries({light:initialPalette,dark:defaultDarkPalette}))for(const path of ['/','/avenlo','/dashboards/ai-chatbot']){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}${path}?${paletteQuery(palette)}`);await page.locator('[data-app-ready]').waitFor();
 const current=()=>readPalette(new URL(page.url()).search);await page.getByRole('button',{name:'Shuffle palette',exact:true}).click();await expect.poll(current).not.toEqual(palette);const shuffled=current();
 const focus=async()=>{if(path==='/')await page.getByRole('heading',{level:1}).click();else{await page.locator('iframe[data-preview-ready=true]').waitFor();await page.frameLocator('iframe').getByRole('heading',{level:1}).first().click();}};
 for(const modifier of ['Control','Meta']){
  await focus();await page.keyboard.press(`${modifier}+z`);await expect.poll(current).toEqual(palette);
  await page.keyboard.press(`${modifier}+Shift+z`);await expect.poll(current).toEqual(shuffled);
 }
 await page.getByRole('button',{name:'Text color',exact:true}).click();const input=page.getByRole('textbox',{name:'Hex',exact:true});await input.focus();await page.keyboard.press('Control+z');assert.deepEqual(current(),shuffled,'Typing undo must not change palette history');await page.keyboard.press('Meta+z');assert.deepEqual(current(),shuffled);await page.getByRole('button',{name:'Close color picker',exact:true}).click();
 assert.deepEqual(errors,[]);results.push({width,theme,path,undo:true,redo:true,textUndoPreserved:true,errors});await page.close();
}
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await page.goto(`${base}/compare?preview=avenlo&linked=0&customA=1`);await page.locator('[data-app-ready]').waitFor();
  const frame=page.frameLocator('iframe[title="Palette A preview"]');await frame.locator('[data-app-ready]').waitFor();await frame.locator('iframe[data-preview-ready=true]').waitFor();
  const current=()=>new URL(page.url()).searchParams.get('a');const before=current();await frame.getByRole('button',{name:'Shuffle palette',exact:true}).click();await expect.poll(current).not.toBe(before);const shuffled=current();
  if(width===390)await page.locator('header[aria-label="Palette A toolbar"]').click({position:{x:2,y:2}});else await page.mouse.click(width/2,20);await page.keyboard.press('Control+z');await expect.poll(current).toBe(before);await page.keyboard.press('Control+Shift+z');await expect.poll(current).toBe(shuffled);
  results.push({width,theme:'comparison',path:'/compare',undo:true,redo:true,textUndoPreserved:true,errors:[]});await page.close();
 }
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));}console.log(`Passed ${results.length} shortcut flows across home, website, and chatbot, with both modifier keys.`);
