import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,type Page,type BrowserContext} from 'playwright';
import {checkPage} from 'lintapple';
import {clickToolbarAction} from './lib/studio-toolbar.mts';

const base=process.env.APP_URL||'http://127.0.0.1:3100',directory='artifacts/shareability';
await mkdir(directory,{recursive:true});
const policy=JSON.parse(await readFile('ui-policy.json','utf8'));
const browser=await chromium.launch(),reports=[],actions=[],errors=[],snapshots=new Set<string>();
const own=[{id:'recipient',name:'Recipient colors',colors:{text:'#111111',background:'#ffffff',primary:'#ff0000',secondary:'#00ff00',accent:'#0000ff'}}];
const palette=(dark:boolean)=>dark?'ededed-171717-e98878-333333-a8655f':'171717-ffffff-e98878-ffe291-a8655f';
let complete=false;
const audit=async(page:Page,state:string,width:number,theme:string)=>{
 await page.mouse.move(1,1);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
 reports.push({state,width,theme,report:await checkPage(page,policy)});
 await page.screenshot({path:`${directory}/${width}-${theme}-${state}.png`});
};
const ready=async(page:Page)=>{page.setDefaultTimeout(20000);await page.locator('[data-app-ready]').waitFor();};
const share=async(page:Page)=>{
 await page.evaluate(()=>navigator.clipboard.writeText(''));
 const button=page.getByRole('button',{name:'Share view',exact:true});
 if(await button.isVisible())await button.click();else await clickToolbarAction(page,'Share palette');
 let href='';
 for(let attempt=0;attempt<150;attempt++){href=await page.evaluate(()=>navigator.clipboard.readText());if(/^https?:/.test(href))break;await new Promise(resolve=>setTimeout(resolve,100));}
 assert.match(href,/^https?:/, 'Share must copy a completed link');const id=/\/s\/([a-f0-9]{32})/.exec(new URL(href).pathname)?.[1];if(id)snapshots.add(id);return href;
};
const fresh=async(href:string,width:number,theme:string):Promise<[BrowserContext,Page]>=>{
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme as 'light'|'dark',reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
 await context.addInitScript(items=>{if(localStorage.getItem('hue-palettes-v1')===null)localStorage.setItem('hue-palettes-v1',JSON.stringify(items));},own);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(href);await ready(page);return[context,page];
};
try{
 for(const width of[390,1440])for(const theme of['light','dark']){
  const [context,page]=await fresh(`${base}/?colors=${palette(theme==='dark')}`,width,theme);
  await page.getByRole('button',{name:'Dashboards',exact:true}).click();const home=page.url();assert.equal(await page.locator('.home-preview-card').count(),2);await page.reload();await ready(page);assert.equal(await page.locator('.home-preview-card').count(),2,'Reload must keep the Dashboard category');
  const [hc,hp]=await fresh(home,width,theme);assert.equal(await hp.locator('.home-preview-card').count(),2);await audit(hp,'home-category',width,theme);await hc.close();
  await page.locator('.home-preview-link').first().click();await page.waitForURL(url=>url.pathname.startsWith('/dashboards/'));await ready(page);await page.goBack();await ready(page);assert.equal(await page.locator('.home-preview-card').count(),2,'Back must restore the category');
  await page.goto(`${base}/editor?colors=${palette(theme==='dark')}`);await ready(page);
  await page.getByRole('button',{name:'Primary color',exact:true}).click();const hex=page.getByRole('textbox',{name:'Hex',exact:true});await hex.fill('123456');await hex.press('Enter');await page.waitForFunction(()=>new URL(location.href).searchParams.get('colors')?.includes('123456'));
  const picker=page.url();const [pc,pp]=await fresh(picker,width,theme);await pp.getByRole('dialog',{name:'Primary color',exact:true}).waitFor();assert.equal((await pp.getByRole('textbox',{name:'Hex',exact:true}).inputValue()).toLowerCase(),'123456');await audit(pp,'picker-restored',width,theme);await pc.close();
  await page.getByRole('button',{name:'Lock primary',exact:true}).click();await page.getByRole('button',{name:'Close color picker',exact:true}).click();
  const colors=new URL(page.url()).searchParams.get('colors');await page.reload();await ready(page);await page.getByRole('button',{name:'Primary color',exact:true}).click();await page.getByRole('button',{name:'Unlock primary',exact:true}).waitFor();await page.getByRole('button',{name:'Close color picker',exact:true}).click();
  await clickToolbarAction(page,'Undo palette');assert.notEqual(new URL(page.url()).searchParams.get('colors'),colors);await clickToolbarAction(page,'Redo palette');assert.equal(new URL(page.url()).searchParams.get('colors'),colors);
  await clickToolbarAction(page,'Palettes');await page.getByRole('button',{name:'Browse all palettes',exact:true}).click();await page.getByRole('searchbox',{name:'Search palettes',exact:true}).fill('Sanzo');await page.getByLabel('Theme',{exact:true}).selectOption(theme);await page.getByRole('button',{name:'Load more',exact:true}).click();
  const browse=await share(page);const [bc,bp]=await fresh(browse,width,theme);await bp.locator('.palette-panel').waitFor();assert.equal(new URL(bp.url()).searchParams.get('colors'),new URL(page.url()).searchParams.get('colors'),'The shared palette must match the address');assert(new URL(bp.url()).searchParams.get('colors')?.includes('123456'),'The recipient must see the committed Primary color');assert.equal(await bp.getByRole('searchbox',{name:'Search palettes',exact:true}).inputValue(),'Sanzo');assert.equal(await bp.getByLabel('Theme',{exact:true}).inputValue(),theme);assert.equal(await bp.locator('.palette-card').count(),48);await audit(bp,'palette-browser-restored',width,theme);assert.deepEqual(await bp.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1'))),own);await bc.close();
  await page.getByRole('button',{name:'Close palettes',exact:true}).click();await clickToolbarAction(page,'Export palette');await page.getByLabel('Format',{exact:true}).selectOption('json');const exportLink=await share(page);const[ec,ep]=await fresh(exportLink,width,theme);await ep.getByRole('dialog',{name:'Export',exact:true}).waitFor();assert.equal(await ep.getByLabel('Format',{exact:true}).inputValue(),'json');await audit(ep,'export-restored',width,theme);await ec.close();
  await page.goto(`${base}/dashboards/infra-dashboard?colors=${palette(theme==='dark')}&view=grid&preview=acme-web`);await ready(page);const frame=page.locator('iframe').contentFrame();await frame.locator('.vc-project-list.grid').waitFor();
  const shared=await share(page);const[ic,ip]=await fresh(shared,width,theme);await ip.locator('iframe').contentFrame().locator('.vc-project-list.grid').waitFor();await ip.locator('iframe').contentFrame().getByRole('dialog').waitFor();assert.equal(new URL(ip.url()).searchParams.get('view'),'grid');assert.equal(new URL(ip.url()).searchParams.get('preview'),'acme-web');await audit(ip,'dashboard-restored',width,theme);await ic.close();
  actions.push({width,theme,cases:['category','back','color address','open picker','lock','undo redo','palette filters and batch','export','dashboard grid and project']});await context.close();console.log('Passed',width,theme);
 }
 // A large shared collection must be a copy. It must not replace recipient storage.
 const [context,page]=await fresh(`${base}/editor`,1440,'dark');
 const collection=Array.from({length:3000},(_,i)=>({...own[0],id:`team-${i}`,name:`Team ${i+1}`}));
 await page.evaluate(items=>localStorage.setItem('hue-palettes-v1',JSON.stringify(items)),collection);await page.reload();await ready(page);await clickToolbarAction(page,'Palettes');await page.getByRole('tab',{name:'Saved',exact:true}).click();
 const link=await share(page);assert.match(new URL(link).pathname,/^\/s\//);const[recipient,rp]=await fresh(link,390,'dark');await rp.locator('.palette-panel').waitFor();await rp.getByRole('button',{name:'Apply Team 1',exact:true}).waitFor();assert.deepEqual(await rp.evaluate(()=>JSON.parse(localStorage.getItem('hue-palettes-v1'))),own);await audit(rp,'shared-collection',390,'dark');await recipient.close();await context.close();
 // Workspace data and an open editor must restore without repeating a submission.
 const[wc,wp]=await fresh(`${base}/dashboards/ai-chatbot/scheduled`,1440,'dark');const wf=wp.locator('iframe').contentFrame();await wf.getByRole('button',{name:'New task',exact:true}).click();await wf.getByLabel('Title',{exact:true}).fill('Shared test task');await wf.getByLabel('Prompt',{exact:true}).fill('Review the sample plan');await wf.getByLabel('Schedule',{exact:true}).fill('Every Monday');await wf.getByRole('button',{name:'Save',exact:true}).click();await wf.getByRole('button',{name:/Shared test task/}).click();await wf.getByLabel('Title',{exact:true}).fill('Unsaved shared draft');const workspace=await share(wp);const[rc,r]=await fresh(workspace,390,'dark');const rf=r.locator('iframe').contentFrame();await rf.getByLabel('Title',{exact:true}).waitFor();assert.equal(await rf.getByLabel('Title',{exact:true}).inputValue(),'Unsaved shared draft');await audit(r,'workspace-draft-restored',390,'dark');await rc.close();await wc.close();
 assert.deepEqual(errors,[]);complete=true;
}finally{await browser.close();await writeFile(`${directory}/sharing-report.json`,JSON.stringify({complete,actions,errors,snapshots:[...snapshots],reports},null,2));}
const findings=reports.reduce((sum,item)=>sum+item.report.findings.length,0);console.log(`${actions.length} screen/theme flows; ${reports.length} UI states; ${findings} findings.`);if(findings)process.exitCode=1;
