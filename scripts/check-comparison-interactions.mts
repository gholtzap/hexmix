import assert from 'node:assert/strict';
import { expect } from 'playwright/test';
import { chromium, type FrameLocator, type Page } from 'playwright';
import { checkPage } from 'lintapple';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { clickToolbarAction } from './lib/studio-toolbar.mts';
import { readComparison } from '../src/lib/comparison.ts';
const base = process.env.APP_URL || 'http://127.0.0.1:3100';
const output = 'artifacts/linked-interactions'; await mkdir(output, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch();
const actions = [], reports = [], errors = [];
async function show(page: Page, side: 'A' | 'B') {
  if (page.viewportSize()!.width <= 760) await page.getByRole('button', { name: `Show palette ${side}`, exact: true }).click();
}
function outer(page: Page, side: 'A' | 'B') { return page.frameLocator(`iframe[title="Palette ${side} preview"]`); }
function inner(page: Page, side: 'A' | 'B') { return outer(page, side).frameLocator('iframe'); }
async function audit(page: Page, state: string, frames = true) {
  reports.push({ state, width: page.viewportSize()!.width, report: await checkPage(page, policy), surface: 'comparison' });
  if (frames) for (const side of ['A', 'B'] as const) {
    await show(page, side);
    const frame = await (await inner(page, side).locator('html').elementHandle())!.ownerFrame();
    reports.push({ state, width: page.viewportSize()!.width, report: await checkPage(frame!, policy), surface: side });
  }
  await page.screenshot({ path: `${output}/${page.viewportSize()!.width}-${state}.png` });
}
async function options(page: Page) {
  await show(page, 'A');
  const frame = await (await outer(page, 'A').locator('html').elementHandle())!.ownerFrame();
  await clickToolbarAction(frame, 'Compare palettes');
  await page.getByRole('checkbox', { name: 'Link interactions', exact: true }).waitFor();
}
const combinations = process.env.LINK_QUICK ? [{ width: 1440, mode: 'light' }] : [390, 1440].flatMap(width => ['light', 'dark'].map(mode => ({ width, mode })));
try {
  for (const { width, mode } of combinations) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    let step = 'load';
    const load = async (preview: string) => {
      await page.goto(`${base}/compare?preview=${preview}&mode=${mode}`); await page.locator('[data-app-ready]').waitFor();
      for (const side of ['A', 'B'] as const) {
        await inner(page, side).locator('style[data-comparison-scrollbars]').waitFor({ state: 'attached' });
        await outer(page, side).locator('iframe[data-preview-ready="true"]').waitFor({ state: 'attached' });
      }
      await show(page, 'A');
      return { a: inner(page, 'A'), b: inner(page, 'B') };
    };
    try {
      step = 'infrastructure search';
      let { a, b } = await load('infrastructure');
      await a.getByRole('searchbox', { name: 'Search projects', exact: true }).fill('acme');
      await expect(b.getByRole('searchbox', { name: 'Search projects', exact: true })).toHaveValue('acme');
      await show(page, 'B'); await b.getByRole('searchbox', { name: 'Search projects', exact: true }).fill('atlas');
      await expect(a.getByRole('searchbox', { name: 'Search projects', exact: true })).toHaveValue('atlas');
      await b.getByRole('searchbox', { name: 'Search projects', exact: true }).fill('');
      step = 'infrastructure menu';
      await b.getByRole('button', { name: 'Filter and Sort Projects', exact: true }).click();
      await a.getByRole('menu', { name: 'Filter and Sort Projects', exact: true }).waitFor({ state: 'attached' });
      await audit(page, `${mode}-filter-menu`);
      await show(page, 'B');
      await b.getByRole('menu', { name: 'Filter and Sort Projects', exact: true }).locator('..').locator('div[style*="inset: 0"]').first().click({ position: { x: 20, y: 600 } });
      for (const pane of [a, b]) await pane.getByRole('menu', { name: 'Filter and Sort Projects', exact: true }).waitFor({ state: 'hidden' });
      await b.getByRole('button', { name: 'Filter and Sort Projects', exact: true }).click();
      await b.getByRole('menu', { name: 'Filter and Sort Projects', exact: true }).getByRole('menuitem').first().press('Escape');
      await a.getByRole('menu', { name: 'Filter and Sort Projects', exact: true }).waitFor({ state: 'hidden' });
      step = 'infrastructure form';
      await show(page, 'A'); await a.getByRole('button', { name: 'Add New', exact: true }).click();
      await a.getByRole('menuitem', { name: 'Project', exact: true }).click();
      await b.getByLabel('Project name', { exact: true }).waitFor({ state: 'attached' });
      await a.getByLabel('Project name', { exact: true }).fill('linked-review');
      await expect(b.getByLabel('Project name', { exact: true })).toHaveValue('linked-review');
      await audit(page, `${mode}-create-dialog`);
      await show(page, 'A'); await a.getByRole('button', { name: 'Create Project', exact: true }).click();
      for (const pane of [a, b]) { await pane.getByRole('button', { name: 'linked-review', exact: true }).waitFor({ state: 'attached' }); assert.equal(await pane.getByRole('button', { name: 'linked-review', exact: true }).count(), 1); }
      step = 'unlink';
      await options(page); await page.getByRole('checkbox', { name: 'Link interactions', exact: true }).click();
      assert.equal(readComparison(new URL(page.url()).search).unlinked, true);
      await audit(page, `${mode}-unlinked-options`, false); await page.keyboard.press('Escape');
      await a.getByRole('searchbox', { name: 'Search projects', exact: true }).fill('only-side-a');
      await expect(b.getByRole('searchbox', { name: 'Search projects', exact: true })).toHaveValue('');
      await options(page); await page.getByRole('checkbox', { name: 'Link interactions', exact: true }).click(); await page.keyboard.press('Escape');
      await a.getByRole('searchbox', { name: 'Search projects', exact: true }).fill('linked-review');
      await expect(b.getByRole('searchbox', { name: 'Search projects', exact: true })).toHaveValue('linked-review');
      step = 'palette separation';
      const source = readComparison(new URL(page.url()).search);
      const editor = await (await outer(page, 'A').locator('html').elementHandle())!.ownerFrame();
      const beforeShuffle = new URL(page.url()).searchParams.get('a');
      await clickToolbarAction(editor, 'Shuffle palette');
      await page.waitForFunction(old => new URLSearchParams(location.search).get('a') !== old, beforeShuffle);
      assert.deepEqual(readComparison(new URL(page.url()).search).b, source.b);
      step = 'workspace navigation';
      ({ a, b } = await load('workspace'));
      await a.locator('#chat-files').setInputFiles({ name: 'review.txt', mimeType: 'text/plain', buffer: Buffer.from('Palette review') });
      await expect(b.locator('.attachments')).toContainText('review.txt');
      await a.getByRole('textbox', { name: 'Ask Pebble', exact: true }).fill('Review the launch palette');
      await expect(b.getByRole('textbox', { name: 'Ask Pebble', exact: true })).toHaveValue('Review the launch palette');
      await a.getByRole('textbox', { name: 'Ask Pebble', exact: true }).press('Enter');
      for (const pane of [a, b]) await expect(pane.locator('.chat-message.user')).toHaveCount(1);
      await show(page, 'B');
      await b.getByRole('textbox', { name: 'Ask Pebble', exact: true }).fill('Compare the next view');
      await b.getByRole('button', { name: 'Send message', exact: true }).click();
      for (const pane of [a, b]) await expect(pane.locator('.chat-message.user')).toHaveCount(2);
      await show(page, 'A');
      const open = a.getByRole('button', { name: 'Open sidebar', exact: true }); if (await open.isVisible()) await open.click();
      await a.getByRole('button', { name: 'Space', exact: true }).click();
      await b.getByRole('heading', { name: 'All', exact: true }).waitFor({ state: 'attached' });
      await a.getByRole('searchbox', { name: 'Search Space', exact: true }).fill('Team');
      await expect(b.getByRole('searchbox', { name: 'Search Space', exact: true })).toHaveValue('Team');
      await show(page, 'B'); await b.getByRole('tab', { name: 'Favorites', exact: true }).click();
      await expect(a.getByRole('tab', { name: 'Favorites', exact: true })).toHaveAttribute('aria-selected', 'true');
      await b.getByRole('button', { name: 'Grid view', exact: true }).click();
      await expect(a.getByRole('button', { name: 'Grid view', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await audit(page, `${mode}-workspace`);
      step = 'avenlo accordion';
      ({ a, b } = await load('avenlo'));
      await a.locator('.hfaq__q').first().click();
      await expect(b.locator('.hfaq__q').first()).toHaveAttribute('aria-expanded', 'true');
      await show(page, 'B'); await b.locator('.hfaq__q').first().click();
      await expect(a.locator('.hfaq__q').first()).toHaveAttribute('aria-expanded', 'false');
      step = 'avenlo navigation';
      await b.getByRole('button', { name: 'Open menu', exact: true }).click();
      await b.getByRole('link', { name: 'Blog', exact: true }).first().click();
      for (const side of ['A', 'B'] as const) await outer(page, side).locator('main[data-app-ready]').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLIFrameElement>('.comparison-option > iframe')].every(frame => frame.contentWindow?.location.pathname.endsWith('/blog')));
      step = 'orvian accordion and dialog';
      ({ a, b } = await load('orvian'));
      await a.locator('#faq button').nth(1).click(); await expect(b.locator('#faq button').nth(1)).toHaveAttribute('aria-expanded', 'true');
      await a.getByRole('button', { name: 'Book a demo', exact: true }).first().click();
      await b.getByRole('dialog').waitFor({ state: 'attached' }); await audit(page, `${mode}-demo-dialog`);
      await show(page, 'B'); await b.getByRole('button', { name: 'Close', exact: true }).click(); await a.getByRole('dialog').waitFor({ state: 'hidden' });
      step = 'tervix navigation';
      ({ a, b } = await load('tervix'));
      await a.getByRole('link', { name: 'Pricing', exact: true }).first().click();
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLIFrameElement>('.comparison-option > iframe')].every(frame => { const preview = frame.contentDocument?.querySelector<HTMLIFrameElement>('iframe')?.contentWindow; return preview?.location.pathname === '/render/tervix' && preview.location.hash === '#pricing'; }));
      step = 'nuvexa menu';
      ({ a, b } = await load('nuvexa'));
      await a.getByRole('button', { name: 'Menu', exact: true }).click();
      for (const pane of [a, b]) await pane.getByRole('button', { name: 'Close', exact: true }).waitFor({ state: 'attached' });
      await audit(page, `${mode}-nuvexa-menu`);
      await show(page, 'B'); await b.getByRole('button', { name: 'Close', exact: true }).click();
      await a.getByRole('button', { name: 'Menu', exact: true }).waitFor({ state: 'attached' });
      actions.push({ width, mode, passed: true }); console.log(width, mode, 'passed');
    } catch (error) { actions.push({ width, mode, step, passed: false, error: error.stack }); console.error(width, mode, step, error.stack); await page.screenshot({ path: `${output}/${width}-${mode}-failed.png` }).catch(() => {}); }
    finally { await context.close(); }
  }
} finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify({ actions, reports, errors }, null, 2)); }
assert.deepEqual(actions.filter(action => !action.passed), []); assert.deepEqual(errors, []);
if (reports.some(entry => entry.report.findings.length)) process.exitCode = 1;
