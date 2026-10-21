import {clickToolbarAction} from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output='artifacts/infrastructure/main-pages';
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const results=[],errors=[];
let failure;
async function check(width,name,run){try{await run();results.push({width,name,result:'passed'});console.log(`${width}: ${name}`);}catch(error){results.push({width,name,result:'failed',error:error.message});throw error;}}
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}}),page=await context.newPage();
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  const main=()=>page.locator('#vc-main-content');
  const button=(name,scope=main())=>scope.getByRole('button',{name,exact:true});
  const dialog=()=>page.getByRole('dialog');
  async function go(id,title){await page.goto(`http://127.0.0.1:3000/dashboard-previews/infrastructure?page=${id}`);await page.locator('[data-app-ready]').waitFor();await main().getByRole('heading',{name:title,exact:true}).waitFor();}
  async function filter(label,value){await main().getByRole('button',{name:new RegExp(`^${label}:`)}).click();await page.getByRole('menuitem',{name:value,exact:true}).click();}
  await check(width,'Deployments search, filters, details, redeploy, cancel, load more',async()=>{
   await go('deployments','Deployments');assert.equal(await main().locator('tbody tr').count(),12);
   await main().getByRole('searchbox').fill('no-such-deployment');await main().getByText('No deployments found',{exact:true}).waitFor();await button('Clear filters').last().click();
   await filter('Status','Building');assert.equal(await main().locator('tbody tr').count(),2);
   const row=main().locator('tbody tr').first();const id=await row.locator('code').first().innerText();
   await row.getByRole('button',{name:`Actions for ${id}`,exact:true}).click();await page.getByRole('menuitem',{name:'Cancel deployment',exact:true}).click();assert.equal(await main().locator('tbody tr').count(),1);
   await button('Clear filters').click();await main().locator('tbody tr').first().getByRole('button').first().click();await dialog().getByText('Deployment details',{exact:true}).waitFor();await dialog().getByRole('button',{name:'Build logs',exact:true}).click();await dialog().getByText('Build started in Washington, D.C.',{exact:true}).waitFor();await dialog().getByRole('button',{name:'Summary',exact:true}).click();await dialog().getByRole('button',{name:'Redeploy',exact:true}).click();await dialog().getByText('dpl_local_13',{exact:true}).waitFor();await dialog().getByRole('button',{name:'Close dialog',exact:true}).click();assert.equal(await main().locator('tbody tr').count(),13);
   await button('Load more').click();assert.equal(await main().locator('tbody tr').count(),19);
  });
  await check(width,'Logs refresh, search, filters, live, details',async()=>{
   await go('logs','Logs');const count=await main().locator('tbody tr').count();await button('Refresh').click();assert.equal(await main().locator('tbody tr').count(),count+1);await button('Live').click();assert.equal(await button('Live enabled').getAttribute('aria-pressed'),'true');
   await filter('Severity','Error');assert((await main().locator('tbody tr').count())>0);assert((await main().locator('tbody').innerText()).includes('500'));
   await main().getByRole('searchbox').fill('no-such-log');await main().getByText('No request logs found',{exact:true}).waitFor();await button('Clear filters').last().click();await main().locator('tbody tr').first().getByRole('button').first().click();await dialog().getByRole('heading',{name:'Request trace',exact:true}).waitFor();await dialog().getByRole('button',{name:'Done',exact:true}).click();
  });
  await check(width,'Monitoring tabs and period filters',async()=>{
   for(const [id,title,tab] of [['analytics','Analytics','Pageviews'],['speed-insights','Speed Insights','Mobile'],['observability','Observability','Errors'],['usage','Usage','Compute']] as const){
    await go(id,title);const before=await main().locator('.vp-metric-value').first().innerText();if(id!=='usage')await filter('Period','Last 30 days');else await filter('Cycle','Sep 1 – Sep 30');assert.notEqual(await main().locator('.vp-metric-value').first().innerText(),before);await button(tab).click();assert.equal(await button(tab).getAttribute('aria-pressed'),'true');
   }
  });
  await check(width,'Firewall rule validation, create, and pause',async()=>{
   await go('firewall','Firewall');await button('Add rule').click();await dialog().getByRole('button',{name:'Save rule',exact:true}).click();await dialog().getByRole('alert').waitFor();await dialog().getByLabel('Rule name',{exact:true}).fill('Sample bot rule');await dialog().getByRole('button',{name:'Save rule',exact:true}).click();const row=main().getByRole('row').filter({hasText:'Sample bot rule'});await row.waitFor();await row.getByRole('button',{name:'Pause 4',exact:true}).click();assert((await row.innerText()).includes('Paused'));
  });
  await check(width,'CDN cache clear and AI Gateway sample key',async()=>{
   await go('cdn','CDN');await button('Cache').click();assert((await main().locator('tbody').innerText()).includes('Miss'));await button('Purge cache').click();await dialog().getByRole('button',{name:'Purge cache',exact:true}).click();await main().getByRole('status').filter({hasText:'Sample cache cleared'}).waitFor();
   await go('ai-gateway','AI Gateway');await button('Models').click();await button('Logs').click();assert((await main().locator('tbody').innerText()).includes('req_82ac'));await button('API keys').click();await dialog().getByRole('button',{name:'Create key',exact:true}).click();await dialog().getByRole('alert').waitFor();await dialog().getByLabel('Key name',{exact:true}).fill('Local verification');await dialog().getByRole('button',{name:'Create key',exact:true}).click();await dialog().getByText('Local verification',{exact:true}).waitFor();await dialog().getByRole('button',{name:'Close dialog',exact:true}).click();
  });
  await check(width,'Environment variables create validation, reveal, edit and delete',async()=>{
   await go('environment-variables','Environment Variables');await button('Create Variable').click();await dialog().getByRole('button',{name:'Create Variable',exact:true}).click();await dialog().getByRole('alert').waitFor();await dialog().getByLabel('Name',{exact:true}).fill('bad-name');await dialog().getByLabel('Value',{exact:true}).fill('https://local.example.com');await dialog().getByRole('button',{name:'Create Variable',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'uppercase'}).waitFor();await dialog().getByLabel('Name',{exact:true}).fill('LOCAL_SAMPLE_URL');await dialog().getByRole('button',{name:'Create Variable',exact:true}).click();let row=main().getByRole('row').filter({hasText:'LOCAL_SAMPLE_URL'});await row.getByRole('button',{name:'Show',exact:true}).click();assert((await row.innerText()).includes('https://local.example.com'));
   await row.getByRole('button',{name:'Actions for LOCAL_SAMPLE_URL',exact:true}).click();await page.getByRole('menuitem',{name:'Edit',exact:true}).click();await dialog().getByLabel('Value',{exact:true}).fill('https://updated.example.com');await dialog().getByRole('button',{name:'Save changes',exact:true}).click();assert((await row.innerText()).includes('https://updated.example.com'));
   await row.getByRole('button',{name:'Actions for LOCAL_SAMPLE_URL',exact:true}).click();await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await dialog().getByRole('button',{name:'Confirm delete',exact:true}).click();assert.equal(await row.count(),0);
  });
  await check(width,'Resource create dialogs, validation, and row state actions',async()=>{
   const cases=[['domains','Domains','Connect External','Domain','sample.example.com','acme.example.com',null],['connect','Connect','Create Network','Name','sample-network','production-east','Disconnect'],['integrations','Integrations','Add Integration',null,null,'Lantern',null],['storage','Storage','Create Database','Name','sample-new-db','sample-db',null],['flags','Flags','Create Flag','Key','sample-flag','new-checkout',null],['sandboxes','Sandboxes','Create Sandbox','Name','sample-sandbox','sbx-build-check','Stop'],['workflows','Workflows','Run Workflow',null,null,'asset-sync','Retry'],['images','Images','Add Image','Image path','/sample.webp','/hero.webp','Optimize'],['daemons','Daemons','Create Daemon','Name','sample-daemon','preview-worker','Restart']];
   for(const [id,title,create,label,value,target,action] of cases){
    await go(id,title);await button(create).click();if(label){await dialog().getByRole('button',{name:create,exact:true}).click();await dialog().getByRole('alert').waitFor();await dialog().getByLabel(label,{exact:true}).fill(value);await dialog().getByRole('button',{name:create,exact:true}).click();await main().getByRole('button',{name:value,exact:true}).waitFor();}else if(id==='integrations'){await dialog().getByRole('combobox',{name:'Integration',exact:true}).selectOption('Postroom');await dialog().getByRole('button',{name:create,exact:true}).click();await main().getByRole('button',{name:'Postroom',exact:true}).waitFor();}else{await dialog().getByRole('button',{name:create,exact:true}).click();assert.equal(await main().locator('tbody tr').count(),4);}
    const row=main().getByRole('row').filter({has:page.getByRole('button',{name:target,exact:true})});
    if(id==='flags'){await row.getByRole('button',{name:'Enabled',exact:true}).click();assert((await row.innerText()).includes('Disabled'));}
    else if(action){await row.getByRole('button',{name:`Actions for ${target}`,exact:true}).click();await page.getByRole('menuitem',{name:action,exact:true}).click();await main().getByRole('status').waitFor();if(id==='images')assert((await row.innerText()).includes('AVIF'));if(id==='workflows')assert((await row.innerText()).includes('Succeeded'));if(id==='sandboxes')assert((await row.innerText()).includes('Stopped'));if(id==='connect')assert((await row.innerText()).includes('Disconnected'));if(id==='daemons')assert((await row.innerText()).includes('Just now'));}
    await row.getByRole('button',{name:target,exact:true}).click();await dialog().waitFor();await dialog().getByRole('button',{name:'Done',exact:true}).click();
   }
  });
  await check(width,'Settings validation/save and member invitation',async()=>{
   await go('settings','Settings');await main().getByLabel('Team name',{exact:true}).fill('');await button('Save changes').click();await main().getByRole('alert').waitFor();await main().getByLabel('Team name',{exact:true}).fill('Sample studio');await button('Save changes').click();await main().getByRole('status').filter({hasText:'Team settings saved'}).waitFor();await button('Members').click();await button('Invite member').click();await dialog().getByRole('button',{name:'Invite',exact:true}).click();await dialog().getByRole('alert').waitFor();await dialog().getByLabel('Email',{exact:true}).fill('local-check@example.com');await dialog().getByRole('button',{name:'Invite',exact:true}).click();await main().getByText('local-check@example.com',{exact:true}).waitFor();await button('Billing').click();await main().getByRole('heading',{name:'Pro plan',exact:true}).waitFor();
  });
  await check(width,'Support case create and close, Agent response',async()=>{
   await go('support','Support');await button('New case').click();await dialog().getByRole('button',{name:'Create case',exact:true}).click();await dialog().getByRole('alert').waitFor();await dialog().getByLabel('Subject',{exact:true}).fill('Sample build question');await dialog().getByLabel('Message',{exact:true}).fill('Please review the sample build.');await dialog().getByRole('button',{name:'Create case',exact:true}).click();await button('Sample build question').click();await dialog().getByRole('button',{name:'Close case',exact:true}).click();assert((await main().getByRole('row').filter({hasText:'Sample build question'}).innerText()).includes('Closed'));
   await go('agent','Agent');await main().getByLabel('Message Agent',{exact:true}).fill('Review my sample deployments');await button('Send message').click();await main().getByText('Review complete. The sample projects are ready.',{exact:true}).waitFor();assert.equal(await main().locator('[data-component=aicss-text-response]').count(),1);
  });
  await check(width,'Wrapper sidebar route, Back, reload and palette',async()=>{
   await page.goto('http://127.0.0.1:3000/dashboards/infra-dashboard/deployments');const frame=page.frameLocator('iframe');await frame.locator('[data-app-ready]').waitFor();
   if(width===390)await frame.locator('.vc-topbar-toggle').getByRole('button',{name:'Open sidebar',exact:true}).click();await frame.locator('.vc-sidebar-links').getByRole('button',{name:/^Logs/}).click();assert.equal(new URL(page.url()).pathname,'/dashboards/infra-dashboard/logs');await frame.getByRole('heading',{name:'Logs',exact:true}).waitFor();
   await page.goBack();await frame.getByRole('heading',{name:'Deployments',exact:true}).waitFor();await page.reload();await frame.locator('[data-app-ready]').waitFor();await frame.getByRole('heading',{name:'Deployments',exact:true}).waitFor();await page.getByRole('button',{name:'Use light palette',exact:true}).click();assert.notEqual(await frame.locator('html').evaluate(element=>element.style.getPropertyValue('--p-background')),'#000000');await clickToolbarAction(page, 'Reset palette and fonts');assert.equal(await frame.locator('html').evaluate(element=>element.style.getPropertyValue('--p-background')),'#000000');
  });
  await context.close();
 }
 assert.deepEqual(errors,[]);
}catch(error){failure=error;console.error(error);process.exitCode=1;}finally{
 await browser.close();await writeFile(`${output}/actions.json`,JSON.stringify({result:failure?'failed':'passed',checks:results,errors},null,2));
}
console.log(`${results.filter(item=>item.result==='passed').length}/${results.length} action groups passed. Report: ${output}/actions.json`);
