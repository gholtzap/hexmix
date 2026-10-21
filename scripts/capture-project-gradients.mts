import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const source='https://feralui.dev/gradients',directory='public/dashboard-previews/infrastructure/gradients';
const presets=['Iridescent cloud','Opal','Lagoon','Emerald','Solar flare','Orchid','Peach glow','Electric tide','Sunset','Mint ice','Midnight bloom','Rose gold','Opal','Sunset'];
await mkdir(directory,{recursive:true});
const browser=await chromium.launch(),records=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addLocatorHandler(page.locator('.jg-framer-nudge-veil'),async nudge=>{await nudge.getByRole('button',{name:/^Dismiss/}).last().click();});
 await page.goto(source,{waitUntil:'domcontentloaded'});
 for(const[index,preset]of presets.entries()){
  await page.getByRole('tab',{name:'Design',exact:true}).click();await page.getByRole('button',{name:preset,exact:true}).click();
  const shuffled=index>=12;if(shuffled)await page.getByRole('button',{name:'Shuffle',exact:true}).click();
  await page.getByRole('tab',{name:'Text',exact:true}).click();
  while(await page.locator('.jg-textbox-row').count()){await page.locator('.jg-textbox-row').first().click();await page.getByRole('button',{name:'Delete this text box',exact:true}).click();}
  assert.equal(await page.locator('.jg-textbox-row').count(),0);
  await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:/^Custom/}).click();
  await page.getByRole('textbox',{name:'Width in pixels',exact:true}).fill('128');await page.getByRole('textbox',{name:'Height in pixels',exact:true}).fill('128');await page.getByRole('textbox',{name:'Height in pixels',exact:true}).press('Tab');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:/^Download PNG/}).click();const download=await downloadEvent;
  const file=`gradient-${String(index+1).padStart(2,'0')}.png`;await download.saveAs(`${directory}/${file}`);const bytes=await readFile(`${directory}/${file}`);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),128);assert.equal(bytes.readUInt32BE(20),128);
  records.push({file,preset,shuffled,downloadName:download.suggestedFilename(),sha256:createHash('sha256').update(bytes).digest('hex')});
  await page.keyboard.press('Escape');console.log(file,preset,bytes.length+' bytes');
 }
 assert.equal(new Set(records.map(r=>r.sha256)).size,presets.length);
 await writeFile(`${directory}/source.json`,JSON.stringify({source,export:'PNG, 128 × 128, text boxes removed, colour labels off',records},null,2));
}finally{await browser.close();}
