import assert from 'node:assert/strict';
import {access,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import destinations from '../src/lib/site-destinations.json' with {type:'json'};
import {sitePreviews} from '../src/lib/previews.ts';

const results=[];
const extras={avenlo:['contact','contact-demo','agents','demo','security'],tervix:['compare/approach-1','compare/approach-2','compare/approach-3','compare/approach-4','compare/approach-5','demo','login','register','contact','status','developers','about'],orvian:Array.from({length:22},(_,index)=>`blog/${index+1}`),nuvexa:['about','careers','contact']};
for(const [site,preview] of Object.entries(sitePreviews)){
  const paths=[...Object.keys(destinations[site]).filter(path=>path!=='.').map(path=>path.replace(/^\.\//,'')),...extras[site]];
  for(const path of paths){
    const url=`http://127.0.0.1:3000/${preview.slug}/${path}`;
    const response=await fetch(url);
    assert.equal(response.status,200,url);
    const html=await response.text();
    const frame=html.match(/<iframe[^>]+src="([^"]+)"/)?.[1];
    assert.equal(frame,`${preview.url}${site==='avenlo'&&path==='contact'?'contact-demo':path}`,url);
    const child=await fetch(frame);
    assert.equal(child.status,200,frame);
    const page=await child.text();
    assert.ok(!page.includes('class="site-content"'),`${frame} still uses generic destination`);
    results.push({site,path,frame,status:child.status});
  }
}
const manifest=JSON.parse(await readFile('avenlo/public/source-pages/route-manifest.json','utf8'));
const catalog=JSON.parse(await readFile('avenlo/public/source-pages/catalog.json','utf8'));
assert(manifest.length>200,'Avenlo route manifest is empty');
for(const route of manifest){
  if(route==='products/videocall-agent')continue;
  const file=catalog[route]?.file;
  assert(file,`Avenlo route has no source page: ${route}`);
  await access(`avenlo/public/source-pages/${file}`);
}
for(const route of manifest.filter(path=>/^(?:customers\/story-|compare\/option-|integrations\/tool-|blog\/note-|research\/idea-)/.test(path))){
  const child=await fetch(`http://127.0.0.1:3001/${route}`,{method:'HEAD'});
  assert.equal(child.status,200,route);
}
const tervixManifest=(await readdir('tervix/public/subpages',{recursive:true})).filter(file=>file.endsWith('.html')).map(file=>'/'+file.slice(0,-5));
assert(tervixManifest.length>=163,'Tervix page catalog is incomplete');
for(const route of tervixManifest){
  const child=await fetch(`http://127.0.0.1:3012${route}`,{method:'HEAD'});
  assert.equal(child.status,200,`Tervix ${route}`);
}
await mkdir('artifacts/subpages',{recursive:true});
await writeFile('artifacts/subpages/routes.json',JSON.stringify({canonical:results,avenloManifest:manifest.length,avenloSourceFiles:new Set(Object.values(catalog as Record<string,{file:string}>).map(page=>page.file)).size,tervixManifest:tervixManifest.length},null,2));
console.log(`${results.length} canonical routes, ${manifest.length} Avenlo routes, and ${tervixManifest.length} Tervix routes have source pages`);
