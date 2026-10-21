import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import uiPolicy from '../ui-policy.json' with {type:'json'};
import {expectUI} from 'lintapple/playwright';
import {contrast,defaultDarkPalette,paletteQuery} from '../src/lib/palette.ts';
import {sitePreviews} from '../src/lib/previews.ts';
import {measure} from './lib/measure-text-contrast.mts';
const output='artifacts/avenlo-cta';await mkdir(output,{recursive:true});
const browser=await chromium.launch(),reports=[],errors=[],actions=[];
let completed=false;
async function audit(page,frame,state,width,theme){
 await page.mouse.move(1,1);
 await frame.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity));
 let outer={findings:[]};try{await expectUI(page,{attach:async(_,data)=>outer=JSON.parse(String(data.body))});}catch(error){if(!outer.findings.length)throw error;}
 reports.push({width,theme,state,scope:'editor',report:outer});
 const report=await checkPage(frame,uiPolicy);
 const sectionFindings=state==='call to action'?await frame.evaluate(findings=>findings.filter(f=>document.querySelector(f.selector)?.closest('.plan-cta')),report.findings):report.findings;
 reports.push({width,theme,state,scope:'page',report,sectionFindings});
}
try{
 for(const width of [1440,390])for(const [theme,palette] of [['light',sitePreviews.avenlo.colors],['dark',defaultDarkPalette]] as const){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:3000/avenlo?${paletteQuery(palette)}`);
  let frame=page.frames().find(f=>f.parentFrame());
  await frame.waitForFunction(p=>document.documentElement.dataset.copyReady==='true'&&document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===['text','background','primary','secondary','accent'].map(role=>p[role]).join('|'),palette);
  const section=frame.getByRole('region',{name:'Put your next idea into action.',exact:true});await section.scrollIntoViewIfNeeded();
  assert.equal(await section.locator('form,input,img').count(),0);
  const box=await section.boundingBox();assert.ok(box.height<340);assert.ok(box.width<=width+1);
  const link=section.getByRole('link',{name:'Build a plan',exact:true});assert.equal(new URL(await link.getAttribute('href')).pathname,'/avenlo/demo');
  const pairs=(await measure(frame)).filter(item=>['Put your next idea into action.','Choose a goal and build a plan with your team.','Build a plan'].includes(item.label));
  assert.equal(pairs.length,3);for(const pair of pairs)assert.ok(contrast(pair.foreground,pair.background)>=4.5,JSON.stringify(pair));
  await audit(page,frame,'call to action',width,theme);
  await page.screenshot({path:`${output}/after-${width}-${theme}.png`});
  await link.click();await page.waitForURL(url=>url.pathname==='/avenlo/demo');
  frame=page.frames().find(f=>f.parentFrame());await frame.locator('[data-app-ready]').waitFor();
  await frame.getByRole('textbox').fill('Plan the next team workshop');await frame.getByRole('button',{name:'Create a plan',exact:true}).click();await frame.getByRole('status').waitFor();
  await audit(page,frame,'completed plan',width,theme);actions.push({width,theme,height:box.height,contrast:pairs.map(pair=>({...pair,ratio:contrast(pair.foreground,pair.background)})),destination:new URL(page.url()).pathname});await page.close();
 }
 assert.deepEqual(errors,[]);completed=true;
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({completed,errors,actions,reports},null,2));}
const findings=reports.flatMap(r=>r.report.findings),sectionFindings=reports.flatMap(r=>r.sectionFindings||[]);
console.log(`${actions.length} complete flows, ${reports.length} UI checks, ${findings.length} full-page findings; ${sectionFindings.length} findings in the changed section and plan tool.`);if(findings.length)process.exitCode=1;
