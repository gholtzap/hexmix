import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { clickToolbarAction } from './lib/studio-toolbar.mts';
import { defaultDarkPalette, initialPalette, paletteQuery, readPalette } from '../src/lib/palette.ts';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const directory = 'artifacts/home';
await mkdir(directory, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch();
const reports = [], errors = [];
let completed = false;
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    const palette = theme === 'dark' ? defaultDarkPalette : initialPalette;
    const audit = async state => {
      await page.mouse.move(1, 1);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
      let report = { findings: [] };
      try { await expectUI(page, { attach: async (_, data) => { report = JSON.parse(String(data.body)); } }, policy); }
      finally { reports.push({ width, theme, state, report }); }
      await page.screenshot({ path: `${directory}/${width}-${theme}-${state}.png` });
    };
    const current = () => readPalette(new URL(page.url()).search);
    const checkLinks = async () => {
      const links = await page.locator('.home-preview-link').evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).href));
      assert.equal(links.length, 6);
      for (const href of links) {
        assert.deepEqual(readPalette(new URL(href).search), current());
        assert.equal(new URL(href).searchParams.get('heading'), new URL(page.url()).searchParams.get('heading'));
        assert.equal(new URL(href).searchParams.get('body'), new URL(page.url()).searchParams.get('body'));
      }
    };
    await page.goto(`${base}/?${paletteQuery(palette)}&heading=System&body=System`);
    await page.locator('[data-app-ready]').waitFor();
    assert.deepEqual(current(), palette);
    assert.equal(await page.locator('.home-palette, .home-fonts, iframe').count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Color toolbar', exact: true }).count(), 1);
    assert.deepEqual(await page.locator('.home-preview-group > h3').allTextContents(), ['Homepages', 'Dashboards']);
    await audit('toolbar');
    await page.locator('.home-preview-card').last().scrollIntoViewIfNeeded();
    const toolbarTop = await page.locator('.toolbar-anchor').evaluate(node => node.getBoundingClientRect().top);
    assert.ok(await page.locator('.home-preview-card').last().evaluate((node, top) => node.getBoundingClientRect().bottom <= top, toolbarTop), 'The last preview must remain above the toolbar');
    await audit('last-preview');
    for (const role of ['Text', 'Background', 'Primary', 'Secondary', 'Accent']) {
      await page.getByRole('button', { name: `${role} color`, exact: true }).click();
      await page.getByRole('dialog', { name: `${role} color`, exact: true }).waitFor();
      if (role === 'Primary') {
        const hex = page.getByRole('textbox', { name: 'Hex', exact: true });
        await hex.fill('123456'); await hex.press('Enter');
        assert.equal(current().primary, '#123456');
        await checkLinks();
      }
      await audit(`${role.toLowerCase()}-picker`);
      await page.getByRole('button', { name: 'Close color picker', exact: true }).click();
    }
    await clickToolbarAction(page, 'Fonts');
    await page.getByLabel('Headings', { exact: true }).selectOption('Arial');
    await page.getByLabel('Body', { exact: true }).selectOption('Verdana');
    await checkLinks(); await audit('fonts');
    await page.getByRole('button', { name: 'Close fonts', exact: true }).click();
    const before = current();
    await clickToolbarAction(page, 'Shuffle palette');
    const shuffled = current(); assert.notDeepEqual(shuffled, before);
    await clickToolbarAction(page, 'Undo palette'); assert.deepEqual(current(), before);
    await clickToolbarAction(page, 'Redo palette'); assert.deepEqual(current(), shuffled);
    await clickToolbarAction(page, 'Palettes');
    await page.getByRole('tab', { name: 'Saved', exact: true }).click(); await audit('saved-empty');
    await page.getByRole('button', { name: 'Save palette', exact: true }).click();
    await page.getByLabel('Palette name', { exact: true }).fill(' ');
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await audit('name-error');
    await page.getByLabel('Palette name', { exact: true }).fill('Home colors');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Apply Home colors', exact: true }).waitFor(); await audit('saved');
    await page.locator('.toast').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Browse all palettes', exact: true }).click();
    await page.getByRole('tab', { name: 'Presets', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search palettes', exact: true }).fill('nothing-matches-this'); await audit('search-empty');
    await page.getByRole('button', { name: 'Close palettes', exact: true }).click();
    await clickToolbarAction(page, 'Export palette');
    for (const format of ['css', 'tailwind', 'json']) {
      await page.getByLabel('Format', { exact: true }).selectOption(format); await audit(`${format}-export`);
    }
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await clickToolbarAction(page, 'Share palette');
    assert.deepEqual(readPalette(new URL(await page.evaluate(() => navigator.clipboard.readText())).search), current());
    await clickToolbarAction(page, 'Hide color toolbar'); await audit('toolbar-hidden');
    await page.getByRole('button', { name: 'Open color toolbar', exact: true }).click();
    await checkLinks();
    await page.reload(); await page.locator('[data-app-ready]').waitFor();
    assert.deepEqual(current(), shuffled);
    await clickToolbarAction(page, 'Palettes');
    await page.getByRole('tab', { name: 'Saved', exact: true }).click();
    await page.getByRole('button', { name: 'Apply Home colors', exact: true }).waitFor();
    await context.close();
  }
  assert.deepEqual(errors, []);
  completed = true;
} finally {
  await browser.close();
  await writeFile(`${directory}/report.json`, JSON.stringify({ completed, reports, errors }, null, 2));
}
console.log(`Checked homepage toolbar: ${reports.length} UI states; no findings.`);
