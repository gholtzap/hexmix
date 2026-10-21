import assert from 'node:assert/strict';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import policy from '../ui-policy.json' with {type:'json'};
const roots=['src','public','avenlo/src','avenlo/public','tervix/public','orvian/src','orvian/public','nuvexa/public'];
const files=[];
for(const root of roots)for(const entry of await readdir(root,{recursive:true,withFileTypes:true})) {
 if(entry.isFile()&&/\.(?:html|css|js|jsx|ts|tsx)$/.test(entry.name))files.push(`${entry.parentPath}/${entry.name}`);
}
const broken=[];
for(const file of files)if(/content\s*:\s*["'][^"']*\uFFFD[^"']*["']/.test(await readFile(file,'utf8')))broken.push(file);
assert.deepEqual(broken,[],'Generated CSS markers must not contain replacement characters');
if(process.argv.includes('--static')){console.log(`${files.length} source files have no damaged CSS markers`);process.exit(0);}
const out='artifacts/list-markers';await mkdir(out,{recursive:true});
const catalog=JSON.parse(await readFile('avenlo/public/source-pages/catalog.json','utf8'));
const routes=['blog/note-44',Object.keys(catalog).find(route=>route.startsWith('blog/')&&route!=='blog/note-44'&&catalog[route].file!==catalog['blog/note-44'].file)];
const browser=await chromium.launch(),reports=[];
try {
 for(const route of routes)for(const width of [390,1440])for(const [theme,colors]of Object.entries({dark:'fafbf9-2e3419-bfce88-ccefbe-7a8b3c',light:'2e3419-fafbf9-bfce88-ccefbe-7a8b3c'})) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
  await page.goto(`http://127.0.0.1:3000/avenlo/${route}?colors=${colors}&heading=System&body=System`);
  const frame=page.frameLocator('iframe');await frame.locator('html[data-copy-ready=true]').waitFor();
  const source=page.frames().find(f=>f.parentFrame());await source.waitForFunction(colors=>document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===colors.split('-').map(c=>'#'+c).join('|'),colors);
  const lists=frame.locator('article ul > li');assert(await lists.count()>0,route+' must have bullet points');await lists.first().scrollIntoViewIfNeeded();
  const markers=await lists.evaluateAll(ns=>ns.map(n=>getComputedStyle(n,'::before').content));assert(markers.every(s=>s==='"•"'),JSON.stringify(markers));
  const report=await checkPage(source,policy);reports.push({route,width,theme,markers,report});await page.screenshot({path:`${out}/${route.replaceAll('/','-')}-${width}-${theme}.png`});await page.close();
 }
 console.log(`${files.length} files scanned; ${reports.length} page states passed marker checks.`);console.log(`${reports.reduce((n,r)=>n+r.report.findings.length,0)} UI findings`);if(reports.some(r=>r.report.findings.length))process.exitCode=1;
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));}
