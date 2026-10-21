import { clickToolbarAction } from './lib/studio-toolbar.mts';
import type {Page} from 'playwright';
import { surfaceForegrounds } from '../src/lib/palette.ts';
import {sitePreviews} from '../src/lib/previews.ts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
const output = process.env.NAV_OUTPUT || 'artifacts/navigation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({args:['--host-resolver-rules=MAP preview.localhost 127.0.0.1']});
const reports = [], actions = [], links = [], errors = [], hydrationErrors = [];
let failure, activePage;
const base = 'http://127.0.0.1:3000';
async function setTheme(page: Page,dark: boolean){
  const palette=dark?{text:'#ededed',background:'#171717',primary:'#db9b86',secondary:'#333333',accent:'#c7b299'}:{text:'#171717',background:'#ffffff',primary:'#171717',secondary:'#f5f5f5',accent:'#555555'};
  const variables={...Object.fromEntries(Object.entries(palette).map(([role,color])=>[`--p-${role}`,color])),...Object.fromEntries(Object.entries(surfaceForegrounds(palette)).map(([surface,color])=>[`--p-on-${surface}`,color]))};
  await page.evaluate(variables=>Object.entries(variables).forEach(([name,value])=>document.documentElement.style.setProperty(name,value)),variables);
}

async function audit(page, state, width) {
  await page.waitForFunction(() => !document.getAnimations().some(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity));
  await page.mouse.move(2,2);
  let report = { findings: [] };
  let attached = false;
  try { await expectUI(page, { attach: async (_, attachment) => { report = JSON.parse(String(attachment.body)); attached = true; } }); }
  catch (error) { if (!attached) throw error; }
  reports.push({ state, width, report });
  if ((state.startsWith('Infrastructure') || state.startsWith('Workspace')) && !state.endsWith(' light')) {
    const previous = await page.locator('html').getAttribute('style');
    await setTheme(page,false);
    await audit(page,`${state} light`,width);
    await page.evaluate(previous => { if(previous === null) document.documentElement.removeAttribute('style'); else document.documentElement.setAttribute('style',previous); },previous);
  }
  if(report.findings.length){
    await page.screenshot({path:`${output}/ui-${width}-${state.replace(/[^a-z0-9]+/gi,'-')}.png`});
    const details=await page.evaluate(findings=>findings.map(finding=>{const element=document.querySelector(finding.selector);if(!element)return finding;const rect=element.getBoundingClientRect();return {finding,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},html:element.outerHTML,atCenter:document.elementsFromPoint(rect.x+rect.width/2,rect.y+rect.height/2).slice(0,5).map(node=>node.outerHTML.slice(0,200))};}),report.findings);
    await writeFile(`${output}/ui-${width}-${state.replace(/[^a-z0-9]+/gi,'-')}.json`,JSON.stringify(details,null,2));
  }
}
async function check(name, run) { await run(); actions.push(name); console.log(name); }
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/hydrated|hydration/i.test(message.text()))hydrationErrors.push(message.text());});
    const samples={avenlo:'products/website-qualifier',tervix:'forward-deployed',orvian:'blog',nuvexa:'products/quotes-and-tenders'};
    for (const site of Object.keys(samples)) {
      await check(`${width} ${site}: source page and local links`, async () => {
        const preview=sitePreviews[site];
        await page.goto(`${base}/${preview.slug}`);
        const frame=page.frameLocator('iframe');
        if (site === 'tervix') await frame.locator('html[data-home-ready="true"]').waitFor();
        await frame.locator('a[data-preview-path]').first().waitFor({state:'attached'});
        const hrefs=await frame.locator('a[data-preview-path][href]').evaluateAll(elements=>[...new Set(elements.map(element=>(element as HTMLAnchorElement).href))]);
        assert(hrefs.length>0);
        for(const href of hrefs){
          const url=new URL(href);
          assert(url.pathname===`/${preview.slug}`||url.pathname.startsWith(`/${preview.slug}/`),href);
          assert(!url.pathname.startsWith(`/${preview.slug}/${preview.slug}/`),href);
          if(width===1440&&!links.some(item=>item.href===href))links.push({site,href});
        }
        const destination=`${base}/${preview.slug}/${samples[site]}`;
        await page.goto(`${base}/site-previews/${site}/${samples[site]}`);
        await page.waitForURL(url=>url.pathname===`/${preview.slug}/${samples[site]}`);
        await frame.locator('html[data-contrast-ready="true"]').waitFor();
        assert((await frame.locator('body').innerText()).length>150);
        await page.reload();
        await frame.locator('html[data-contrast-ready="true"]').waitFor();
        assert.equal(new URL(page.url()).pathname,new URL(destination).pathname);
      });
    }
    await check(`${width} Infrastructure: preview, source, settings, transfer, widgets, sidebar`, async () => {
      await context.request.get(`${base}/dashboard-previews/workspace/app`);
      await page.goto(`${base}/dashboard-previews/infrastructure`); await page.locator('[data-app-ready]').waitFor();
      const dialog = () => page.getByRole('dialog');
      const close = async () => { await dialog().getByRole('button', { name: 'Close dialog', exact: true }).click(); };
      const project = page.locator('.vc-project').filter({ has: page.getByRole('button', { name: 'acme-web', exact: true }) });
      await project.getByRole('button',{name:'Connect Git Repository',exact:true}).click();
      await dialog().getByLabel('Repository',{exact:true}).fill('invalid');await dialog().getByRole('button',{name:'Connect repository',exact:true}).click();await dialog().getByRole('alert').waitFor();await audit(page,'Infrastructure repository validation',width);
      await dialog().getByLabel('Repository',{exact:true}).fill('studio/acme-web');await dialog().getByRole('button',{name:'Connect repository',exact:true}).click();assert((await project.innerText()).includes('Connected to studio/acme-web'));
      await project.locator('.vc-project-domain').click(); await dialog().getByRole('region', { name: 'Project preview' }).waitFor();
      await dialog().getByRole('button', { name: 'Contact the team', exact: true }).click(); await dialog().getByLabel('Feedback', { exact: true }).fill('Review this release');
      await dialog().getByRole('button', { name: 'Save feedback', exact: true }).click(); await dialog().getByRole('status').waitFor(); await audit(page, 'Infrastructure preview feedback', width);
      await dialog().getByRole('button', { name: 'View source', exact: true }).click(); await dialog().getByRole('button', { name: 'package.json', exact: true }).click();
      assert((await dialog().getByRole('textbox',{name:'File contents',exact:true}).inputValue()).includes('next build')); await audit(page, 'Infrastructure source viewer', width); await close();
      async function menu(label) { await project.getByRole('button', { name: 'Project Menu · acme-web', exact: true }).click(); await page.getByRole('menuitem', { name: label, exact: true }).click(); }
      await menu('Settings'); await dialog().getByLabel('Domain', { exact: true }).fill('changed.example.com'); await dialog().getByRole('button', { name: 'Save changes', exact: true }).click(); assert((await project.innerText()).includes('changed.example.com'));
      await project.getByRole('button', { name: 'Select widget · acme-web', exact: true }).click(); await page.getByRole('menuitem', { name: 'Production checklist', exact: true }).click();
      await audit(page, 'Infrastructure production checklist', width); await dialog().getByRole('button', { name: 'Save checklist', exact: true }).click();
      await project.getByRole('button', { name: 'Select widget · acme-web', exact: true }).click(); await page.getByRole('menuitem', { name: 'Disable widget', exact: true }).click(); assert.equal(await project.getByRole('button', { name: 'Select widget · acme-web', exact: true }).count(), 0);
      await menu('Transfer Project'); await dialog().getByLabel('Destination workspace', { exact: true }).selectOption('Personal'); await audit(page, 'Infrastructure transfer form', width); await dialog().getByRole('button', { name: 'Transfer project', exact: true }).click(); assert.equal(await project.count(), 0);
      if (width === 390) await page.locator('.vc-mobile-tools').getByRole('button', { name: 'Open sidebar', exact: true }).click();
      assert.equal(await page.locator('[data-site-switcher-slot]').textContent(),'Design studio Pro');
      assert.equal(await page.locator('.vc-sidebar-links .vc-nav-link').last().innerText(),'AI Gateway');
      assert.equal(await page.locator('.vc-sidebar-footer,.vc-upgrade-notice').count(),0);
      await audit(page,'Infrastructure simplified sidebar',width);
      await page.goto(`${base}/dashboards/infra-dashboard`);const frame=page.frameLocator('iframe');await frame.locator('[data-app-ready]').waitFor();
      await clickToolbarAction(page, 'Use light palette');
      assert.notEqual(await frame.locator('html').evaluate(e=>e.style.getPropertyValue('--p-background')),'#000000');

    });
    await check(`${width} workspace: context, voice, drawing, topic tasks`, async () => {
      await page.goto(`${base}/dashboard-previews/workspace/app`); await page.locator('[data-app-ready]').waitFor();
      await page.getByRole('button', { name: 'Dictate', exact: true }).click();
      await page.getByLabel('Message', { exact: true }).fill('Use this transcript'); await page.getByRole('button', { name: 'Use message', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: 'Ask Pebble', exact: true }).inputValue(), 'Use this transcript');
      await page.getByRole('textbox', { name: 'Ask Pebble', exact: true }).fill('');
      await page.getByRole('button', { name: 'Start Voice', exact: true }).click(); await audit(page, 'Workspace voice editor', width); await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.getByRole('button', { name: 'Add files and more', exact: true }).click(); await page.getByRole('menuitem', { name: 'Sketch', exact: true }).click(); await audit(page, 'Workspace sketch', width);
      await page.getByRole('button', { name: 'Attach sketch', exact: true }).click(); await page.getByText('sketch.png', { exact: true }).waitFor();
      if(width===390)await page.getByRole('button',{name:'Open sidebar',exact:true}).click();
      await page.getByRole('button', { name: 'Explore', exact: true }).click(); await page.getByRole('menuitem', { name: 'Health', exact: true }).click();
      await page.getByLabel('What would you like to work on?', { exact: true }).fill('Plan a walking routine'); await audit(page, 'Workspace topic form', width); await page.getByRole('button', { name: 'Continue in Work', exact: true }).click();
      await page.waitForFunction(() => (document.querySelector('[aria-label="Work with Pebble"]') as HTMLInputElement)?.value === 'Plan a walking routine');
      if (width === 390) await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
      await page.getByRole('button', { name: /personal assistant/ }).click(); await page.getByLabel('Personal context', { exact: true }).fill('Prefer short answers.'); await audit(page, 'Workspace personal context', width); await page.getByRole('button', { name: 'Save context', exact: true }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('pebble-context')), 'Prefer short answers.');
      await page.goto(`${base}/dashboard-previews/workspace/app?view=scheduled`);await page.locator('[data-app-ready]').waitFor();
      if(width===390)await page.getByRole('button',{name:'Open sidebar',exact:true}).click();
      await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('searchbox',{name:'Search tasks',exact:true}).fill('No matching task');await page.getByText('No tasks found',{exact:true}).waitFor();await audit(page,'Workspace task search empty',width);
      await page.getByRole('dialog',{name:'Search tasks',exact:true}).getByRole('button',{name:'New task',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('Review a plan');await page.getByLabel('Prompt',{exact:true}).fill('Review the project plan');await page.getByLabel('Schedule',{exact:true}).fill('Every Monday at 9');await page.getByRole('button',{name:'Save',exact:true}).click();
      await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('searchbox',{name:'Search tasks',exact:true}).fill('Review a plan');await audit(page,'Workspace task search result',width);await page.getByRole('dialog',{name:'Search tasks',exact:true}).getByRole('button',{name:'Review a plan',exact:true}).click();await page.getByRole('button',{name:'Open in Work',exact:true}).click();await page.getByRole('button',{name:'Continue in Work',exact:true}).waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
      await page.goto(`${base}/dashboard-previews/workspace/app?view=skills`);await page.locator('[data-app-ready]').waitFor();await page.getByRole('searchbox',{name:'Search skills',exact:true}).fill('Missing skill');await page.getByText('No skills found',{exact:true}).waitFor();await audit(page,'Workspace skills search empty',width);await page.getByRole('button',{name:'Clear search',exact:true}).click();assert(await page.locator('[data-plug-skill]').count()>0);

    });
    await page.goto(`${base}/page-that-does-not-exist`);await page.getByRole('heading',{name:'Choose a page to continue',exact:true}).waitFor();await audit(page,'Unknown address recovery',width);
    await page.getByRole('link',{name:'Browse all previews',exact:true}).click();await page.waitForURL(base+'/');await page.locator('[data-app-ready]').waitFor();
    await context.close();
  }
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
    const page=await context.newPage();activePage=page;page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
    await check(`${width} hosted preview: links, image, forms and palette`,async()=>{
      await page.goto('http://preview.localhost:3000/avenlo?colors=171717-ffffff-a35439-f5f5f5-555555&heading=Arial&body=Verdana');await page.locator('[data-preview-capture=avenlo]').waitFor();await audit(page,'Hosted preview pages',width);
      const image=page.getByRole('link',{name:'Explore Avenlo pages',exact:true});assert((await image.getAttribute('href')).includes('/avenlo/overview?colors='));
      await page.getByRole('link',{name:'Try the product',exact:true}).click();await page.waitForURL(/\/avenlo\/demo\?colors=171717-ffffff-a35439-f5f5f5-555555/);await page.locator('[data-preview-capture=avenlo]').waitFor();
      assert.equal(await page.locator('iframe').count(),0);
      assert((await page.getByRole('link',{name:'Explore Avenlo pages',exact:true}).getAttribute('href')).includes('/avenlo/overview?colors='));
    });
    await context.close();
  }
  const context = await browser.newContext();
  for (let offset = 0; offset < links.length; offset += 6) await Promise.all(links.slice(offset, offset + 6).map(async link => {
    const response = await context.request.get(link.href); link.status = response.status(); assert.equal(link.status, 200, link.href);
  }));
  await context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(hydrationErrors, []);
  const findings = reports.flatMap(item => item.report?.findings || []);
  assert.equal(findings.length, 0, `${findings.length} UI findings. See report.`);
} catch (error) { failure = error; process.exitCode = 1; console.error(error); if(activePage && !activePage.isClosed()){await activePage.screenshot({path:`${output}/failure.png`});await writeFile(`${output}/failure.html`,await activePage.content());console.error('Page:',activePage.url());} }
finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify({ completed: !failure, failure: failure?.message, actions, links, errors, hydrationErrors, reports }, null, 2)); }
console.log(`${actions.length} action groups; ${links.length} links; ${reports.length} UI states. Report: ${output}/report.json`);
