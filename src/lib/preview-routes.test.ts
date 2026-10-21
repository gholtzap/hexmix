import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sitePreviews,siteIdForSlug,dashboardPaths,legacyPreviewRoutes} from './previews.ts';
import {previewCatalog} from './preview-catalog.ts';
test('public preview paths use the displayed names and use matching asset IDs',()=>{
 const expected={avenlo:'avenlo',tervix:'tervix',orvian:'orvian',nuvexa:'nuvexa'};
 for(const [id,slug] of Object.entries(expected)){
  assert.equal(sitePreviews[id as keyof typeof sitePreviews].slug,slug);assert.equal(siteIdForSlug(slug),id);
  assert.equal(previewCatalog.find(item=>item.id===id)?.path,'/'+slug);
 }
 assert.equal(siteIdForSlug('unknown'),undefined);assert.equal(siteIdForSlug('toString'),undefined);
 assert.equal(dashboardPaths.chatbot,'/dashboards/ai-chatbot');assert.equal(dashboardPaths.infra,'/dashboards/infra-dashboard');
 assert.equal(new Set(legacyPreviewRoutes.map(route=>route.source)).size,0);
 for(const {source,destination} of legacyPreviewRoutes){assert.notEqual(source,destination);assert.ok(previewCatalog.some(item=>item.path===destination));}
});
