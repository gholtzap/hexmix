import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';
import {sanzoCombinations} from '../src/lib/sanzo-wada.ts';
const output='artifacts/sanzo-neutral';await mkdir(output,{recursive:true});
const browser=await chromium.launch(),reports=[],actions=[],errors=[];let completed=false;
async function audit(page,state,width,theme,path){
 await page.mouse.move(1,1);let report={findings:[]},attached=false;
 try{await expectUI(page,{attach:async(_,data)=>{attached=true;report=JSON.parse(String(data.body));}});}catch(error){if(!attached)throw error;}
 reports.push({state,width,theme,path,report});
}
try{
 for(const width of [390,1440])for(const theme of ['light','dark'])for(const path of ['/','/editor']){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const text=theme==='light'?'#171717':'#ededed',background=theme==='light'?'#ffffff':'#171717';
  await page.goto(`http://127.0.0.1:3000${path}?colors=${text.slice(1)}-${background.slice(1)}-e98878-ffe291-a8655f`);await page.locator('[data-app-ready]').waitFor();
  await page.getByRole('button',{name:path==='/'?'Browse palettes':'Palettes',exact:true}).click();if(path!=='/')await page.getByRole('button',{name:'Browse all palettes',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Search palettes',exact:true});
  for(const number of [1,121,241,348]){
   await search.fill(`Sanzo Wada ${number}`);const button=page.getByRole('button',{name:`Apply Sanzo Wada ${number}`,exact:true});await button.click();
   const source=sanzoCombinations[number-1],expected={text,background,primary:source[0],secondary:source[1],accent:source[2]??source[1]};
   if(path==='/')assert.deepEqual(Object.fromEntries(new URLSearchParams(new URL(page.url()).search).get('colors').split('-').map((color,i)=>[['text','background','primary','secondary','accent'][i],'#'+color])),expected);
   else await page.waitForFunction(expected=>{const root=document.querySelector('iframe')?.contentDocument?.documentElement;return root&&Object.entries(expected).every(([role,color])=>root.style.getPropertyValue('--p-'+role)===color);},expected);
   assert.equal(await button.getAttribute('aria-pressed'),'true');await audit(page,`Sanzo Wada ${number}`,width,theme,path);
  }
  await page.screenshot({path:`${output}/${width}-${theme}-${path==='/'?'home':'editor'}.png`});
  await page.getByRole('button',{name:'Save palette',exact:true}).click();await page.getByRole('textbox',{name:'Palette name',exact:true}).fill('Neutral Sanzo');await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1'))[0]);assert.equal(saved.colors.background,background);assert.equal(saved.colors.text,text);
  actions.push({width,theme,path,saved:saved.colors});await page.close();
 }
 assert.deepEqual(errors,[]);completed=true;
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({completed,actions,errors,reports},null,2));}
const findings=reports.flatMap(x=>x.report.findings);console.log(`${actions.length} flows, ${reports.length} UI states, ${findings.length} findings.`);assert.equal(findings.length,0,JSON.stringify(findings,null,2));
