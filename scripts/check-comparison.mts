import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { checkPage } from 'lintapple';
import { readComparison } from '../src/lib/comparison.ts';
import { defaultDarkPalette, initialPalette, paletteQuery, paletteForMode, quickPickPresets } from '../src/lib/palette.ts';
import { fonts } from '../src/lib/fonts.ts';
import { previewCatalog, previewHref } from '../src/lib/preview-catalog.ts';
import { clickToolbarAction } from './lib/studio-toolbar.mts';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = 'artifacts/comparison'; await mkdir(output, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch();
const reports = [], actions = [], errors = [];
const combinations = process.env.COMPARE_QUICK ? [{ width: 1440, theme: 'light' }] : [390, 1440].flatMap(width => ['light', 'dark'].map(theme => ({ width, theme })));
async function editor(page: Page, side: 'a' | 'b') {
  if (page.viewportSize().width <= 760) await page.getByRole('button', { name: `Show palette ${side.toUpperCase()}`, exact: true }).click();
  return (await page.locator(`iframe[title="Palette ${side.toUpperCase()} preview"]`).elementHandle()).contentFrame();
}
async function openSaved(page: Page, side: 'a' | 'b') {
  const frame = await editor(page, side);
  await clickToolbarAction(frame, 'Palettes');
  return frame;
}
async function options(page: Page, side?: 'a' | 'b') {
  if (await page.locator('.comparison-menu').isVisible()) return;
  const frame = await editor(page, side ?? 'a');
  await clickToolbarAction(frame, 'Compare palettes');
}
async function setMode(page: Page, label: string) {
  await options(page);
  await page.locator('.comparison-menu').getByRole('button', { name: label, exact: true }).click();
  await page.keyboard.press('Escape');
}
async function rendered(page: Page, side: 'a' | 'b') {
  if (page.viewportSize().width <= 760) await page.getByRole('button', { name: `Show palette ${side.toUpperCase()}`, exact: true }).click();
  const value = readComparison(new URL(page.url()).search);
  const display = value[side === 'a' ? 'customA' : 'customB'] ? value[side] : paletteForMode(value[side], value.mode);
  const selected = previewCatalog.find(item => item.id === value.preview);
  const handle = await page.locator(`iframe[title="Palette ${side.toUpperCase()} preview"]`).elementHandle();
  const outer = await handle.contentFrame();
  const expectedColors = new URLSearchParams(paletteQuery(display)).get('colors');
  await outer.waitForURL(url => url.pathname === selected.path && url.searchParams.get('embed') === 'toolbar' && url.searchParams.get('colors') === expectedColors);
  await outer.locator('[data-app-ready]').waitFor();
  assert.equal(await outer.getByRole('region', { name: 'Color toolbar', exact: true }).count(), 1);
  const child = await outer.locator('iframe').elementHandle();
  const inner = await child.contentFrame();
  await inner.waitForFunction(({ palette, heading, body }) => {
    const root = document.documentElement;
    return Object.entries(palette).every(([role, color]) => root.style.getPropertyValue(`--p-${role}`) === color)
      && root.style.getPropertyValue('--p-heading-font') === heading && root.style.getPropertyValue('--p-body-font') === body
      && root.dataset.contrastReady === 'true';
  }, { palette: display, heading: fonts[value.heading], body: fonts[value.body] });
  await outer.locator('iframe[data-preview-ready="true"]').waitFor({ state: 'visible' });
  await inner.locator('body').waitFor({ state: 'visible' });
  assert.equal(await inner.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth), 'none');
  await inner.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
  return inner;
}
async function audit(page: Page, state: string, width: number, theme: string, frames = false) {
  await page.mouse.move(1, 1);
  let report = { findings: [] }, attached = false;
  try { await expectUI(page, { attach: async (_, data) => { attached = true; report = JSON.parse(String(data.body)); } }, policy); }
  catch (error) { if (!attached) throw error; }
  reports.push({ state, width, theme, surface: 'comparison', report });
  for (const side of ['a', 'b'] as const) {
    const iframe = page.locator(`iframe[title="Palette ${side.toUpperCase()} preview"]`);
    if (await iframe.isVisible()) {
      const frame = await (await iframe.elementHandle()).contentFrame();
      reports.push({ state, width, theme, surface: `toolbar-${side}`, report: await checkPage(frame, policy) });
    }
  }
  if (frames) for (const side of ['a', 'b'] as const) {
    await page.locator(`iframe[title="Palette ${side.toUpperCase()} preview"]`).scrollIntoViewIfNeeded();
    reports.push({ state, width, theme, surface: side, report: await checkPage(await rendered(page, side), policy) });
  }
  await page.screenshot({ path: `${output}/${width}-${theme}-${state}.png` });
}
try {
  for (const { width, theme } of combinations) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    try {
      const a = theme === 'dark' ? defaultDarkPalette : initialPalette;
      const saved = [
        { id: 'launch', name: 'Launch colors', colors: a },
        { id: 'garden', name: 'Garden option', colors: quickPickPresets[1].colors },
        { id: 'ocean', name: 'Ocean option', colors: quickPickPresets[2].colors },
        { id: 'night', name: 'Night review', colors: quickPickPresets[4].colors },
      ];
      await context.addInitScript(saved => { if (!localStorage.getItem('hue-palettes-v1')) localStorage.setItem('hue-palettes-v1', JSON.stringify(saved)); }, saved);
      await page.goto(`${base}/compare`); await page.locator('[data-app-ready]').waitFor();
      const defaults = readComparison(new URL(page.url()).search);
      assert.deepEqual(defaults.a, saved[0].colors); assert.deepEqual(defaults.b, saved[1].colors);
      assert.equal(defaults.nameA, saved[0].name); assert.equal(defaults.nameB, saved[1].name);
      if (width === 390 && theme === 'dark') {
        const first = await rendered(page, 'a');
        await first.evaluate(() => { const node = document.scrollingElement; node.scrollTo({ top: (node.scrollHeight - node.clientHeight) * 0.2, behavior: 'instant' }); });
        const second = await rendered(page, 'b');
        await second.waitForFunction(() => { const node = document.scrollingElement; return Math.abs(node.scrollTop / (node.scrollHeight - node.clientHeight) - 0.2) < 0.02; });
      }
      await page.goto(`${base}${previewHref('/dashboards/infra-dashboard', a, 'Arial', 'Verdana')}`);
      await page.locator('[data-app-ready]').waitFor();
      await clickToolbarAction(page, 'Compare palettes');
      await page.waitForURL('**/compare?**'); await page.locator('[data-app-ready]').waitFor();
      assert.equal(readComparison(new URL(page.url()).search).preview, 'infrastructure');
      assert.deepEqual(readComparison(new URL(page.url()).search).a, a);
      await rendered(page, 'a'); await rendered(page, 'b');
      const bounds = await page.locator('iframe[title="Palette A preview"]').boundingBox();
      assert.equal(bounds.y, width === 390 ? 52 : 0); assert.equal(bounds.height, width === 390 ? 792 : 1000);
      assert.ok(Math.abs(bounds.width - (width === 390 ? width : (width - 1) / 2)) < 1);
      await audit(page, 'opened', width, theme);
      await options(page); await audit(page, 'options', width, theme); await page.keyboard.press('Escape');
      assert.equal(readComparison(new URL(page.url()).search).nameA, 'Launch colors');
      let picker = await openSaved(page, 'b');
      assert.equal(await picker.getByRole('tab', { name: 'Saved', exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await picker.locator('.saved-row .home-thumbnail').count(), 4); await audit(page, 'saved-picker', width, theme);
      await picker.getByRole('button', { name: 'Apply Ocean option', exact: true }).click();
      await picker.getByRole('button', { name: 'Close palettes', exact: true }).click();
      if (width === 390) await page.getByRole('button', { name: 'Show palette A', exact: true }).click();
      picker = await openSaved(page, 'a');
      await picker.getByRole('button', { name: 'Apply Night review', exact: true }).click();
      await page.waitForFunction(() => new URLSearchParams(location.search).get('nameA') === 'Night review');
      const selected = readComparison(new URL(page.url()).search);
      assert.equal(selected.nameA, 'Night review'); assert.equal(selected.nameB, 'Ocean option');
      assert.deepEqual(selected.a, paletteForMode(saved[3].colors, selected.mode)); assert.deepEqual(selected.b, paletteForMode(saved[2].colors, selected.mode));
      await picker.getByRole('searchbox', { name: 'Search palettes', exact: true }).fill('no-match-palette');
      await audit(page, 'search-empty', width, theme);
      await picker.getByRole('button', { name: 'Close palettes', exact: true }).click();
      for (const mode of ['dark', 'light', 'dark', 'light'] as const) {
        await setMode(page, mode === 'light' ? 'Light' : 'Dark');
        const current = readComparison(new URL(page.url()).search);
        assert.equal(current.mode, mode); assert.deepEqual(current.a, selected.a); assert.deepEqual(current.b, selected.b);
        await rendered(page, 'a'); await rendered(page, 'b');
        await audit(page, `mode-${mode}`, width, theme);
      }
      const beforeToggle = readComparison(new URL(page.url()).search);
      await (await rendered(page, 'a')).evaluate(() => window.parent.postMessage({ type: 'preview-toggle-theme' }, window.location.origin));
      await page.waitForFunction(before => new URLSearchParams(location.search).get('mode') !== before, beforeToggle.mode);
      const afterToggle = readComparison(new URL(page.url()).search);
      assert.deepEqual(afterToggle.a, beforeToggle.a); assert.deepEqual(afterToggle.b, beforeToggle.b);
      await rendered(page, 'a'); await rendered(page, 'b'); await audit(page, 'preview-theme-toggle', width, theme);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('hue-palettes-v1'))), saved);
      await setMode(page, theme === 'light' ? 'Light' : 'Dark');
      for (const preview of previewCatalog.filter(item => !process.env.COMPARE_QUICK || item.id === 'infrastructure')) {
        await options(page);
        await page.getByLabel('Preview', { exact: true }).selectOption(preview.id);
        await page.keyboard.press('Escape');
        await rendered(page, 'a'); await rendered(page, 'b');
        await audit(page, `preview-${preview.id}`, width, theme, true);
        if (preview.id === 'workspace') {
          if (width === 1440) await page.setViewportSize({ width, height: 700 });
          const panes = { a: await rendered(page, 'a'), b: await rendered(page, 'b') };
          for (const side of ['a', 'b'] as const) {
            if (width === 390) await page.getByRole('button', { name: `Show palette ${side.toUpperCase()}`, exact: true }).click();
            const frame = panes[side];
            const open = frame.getByRole('button', { name: 'Open sidebar', exact: true });
            if (await open.isVisible()) await open.click();
            await frame.locator('.rail [data-nav=space]').click();
            await frame.getByRole('heading', { name: 'All', exact: true }).waitFor();
          }
          await panes.a.locator('.main').evaluate(node => node.scrollTo({ top: (node.scrollHeight - node.clientHeight) * 0.4, behavior: 'instant' }));
          await panes.b.waitForFunction(() => { const node = document.querySelector('.main'); return Math.abs(node.scrollTop / (node.scrollHeight - node.clientHeight) - 0.4) < 0.02; });
          await panes.b.locator('.main').evaluate(node => node.scrollTo({ top: (node.scrollHeight - node.clientHeight) * 0.6, behavior: 'instant' }));
          await panes.a.waitForFunction(() => { const node = document.querySelector('.main'); return Math.abs(node.scrollTop / (node.scrollHeight - node.clientHeight) - 0.6) < 0.02; });
          await setMode(page, theme === 'light' ? 'Dark' : 'Light');
          for (const side of ['a', 'b'] as const) {
            await panes[side].getByRole('heading', { name: 'All', exact: true }).waitFor();
            const state = readComparison(new URL(page.url()).search);
            await panes[side].waitForFunction(background => document.documentElement.style.getPropertyValue('--p-background') === background, paletteForMode(state[side], state.mode).background);
            await panes[side].waitForFunction(() => { const node = document.querySelector('.main'); return Math.abs(node.scrollTop / (node.scrollHeight - node.clientHeight) - 0.6) < 0.02; });
          }
          await setMode(page, theme === 'light' ? 'Light' : 'Dark');
          if (width === 1440) await page.setViewportSize({ width, height: 1000 });
        }
        if (preview.id === 'avenlo') {
          const source = await rendered(page, 'a');
          await source.evaluate(() => { const node = document.scrollingElement; node.scrollTo({ top: (node.scrollHeight - node.clientHeight) * 0.3, behavior: 'instant' }); });
          const target = await rendered(page, 'b');
          await target.waitForFunction(() => { const node = document.scrollingElement; return Math.abs(node.scrollTop / (node.scrollHeight - node.clientHeight) - 0.3) < 0.02; });
          await target.evaluate(() => { const node = document.scrollingElement; node.scrollTo({ top: (node.scrollHeight - node.clientHeight) * 0.5, behavior: 'instant' }); });
          await source.waitForFunction(() => { const node = document.scrollingElement; return Math.abs(node.scrollTop / (node.scrollHeight - node.clientHeight) - 0.5) < 0.02; });
          await setMode(page, theme === 'light' ? 'Dark' : 'Light');
          for (const side of ['a', 'b'] as const) {
            const frame = await rendered(page, side);
            await frame.waitForFunction(() => { const node = document.scrollingElement; return Math.abs(node.scrollTop / (node.scrollHeight - node.clientHeight) - 0.5) < 0.02; });
          }
          await audit(page, 'scroll-preserved', width, theme);
          await setMode(page, theme === 'light' ? 'Light' : 'Dark');
        }
      }
      await options(page);
      await page.getByRole('button', { name: 'Copy comparison link', exact: true }).click();
      const link = await page.evaluate(() => navigator.clipboard.readText());
      const shared = readComparison(new URL(link).search);
      assert.deepEqual(shared, readComparison(new URL(page.url()).search));
      assert.equal(shared.heading, 'Arial'); assert.equal(shared.body, 'Verdana');
      await audit(page, 'copied', width, theme);
      const fresh = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const recipient = await fresh.newPage();
      await recipient.goto(link); await recipient.locator('[data-app-ready]').waitFor();
      assert.deepEqual(readComparison(new URL(recipient.url()).search), shared);
      assert.equal(await recipient.evaluate(() => localStorage.getItem('hue-palettes-v1')), null);
      await rendered(recipient, 'a'); await rendered(recipient, 'b'); await audit(recipient, 'recipient', width, theme);
      if (width === 390) await recipient.getByRole('button', { name: 'Show palette A', exact: true }).click();
      const recipientPicker = await openSaved(recipient, 'a');
      assert.equal(await recipientPicker.getByRole('tab', { name: 'Saved', exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await recipientPicker.locator('.saved-row').count(), 0); await audit(recipient, 'saved-empty', width, theme);
      await recipientPicker.getByRole('button', { name: 'Close palettes', exact: true }).click();
      await recipient.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); }; document.execCommand = () => false; });
      await options(recipient);
      await recipient.getByRole('button', { name: 'Copy comparison link', exact: true }).click();
      assert.equal(await recipient.getByRole('status').innerText(), 'Select and copy the comparison link.');
      const selection = await recipient.getByLabel('Comparison link', { exact: true }).evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd, e.value.length]);
      assert.deepEqual(selection, [0, selection[2], selection[2]]); await audit(recipient, 'clipboard-denied', width, theme);
      await recipient.keyboard.press('Escape');
      if (width === 390) await recipient.getByRole('button', { name: 'Show palette B', exact: true }).click();
      await options(recipient, 'b');
      await recipient.getByRole('link', { name: 'Use palette B', exact: true }).click();
      await recipient.waitForURL(url => url.pathname === previewCatalog.find(item => item.id === shared.preview).path);
      await recipient.locator('[data-app-ready]').waitFor();
      assert.deepEqual(new URLSearchParams(new URL(recipient.url()).search).get('colors'), new URLSearchParams(paletteQuery(paletteForMode(shared.b, shared.mode))).get('colors'));
      await recipient.getByRole('region', { name: 'Color toolbar', exact: true }).waitFor();
      await fresh.close();
      actions.push({ width, theme, passed: true }); console.log(width, theme, 'passed');
    } catch (error) {
      actions.push({ width, theme, passed: false, error: error.message }); console.error(width, theme, error.message);
      await page.screenshot({ path: `${output}/failed-${width}-${theme}.png` }).catch(() => {});
    } finally { await context.close(); }
  }
} finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify({ actions, reports, errors }, null, 2)); }
assert.deepEqual(actions.filter(item => !item.passed), []); assert.deepEqual(errors, []);
const findings = reports.reduce((count, item) => count + item.report.findings.length, 0);
console.log(`${actions.length} flows, ${reports.length} UI checks, ${findings} findings.`); if (findings) process.exitCode = 1;
