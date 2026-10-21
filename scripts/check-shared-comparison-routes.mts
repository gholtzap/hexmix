import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {expect} from 'playwright/test';
import {checkBug,openChatSidebar,openInfraPage} from './lib/bug-flow.mts';
import {clickToolbarAction} from './lib/studio-toolbar.mts';
const snapshots=new Set<string>();
try{
 await checkBug('HX-059',['/compare?preview=workspace','/compare?preview=workspace&linked=0','/compare?preview=infrastructure'],async({page,context,width,theme,path,audit})=>{
  const infra=path.includes('infrastructure'),unlinked=path.includes('linked=0'),prefix=infra?'/dashboards/infra-dashboard':'/dashboards/ai-chatbot';
  const show=async(p,side)=>{if(width===390)await p.getByRole('button',{name:`Show palette ${side}`,exact:true}).filter({visible:true}).first().click();};
  const outer=async(p,side)=>{const f=await(await p.locator(`iframe[title="Palette ${side} preview"]`).elementHandle()).contentFrame();await f.locator('iframe[data-preview-ready=true]').waitFor({state:'attached'});return f;};
  const inner=async(f)=>{const child=await(await f.locator('iframe').elementHandle()).contentFrame();await child.locator('html[data-app-ready=true]').waitFor({state:'attached'});return child;};
  await show(page,'A');const a=await outer(page,'A');let child=await inner(a);
  if(infra)await openInfraPage(child,'Logs');else{await openChatSidebar(child);await child.getByRole('button',{name:/^Space/}).first().click();}
  await expect.poll(()=>new URL(a.url()).pathname).toBe(`${prefix}/${infra?'logs':'space'}`);await a.locator('iframe[data-preview-ready=true]').waitFor();child=await inner(a);
  if(!infra){await child.locator('[data-space-create]').filter({visible:true}).last().click();await child.getByRole('menuitem',{name:'Page',exact:true}).click();await child.getByLabel('Name',{exact:true}).fill('Shared comparison note');await child.getByRole('button',{name:'Save',exact:true}).click();await child.getByRole('button',{name:'Shared comparison note',exact:true}).waitFor();}
  if(unlinked){await show(page,'B');const b=await outer(page,'B');const bc=await inner(b);await openChatSidebar(bc);await bc.getByRole('button',{name:/^Scheduled/}).first().click();await expect.poll(()=>new URL(b.url()).pathname).toBe(`${prefix}/scheduled`);}
  await show(page,'A');await context.grantPermissions(['clipboard-read','clipboard-write']);await page.evaluate(()=>navigator.clipboard.writeText(''));await clickToolbarAction(a,'Share palette');
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText()),{timeout:20000}).toMatch(/^http/);const link=await page.evaluate(()=>navigator.clipboard.readText());const id=/\/s\/([a-f0-9]{32})/.exec(new URL(link).pathname)?.[1];if(id)snapshots.add(id);
  const recipient=await context.browser().newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});const fresh=await recipient.newPage();const errors=[];fresh.on('pageerror',e=>errors.push(e.message));
  try{await fresh.goto(link);await fresh.locator('[data-app-ready]').waitFor();for(const side of ['A','B']){await show(fresh,side);const f=await outer(fresh,side);const end=infra?'logs':side==='B'&&unlinked?'scheduled':'space';await expect.poll(()=>new URL(f.url()).pathname,{timeout:20000}).toBe(`${prefix}/${end}`);await f.locator('iframe[data-preview-ready=true]').waitFor({state:'attached'});const content=await inner(f);await content.getByRole('heading',{name:infra?'Logs':end==='scheduled'?'Schedule a task':'All',exact:true}).waitFor();if(!infra&&!(side==='B'&&unlinked))await content.getByRole('button',{name:'Shared comparison note',exact:true}).waitFor();await audit(`restored-${side}`,null,fresh);}assert.deepEqual(errors,[]);
  }finally{await recipient.close();}
 });
}finally{for(const id of snapshots)await rm(`.local/shares/${id}.json`,{force:true});}
