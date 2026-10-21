import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewCatalog,previewHref} from './preview-catalog.ts';
import {defaultDarkPalette,readPalette} from './palette.ts';
test('preview links retain palette and fonts without source page parameters',()=>{
 for(const path of [...previewCatalog.map(site=>site.path),'/','/dashboards/infra-dashboard/deployments']){
  const url=new URL(previewHref(path,defaultDarkPalette,'Arial','Verdana'),'http://localhost');
  assert.equal(url.pathname,path);assert.deepEqual(readPalette(url.search),defaultDarkPalette);
  assert.equal(url.searchParams.get('heading'),'Arial');assert.equal(url.searchParams.get('body'),'Verdana');assert.equal(url.searchParams.has('view'),false);
 }
});
