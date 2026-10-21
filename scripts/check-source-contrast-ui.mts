import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import uiPolicy from '../ui-policy.json' with {type:'json'};
import {writeFile,mkdir} from 'node:fs/promises';
import {previewCatalog} from '../src/lib/preview-catalog.ts';
const directory='artifacts/all-surface-contrast';await mkdir(directory,{recursive:true});
const browser=await chromium.launch();const reports=[];
try {
 for(const width of [390,1440])for(const [theme,colors] of [['light','ffffff-ffffff-e98878-ffe291-a8655f'],['dark','000000-0c0a09-e98878-ffe291-a8655f']] as const){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  for(const preview of previewCatalog){
   await page.goto(`http://127.0.0.1:3000${preview.path}?colors=${colors}`,{waitUntil:'domcontentloaded'});
   await page.frameLocator('iframe').locator('html[data-contrast-ready=true]').waitFor();
   const source=page.frames().find(frame=>frame.parentFrame());
   await source.waitForFunction(colors=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===colors.split('-').map(color=>'#'+color).join('|'),colors);
   await source.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>animation.effect.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));});
   reports.push({path:preview.path,width,theme,...await checkPage(source,uiPolicy)});
  }
  await page.close();
 }
}finally{await browser.close();await writeFile(`${directory}/source-ui.json`,JSON.stringify(reports,null,2));}
const rules={};for(const report of reports)for(const finding of report.findings)rules[finding.rule]=(rules[finding.rule]||0)+1;
console.log(JSON.stringify({states:reports.length,rules}));process.exitCode=reports.some(report=>report.findings.length)?1:0;
