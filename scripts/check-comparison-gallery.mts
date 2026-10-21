import assert from 'node:assert/strict';
import {checkBug} from './lib/bug-flow.mts';
import {openSiteSwitcher} from './lib/studio-toolbar.mts';
await checkBug('HX-068','/compare?preview=workspace&a=123456-fafafa-ef1234-dddddd-555555&b=ffffff-171717-e98878-333333-a8655f&customA=1&customB=1&heading=Arial&body=Verdana',async({page,width,audit})=>{
 for(const side of ['A','B']){
  if(side==='B'){await page.goBack();await page.locator('[data-app-ready]').waitFor();}
  if(width<=760)await page.getByRole('button',{name:`Show palette ${side}`,exact:true}).filter({visible:true}).first().click();
  const frame=await(await page.locator(`iframe[title="Palette ${side} preview"]`).elementHandle()).contentFrame();await frame.locator('iframe[data-preview-ready=true]').waitFor();await openSiteSwitcher(frame);const link=frame.getByRole('menuitem',{name:'All sites',exact:true});const expected=new URL(await link.getAttribute('href'),page.url());await link.click();await page.waitForURL(url=>url.pathname==='/');await page.locator('[data-app-ready]').waitFor();await page.waitForTimeout(150);const actual=new URL(page.url());for(const key of ['colors','heading','body'])assert.equal(actual.searchParams.get(key),expected.searchParams.get(key),`${side} ${key}`);await audit(`gallery-${side}`,page.mainFrame());
 }
});
