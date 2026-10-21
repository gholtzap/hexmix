import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sitePreviews,siteIdForSlug,dashboardPaths} from './previews.ts';
import {previewCatalog} from './preview-catalog.ts';
test('public preview paths use the displayed names and use matching asset IDs',()=>{
 const expected={avenlo:'avenlo',tervix:'tervix',orvian:'orvian',nuvexa:'nuvexa'};
 for(const [id,slug] of Object.entries(expected)){
  assert.equal(sitePreviews[id as keyof typeof sitePreviews].slug,slug);assert.equal(siteIdForSlug(slug),id);
  assert.equal(previewCatalog.find(item=>item.id===id)?.path,'/'+slug);
 }
 assert.equal(siteIdForSlug('unknown'),undefined);assert.equal(siteIdForSlug('toString'),undefined);
 assert.equal(dashboardPaths.chatbot,'/dashboards/ai-chatbot');assert.equal(dashboardPaths.infra,'/dashboards/infra-dashboard');
});
