import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {contrast} from '../src/lib/palette.ts';
import {measure} from './lib/measure-text-contrast.mts';
const directory='artifacts/all-surface-contrast';await mkdir(directory,{recursive:true});
const browser=await chromium.launch();const reports=[];
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:3000/editor?colors=000000-0c0a09-e98878-ffe291-a8655f');
  const frame=page.frameLocator('iframe');await frame.locator('html[data-contrast-ready="true"]').waitFor();
  const source=page.frames().find(frame=>frame.parentFrame());
  const settle=async()=>source.waitForFunction(()=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===['text','background','primary','secondary','accent'].map(role=>document.documentElement.style.getPropertyValue(`--p-${role}`)).join('|'));
  const check=async state=>{await settle();const text=await measure(source);const failures=text.filter(item=>contrast(item.foreground,item.background)<4.5);reports.push({width,state,text,failures});assert.deepEqual(failures,[]);};
  await source.evaluate(()=>{
   const panel=document.createElement('section');panel.innerHTML='<p id="fixed-inline" style="color:#080808;background:var(--p-background)">Fixed inline text</p><p style="color:white;background:white">White card</p><p style="color:black;background:black">Black card</p><div style="opacity:.63;background:linear-gradient(red,blue)"><p style="color:white">Faded text over artwork</p></div><div style="opacity:.2"><p style="color:white;background:black">Text in a faded panel</p></div><div style="background:linear-gradient(red,blue)"><p>Text over artwork</p></div><input aria-label="Sample input" placeholder="Sample input" style="color:white;background:white"><div style="position:relative;height:80px"><div data-editor-media-container style="position:absolute;inset:0;background:linear-gradient(red,blue)"></div><p id="overlap" style="position:relative">Text above a separate artwork layer</p></div><div data-preview-readable-artwork style="background-color:#171717;background-image:linear-gradient(#171717,#252525)"><p id="readable-artwork" style="color:white">Readable text over dark artwork</p></div><svg width="120" height="40"><text x="0" y="20" fill="black">Chart label</text></svg><svg width="120" height="40"><rect x="0" y="0" width="120" height="40" fill="var(--p-primary)"/><text x="60" y="25" text-anchor="middle" fill="var(--p-background)">Chip label</text></svg>';document.querySelector('main').append(panel);
  });
  await check('dark palette and inserted surfaces');
  assert.equal(reports.at(-1).text.find(item=>item.label==='Chip label')?.background,'#e98878');
  assert.equal(await frame.locator('#overlap').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(12, 10, 9)');
  assert.equal(await frame.locator('#readable-artwork').getAttribute('data-preview-text-surface'),null);
  for(const [role,value] of [['Text','ffffff'],['Background','ffffff'],['Text','203247']] as const) {
   await page.getByRole('button',{name:`${role} color`,exact:true}).click();
   await page.getByRole('textbox',{name:'Hex',exact:true}).fill(value);
   await page.getByRole('textbox',{name:'Hex',exact:true}).press('Enter');
   await page.getByRole('button',{name:'Close color picker',exact:true}).click();
   await check(`${role} changed to ${value}`);
   assert.equal(await frame.locator('html').evaluate((node,role)=>node.style.getPropertyValue(`--p-${role.toLowerCase()}`),role),`#${value}`);
  }
  assert.equal(await frame.locator('#fixed-inline').evaluate(node=>node.style.color),'rgb(8, 8, 8)');
  assert.equal(await frame.locator('#fixed-inline').evaluate(node=>node.style.getPropertyPriority('color')),'');
  assert.equal(await frame.locator('h1').evaluate(node=>getComputedStyle(node).color),'rgb(32, 50, 71)');
  await page.screenshot({path:`${directory}/guard-${width}.png`});await page.close();
 }
}finally{await browser.close();await writeFile(`${directory}/guard.json`,JSON.stringify(reports,null,2));}
console.log(`Passed ${reports.length} palette and dynamic content states.`);
