import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,appendFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import {sitePreviews} from '../src/lib/previews.ts';
import {previewCatalog,previewHref} from '../src/lib/preview-catalog.ts';
import {defaultDarkPalette,initialPalette,roles} from '../src/lib/palette.ts';
import destinations from '../src/lib/site-destinations.json' with {type:'json'};

const requested=process.argv.slice(2);
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
for(const base of ['',...Object.keys(sitePreviews).map(site=>site+'/')]){
 for(const folder of ['docs/research','docs/design-references'])await assert.rejects(access(base+folder),{code:'ENOENT'});
}
for(const site of ['tervix','nuvexa']){
 const assets=JSON.parse(await readFile(`${site}/assets.json`,'utf8'));
 assert(assets.every(asset=>!Object.hasOwn(asset,'url')),'Asset manifests must contain local requests only');
}
const output='artifacts/identity-removal'+(requested.length?'/final':'');await mkdir(output,{recursive:true});
const identity=[],failures=[],raw=[],rendered=[],rules={};let staticFiles=0,uiStates=0;
const brands=new Set(Object.values(sitePreviews).map(site=>site.name));
const localHosts=new Set(['127.0.0.1','localhost']);
const check=(where,text)=>{
 for(const match of text.matchAll(/data-editor-brand=["']([^"']+)["']/g))if(!brands.has(match[1]))identity.push({where,reason:'Unknown preview brand'});
 for(const tag of text.matchAll(/<(?:meta|link)\b[^>]*>/gi)){
  if(!/(?:rel=["']canonical|(?:property|name)=["'](?:og:url|twitter:url)["'])/i.test(tag[0]))continue;
  const value=/(?:href|content)=["']([^"']+)["']/i.exec(tag[0])?.[1];
  if(value){try{if(!localHosts.has(new URL(value,'http://127.0.0.1').hostname))identity.push({where,reason:'External page identity URL'});}catch{identity.push({where,reason:'Invalid page identity URL'});}}
 }
};
check('metadata contract','<meta property="og:url" content="https://external.invalid/">');
assert.equal(identity.length,1,'External identity URLs must fail');identity.length=0;
check('metadata contract','<meta property="og:url" content="http://127.0.0.1:3000/avenlo">');
assert.equal(identity.length,0,'Local identity URLs must pass');
const walk=async dir=>{let files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(file));else files.push(file);}return files;};
for(const dir of ['public','avenlo/public','orvian/public','tervix/public','nuvexa/public','.next/static','avenlo/.next/static','orvian/.next/static']){
 for(const file of await walk(dir))if(/\.(?:js|mjs|html|css|svg|json|txt)$/.test(file)&&!/LICENSE|OFL/.test(file)){
  const text=await readFile(file,'utf8');
  if(!file.split(path.sep).includes('.next'))assert(!/sourceMappingURL\s*=/.test(text),'Local preview assets must not expose debug source maps');
  staticFiles++;check(file,text);
 }
}
assert.deepEqual(identity,[],'Static files contain original identity');
const routes=new Map();
const add=(site,suffix='')=>{suffix=suffix.replace(/^\//,'');routes.set(`/${site}${suffix?'/'+suffix:''}`,{site,suffix});};
for(const site of Object.keys(sitePreviews)){add(site);for(const suffix of Object.keys(destinations[site]))add(site,suffix);}
const catalog=JSON.parse(await readFile('avenlo/public/source-pages/catalog.json','utf8'));for(const suffix of Object.keys(catalog))add('avenlo',suffix);
for(const file of await walk('tervix/public/subpages'))if(file.endsWith('.html'))add('tervix',path.relative('tervix/public/subpages',file).slice(0,-5));
for(const suffix of ['demo','login','register','contact','status','developers','about','documentation/quickstart/workflows','documentation/workflows/cli','documentation/workflows/sdk','documentation/workflows/mcp'])add('tervix',suffix);
for(const file of await walk('nuvexa/public/pages'))if(file.endsWith('.html'))add('nuvexa',path.relative('nuvexa/public/pages',file).slice(0,-5));
const queue=[...routes.entries()];const representative=new Map();let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<queue.length){const [route,{site,suffix}]=queue[cursor++];const source=new URL(suffix,sitePreviews[site].url).href;
 try{const response=await fetch(source,{signal:AbortSignal.timeout(20000)});const text=await response.text();if(response.status!==200){failures.push({route,source,status:response.status});continue;}check(source,text);
 const hash=createHash('sha256').update(text).digest('hex');raw.push({route,source,hash,status:response.status});const key=site+'|'+hash;if(!representative.has(key))representative.set(key,{route,site});
 }catch(error){failures.push({route,source,error:error.message});}
}}));
await writeFile(`${output}/raw-routes.json`,JSON.stringify({staticFiles,raw,identity,failures,representative:[...representative.values()]},null,2));
assert.deepEqual(failures,[],'Source routes did not load');assert.deepEqual(identity,[],'Source HTML contains original identity');
const browser=await chromium.launch();let completed=false;
await writeFile(`${output}/ui.jsonl`,'');
try{
 const jobs=[...representative.values(),{route:'/',site:null},{route:'/editor',site:null},...previewCatalog.filter(p=>p.category==='Dashboards').map(p=>({route:p.path,site:null}))];let next=0;
 await Promise.all(Array.from({length:3},async()=>{
  const page=await browser.newPage({reducedMotion:'reduce'});page.setDefaultTimeout(15000);
  while(next<jobs.length){const job=jobs[next++];if(requested.length&&!requested.includes(job.route))continue;
   for(const width of [390,1440])for(const [theme,palette]of [['dark',defaultDarkPalette],['light',initialPalette]] as const){
    const state={route:job.route,width,theme};
    try{
     await page.setViewportSize({width,height:width===390?844:900});await page.goto('http://127.0.0.1:3000'+previewHref(job.route,palette,'System','System'),{waitUntil:'domcontentloaded'});
     await page.locator('[data-app-ready]').waitFor();
     const surface=job.route==='/'?page:page.frames().find(frame=>frame.parentFrame());
     if(!surface)throw Error('Preview frame is missing');
     if(surface!==page){await surface.waitForFunction(({expected,editor})=>editor ? document.documentElement.style.getPropertyValue('--p-background')===expected[1] : document.documentElement.dataset.contrastReady==='true'&&document.documentElement.dataset.contrastPalette===expected.join('|'),{expected:roles.map(role=>palette[role]),editor:job.route==='/editor'});await surface.evaluate(()=>document.fonts.ready);}
     await surface.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
     check(job.route+' rendered HTML',await surface.content());check(job.route+' host HTML',await page.content());
     const report=await checkPage(surface,policy);for(const finding of report.findings)rules[finding.rule]=(rules[finding.rule]||0)+1;
     await appendFile(`${output}/ui.jsonl`,JSON.stringify({...state,...report})+'\n');uiStates++;rendered.push(state);
     if(job.route==='/'||Object.values(sitePreviews).some(site=>job.route==='/'+site.slug))await page.screenshot({path:`${output}/${job.site||'home'}-${width}-${theme}.png`});
    }catch(error){failures.push({...state,error:error.message});}
   }
   await writeFile(`${output}/progress.json`,JSON.stringify({completedJobs:next,totalJobs:jobs.length,uiStates,identity:identity.length,failures}));
  }
  await page.close();
 }));
 completed=true;
}finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({completed,staticFiles,rawRoutes:raw.length,uniquePages:representative.size,uiStates,rules,identity,failures,rendered},null,2));}
assert.deepEqual(identity,[],'Rendered pages contain original identity');assert.deepEqual(failures,[],'Some pages could not be checked');
console.log(JSON.stringify({staticFiles,rawRoutes:raw.length,uniquePages:representative.size,uiStates,identity:identity.length,failures:failures.length,rules}));
process.exitCode=Object.keys(rules).length?1:0;
