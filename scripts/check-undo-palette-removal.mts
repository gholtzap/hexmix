import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
import {initialPalette,defaultDarkPalette,paletteQuery} from '../src/lib/palette.ts';
import {encodeState} from '../browser/public/share-state.ts';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const base=process.env.APP_URL??'http://127.0.0.1:3381',out='artifacts/undo-palette-removal';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),reports=[];
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1')??'[]'));
const open=page=>clickToolbarAction(page,'Palettes');
const remove=async(page,name)=>{await page.getByRole('button',{name:`More actions for ${name}`,exact:true}).click();await page.getByRole('menuitem',{name:'Remove palette',exact:true}).click();};
const save=async(page,name)=>{await page.getByRole('button',{name:'Save palette',exact:true}).click();await page.getByRole('textbox',{name:'Palette name',exact:true}).fill(name);await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:`Apply ${name}`,exact:true}).waitFor();};
try{for(const width of [390,1440])for(const [theme,palette] of Object.entries({light:initialPalette,dark:defaultDarkPalette})){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await page.goto(`${base}/?${paletteQuery(palette)}`);await page.locator('[data-app-ready]').waitFor();await open(page);await save(page,'Recover me');const before=await stored(page);
 await remove(page,'Recover me');await expect.poll(()=>stored(page)).toEqual([]);const removedUI=await checkPage(page,policy);assert.deepEqual(removedUI.findings,[]);
 await page.getByRole('button',{name:'Close palettes',exact:true}).click();await page.mouse.move(0,0);const toastUI=await checkPage(page,policy);assert.deepEqual(toastUI.findings,[]);await page.getByRole('button',{name:'Undo palette removal',exact:true}).click();await expect.poll(()=>stored(page)).toEqual(before);await page.reload();await page.locator('[data-app-ready]').waitFor();await open(page);await page.getByRole('tab',{name:'Saved',exact:true}).click();await remove(page,'Recover me');await expect.poll(()=>stored(page)).toEqual([]);
 await page.getByRole('button',{name:'Close palettes',exact:true}).click();await page.getByRole('button',{name:'Shuffle palette',exact:true}).click();await open(page);await save(page,'Keep me too');await page.getByRole('button',{name:'Undo palette removal',exact:true}).click();await expect.poll(async()=> (await stored(page)).length).toBe(2);const restored=await stored(page);assert.deepEqual(restored.find(item=>item.id===before[0].id),before[0]);assert(restored.some(item=>item.name==='Keep me too'));
 await remove(page,'Recover me');await expect.poll(async()=> (await stored(page)).length).toBe(1);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='hue-palettes-v1')throw new DOMException('Test quota','QuotaExceededError');return original.call(this,key,value);};window.addEventListener('test-restore-storage',()=>{Storage.prototype.setItem=original;},{once:true});});
 await page.getByRole('button',{name:'Undo palette removal',exact:true}).click();await page.getByRole('status').filter({hasText:'Your browser could not save this palette.'}).waitFor();await page.mouse.move(0,0);const errorUI=await checkPage(page,policy);assert.deepEqual(errorUI.findings,[]);assert.equal((await stored(page)).length,1);await page.evaluate(()=>window.dispatchEvent(new Event('test-restore-storage')));await page.getByRole('button',{name:'Undo palette removal',exact:true}).click();await expect.poll(async()=> (await stored(page)).length).toBe(2);
 await page.mouse.move(0,0);const restoredUI=await checkPage(page,policy);assert.deepEqual(restoredUI.findings,[]);reports.push({width,theme,removedUI,restoredUI,toastUI,errorUI,toastUndo:true,mergedRestore:true,quotaRetry:true});await page.screenshot({path:`${out}/${width}-${theme}.png`});await page.close();
}
 const page=await browser.newPage({viewport:{width:390,height:900}});const item={id:'shared-recovery',name:'Shared recovery',colors:initialPalette};const state=encodeState({v:1,views:{shared:{palettes:[item]}}});await page.goto(`${base}/?${paletteQuery(initialPalette)}&state=${state}`);await page.locator('[data-app-ready]').waitFor();await open(page);await page.getByRole('tab',{name:'Saved',exact:true}).click();await page.getByRole('button',{name:'Apply Shared recovery',exact:true}).waitFor();await remove(page,'Shared recovery');await page.getByRole('button',{name:'Undo palette removal',exact:true}).click();await page.getByRole('button',{name:'Apply Shared recovery',exact:true}).waitFor();assert.deepEqual(await stored(page),[]);reports.push({shared:true,localStorageUntouched:true});await page.close();
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));}console.log('Passed deletion, toast undo, persisted recovery, merged changes, write failure retry, and shared palette recovery.');
