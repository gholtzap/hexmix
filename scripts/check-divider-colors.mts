import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
import {initialPalette,defaultDarkPalette,quickPickPresets,paletteQuery} from '../src/lib/palette.ts';
const out='artifacts/avenlo-dividers';await mkdir(out,{recursive:true});
const bridge=await readFile('public/color-bridge.js','utf8');
const mapping=bridge.slice(bridge.indexOf('  const sourceColors ='),bridge.indexOf('  const recolorDeclarations ='));
const browser=await chromium.launch(), reports=[];
try {
 const page=await browser.newPage({reducedMotion:'reduce'});page.setDefaultTimeout(20000);
 for(const site of ['avenlo','tervix','orvian','nuvexa']) {
  const tokens=await page.evaluate(({site,mapping})=>new Function('site',mapping+'; return {gray:colorToken("#ebebeb"),white:colorToken("#ffffff"),secondary:colorToken(sourceColors.secondary),alpha:colorToken("#ebebeb80")};')(site),{site,mapping});
  assert(tokens.gray.includes('var(--p-text)')||tokens.gray.includes('var(--p-background)'),`${site} neutral divider`);
  assert(!tokens.gray.includes('--p-secondary'));assert.equal(tokens.secondary,'var(--p-secondary)');assert(tokens.alpha.includes('transparent'));
 }
 const garden=quickPickPresets.find(p=>p.id==='garden-party').colors;
 for(const width of [390,1440])for(const [name,palette] of Object.entries({'peach-light':initialPalette,'peach-dark':defaultDarkPalette,'garden-light':garden,'garden-dark':{...garden,text:garden.background,background:garden.text}})) {
  await page.setViewportSize({width,height:900});
  await page.goto(`http://127.0.0.1:3000/avenlo?${paletteQuery(palette)}`);
  const frame=page.frames().find(f=>f.parentFrame())||await page.waitForEvent('frameattached');
  await frame.waitForFunction(p=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===['text','background','primary','secondary','accent'].map(r=>p[r]).join('|'),palette);
  await frame.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  const lines=await frame.evaluate(()=>({stroke:getComputedStyle(document.documentElement).getPropertyValue('--stroke-default'),vertical:getComputedStyle(document.querySelector('.page'),'::before').backgroundColor,horizontal:getComputedStyle(document.querySelector('.footer__divider'),'::before').backgroundColor}));
  assert(!lines.stroke.includes('--p-secondary'));assert(lines.stroke.includes('8%'),JSON.stringify(lines));assert.equal(lines.vertical,lines.horizontal);
  await frame.locator('.footer').evaluate(n=>n.scrollIntoView({block:'start'}));
  const report=await checkPage(frame,policy);reports.push({width,name,lines,report});
  await page.screenshot({path:`${out}/${width}-${name}.png`});
 }
 console.log('Four source mappings and eight page states passed divider checks.');
 console.log(`${reports.reduce((sum,r)=>sum+r.report.findings.length,0)} UI findings`);
 if(reports.some(r=>r.report.findings.length))process.exitCode=1;
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));}
