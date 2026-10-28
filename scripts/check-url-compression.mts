import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type BrowserContext } from 'playwright';
import { checkPage } from 'lintapple';
import { encodeState, parseState, stateParameter, type ViewState } from '../browser/public/share-state.ts';
import { clickToolbarAction, openSiteSwitcher } from './lib/studio-toolbar.mts';

const base = process.env.APP_URL ?? 'http://127.0.0.1:3300';
const out = 'artifacts/url-compression/e2e';
await mkdir(out, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch();
const errors: string[] = [], checks: unknown[] = [], reports: { state: string; report: Awaited<ReturnType<typeof checkPage>> }[] = [];
const snapshots = new Set<string>();
let complete = false;
let activePage: Page | undefined;
const ready = async (page: Page) => { await page.locator('[data-app-ready]').waitFor(); };
const decoded = (page: Page) => parseState(stateParameter(new URL(page.url())));
async function open(context: BrowserContext, href: string) {
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(href); await ready(page);
  return page;
}
async function audit(page: Page, state: string) {
  await page.mouse.move(1, 1);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
  reports.push({ state, report: await checkPage(page, policy) });
  const frame = page.frames().find(frame => frame.parentFrame());
  if (frame) {
    const palette = new URL(page.url()).searchParams.get('colors')!.split('-').map(value => '#' + value).join('|');
    if (new URL(frame.url()).pathname.startsWith('/render/')) await frame.waitForFunction(palette => document.documentElement.dataset.contrastReady === 'true' && document.documentElement.dataset.contrastPalette === palette, palette);
    await frame.evaluate(async () => { await document.fonts.ready; });
    reports.push({ state: state + '-preview', report: await checkPage(frame, policy) });
  }
  await page.screenshot({ path: `${out}/${state}.png` });
}
async function share(page: Page) {
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await clickToolbarAction(page, 'Share palette');
  let href = '';
  for (let attempt = 0; attempt < 150; attempt++) {
    href = await page.evaluate(() => navigator.clipboard.readText());
    if (/^https?:/.test(href)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.match(href, /^https?:/, 'Share must copy a completed link');
  const id = /^\/s\/([a-f0-9]{32})$/.exec(new URL(href).pathname)?.[1];
  if (id) snapshots.add(id);
  return href;
}
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark'] as const) for (const format of ['query', 'hash']) {
    const label = `${width}-${theme}-${format}`;
    const options = { viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' as const, permissions: ['clipboard-read', 'clipboard-write'] };
    const context = await browser.newContext(options);
    const palette = theme === 'dark' ? 'ededed-171717-e98878-333333-a8655f' : '171717-ffffff-e98878-ffe291-a8655f';
    const state: ViewState = { v: 1, views: {
      '/editor': { 'Studio.Studio.exportOpen': true, 'Studio.Studio.exportFormat': 'json' },
      '/avenlo': { 'Studio.Studio.locked': ['primary'] },
      '/avenlo|Page preview': { 'document.view': { expanded: ['#hfaq-q-1'], tabs: [], details: [], dialogs: [], current: [], classes: {}, hidden: {}, scroll: {} } },
      '/orvian|Page preview': { 'document.view': { expanded: [], collapsed: ['#faq-question-0'], tabs: [], details: [], dialogs: [], current: [], classes: {}, hidden: {}, scroll: {} } },
    } };
    const url = new URL(`/editor?colors=${palette}&heading=Arial&body=Verdana`, base);
    const legacy = Buffer.from(JSON.stringify(state)).toString('base64url');
    if (format === 'hash') url.hash = `state=${legacy}`; else url.searchParams.set('state', legacy);
    const page = await open(context, url.href);
    activePage = page;
    await page.getByRole('dialog', { name: 'Export', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Format', { exact: true }).inputValue(), 'json');
    await audit(page, `${label}-legacy-export`);
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await page.waitForFunction(() => (location.hash.startsWith('#state=') ? location.hash.slice(7) : new URLSearchParams(location.search).get('state'))?.startsWith('gz1.'));
    assert.deepEqual(decoded(page).views['/avenlo'], state.views['/avenlo']);
    assert.deepEqual(decoded(page).views['/avenlo|Page preview'], state.views['/avenlo|Page preview']);
    const compressedLength = stateParameter(new URL(page.url()))!.length;
    await page.reload(); await ready(page);
    assert.equal(await page.getByRole('dialog', { name: 'Export', exact: true }).count(), 0);
    await clickToolbarAction(page, 'Export palette');
    assert.equal(await page.getByLabel('Format', { exact: true }).inputValue(), 'json');
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await openSiteSwitcher(page); await page.getByRole('menuitem', { name: 'Avenlo', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/avenlo'); await ready(page);
    const faq = page.frameLocator('iframe').locator('#hfaq-q-1');
    await faq.waitFor(); await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#hfaq-q-1')?.getAttribute('aria-expanded') === 'true');
    await page.getByRole('button', { name: 'Primary color', exact: true }).click();
    await page.getByRole('button', { name: 'Unlock primary', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close color picker', exact: true }).click();
    const third = page.frameLocator('iframe').locator('#hfaq-q-2'); await third.click();
    await page.waitForFunction(() => {
      const url = new URL(location.href); return (url.hash.startsWith('#state=') ? url.hash.slice(7) : url.searchParams.get('state'))?.startsWith('gz1.');
    });
    await page.reload(); await ready(page);
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#hfaq-q-2')?.getAttribute('aria-expanded') === 'true');
    const href = await share(page);
    const sharedParameter = stateParameter(new URL(href));
    const snapshot = /^\/s\/([a-f0-9]{32})$/.exec(new URL(href).pathname)?.[1];
    const shared = sharedParameter ? parseState(sharedParameter) : (await (await page.request.get(`${base}/api/shares/${snapshot}`)).json()).state as ViewState;
    const encodedShared = encodeState(shared);
    assert.match(encodedShared, /^gz1\./);
    const recipient = await browser.newContext(options);
    const receiver = await open(recipient, href);
    await receiver.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#hfaq-q-2')?.getAttribute('aria-expanded') === 'true');
    assert.equal(new URL(receiver.url()).searchParams.get('heading'), 'Arial');
    assert.equal(new URL(receiver.url()).searchParams.get('body'), 'Verdana');
    assert.equal(new URL(receiver.url()).searchParams.get('colors'), palette);
    const browserCodec = await receiver.evaluate(async raw => {
      const path = '/share-state.js';
      const codec = await import(path);
      const state = codec.parseState(raw);
      return { state, encoded: codec.encodeState(state) };
    }, encodedShared);
    assert.deepEqual(browserCodec.state, shared);
    assert.equal(browserCodec.encoded, encodedShared);
    await audit(receiver, `${label}-shared-faq`);
    await recipient.close();
    await openSiteSwitcher(page); await page.getByRole('menuitem', { name: 'Orvian', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/orvian'); await ready(page);
    await page.waitForFunction(() => {
      const document = window.document.querySelector('iframe')?.contentDocument;
      return document?.querySelector('#faq-question-2')?.getAttribute('aria-expanded') === 'false' && document.querySelector('#faq-question-0')?.getAttribute('aria-expanded') === 'false';
    });
    await page.goBack(); await ready(page);
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#hfaq-q-2')?.getAttribute('aria-expanded') === 'true');
    if (format === 'query') {
      await page.goto(`${base}/nuvexa?colors=${palette}`); await ready(page);
      const frame = page.frames().find(frame => frame.parentFrame())!;
      await frame.locator('html[data-contrast-ready=true][data-copy-ready=true]').waitFor();
      await page.waitForLoadState('networkidle');
      const carousel = frame.locator('#stories-carousel');
      await frame.locator('[data-framer-name="Carousel Arrows"] button[aria-label="Next"]').click();
      await frame.waitForFunction(() => document.getElementById('stories-carousel')!.scrollLeft > 0);
      let previous = -1, settled = 0;
      for (let attempt = 0; attempt < 30 && settled < 3; attempt++) {
        const current = await carousel.evaluate(node => node.scrollLeft);
        settled = Math.abs(current - previous) < 1 ? settled + 1 : 0;
        previous = current;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal(settled, 3, 'The carousel must stop moving before its saved position is checked');
      let expected = 0;
      for (let attempt = 0; attempt < 50; attempt++) {
        const scroll = decoded(page).views['/nuvexa|Page preview']?.['document.view'] as { scroll?: Record<string, { left: number }> } | undefined;
        expected = scroll?.scroll?.['#stories-carousel']?.left ?? 0;
        if (expected > 0) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(expected > 0, 'The address must capture horizontal carousel scrolling');
      const scrollRecipient = await browser.newContext(options);
      const restored = await open(scrollRecipient, page.url());
      const restoredFrame = restored.frames().find(frame => frame.parentFrame())!;
      await restoredFrame.locator('html[data-contrast-ready=true][data-copy-ready=true]').waitFor();
      await restored.waitForLoadState('networkidle');
      const actual = await restoredFrame.locator('#stories-carousel').evaluate(node => node.scrollLeft / Math.max(1, node.scrollWidth - node.clientWidth));
      assert(Math.abs(actual - expected) < 0.03, `The carousel must restore horizontal scrolling: expected ${expected}, got ${actual}`);
      const savedView = decoded(page).views['/nuvexa|Page preview']['document.view'] as { scroll: Record<string, { top: number }> };
      const top = await restoredFrame.evaluate(() => { const node = document.scrollingElement!; return node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight); });
      assert(Math.abs(top - savedView.scroll.document.top) < 0.03, 'The page must also restore vertical scrolling');
      await audit(restored, `${label}-carousel-restored`);
      await scrollRecipient.close();
    }
    for (const invalid of ['gz1.bad', 'gz2.unknown']) {
      await page.goto(`${base}/editor?state=${invalid}`); await ready(page);
      await page.getByRole('button', { name: 'Primary color', exact: true }).click();
      await page.getByRole('dialog', { name: 'Primary color', exact: true }).waitFor();
    }
    await audit(page, `${label}-invalid-state-recovery`);
    checks.push({ width, theme, format, legacyLength: legacy.length, compressedLength, cases: ['legacy export restoration', 'compressed rewrite', 'other page state retained', 'reload', 'palette lock', 'preview FAQ', 'fresh recipient', 'fonts and colors', 'open and closed controls', 'browser back', 'invalid state recovery'] });
    await context.close(); console.log('Passed', label);
  }
  assert.deepEqual(errors, []); complete = true;
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${out}/failure.png` });
    await writeFile(`${out}/failure.json`, JSON.stringify({ url: activePage.url(), state: decoded(activePage), frames: await Promise.all(activePage.frames().map(async frame => ({ url: frame.url(), controls: await frame.locator('#hfaq-q-1,#hfaq-q-2').evaluateAll(nodes => nodes.map(node => node.outerHTML)) }))) }, null, 2));
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(`${out}/compression-report.json`, JSON.stringify({ complete, checks, errors, snapshots: [...snapshots], reports }, null, 2));
}
const findings = reports.reduce((sum, item) => sum + item.report.findings.length, 0);
console.log(`${checks.length} flows; ${reports.length} UI states; ${findings} findings.`);
if (findings) process.exitCode = 1;
