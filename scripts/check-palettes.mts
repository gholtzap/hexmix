import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, paletteQuery, presets, quickPickPresets, roles } from '../src/lib/palette.ts';

const directory = 'artifacts/palettes';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const reports = [];
const failures = [];
let completed = false;
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const audit = async state => {
      let report = { state, viewport, findings: [] };
      try {
        await expectUI(page, { attach: async (_, attachment) => {
          report = { state, ...JSON.parse(String(attachment.body)) };
        } });
      } catch (error) {
        failures.push(`${viewport.width} ${state}: ${error.message}`);
      }
      reports.push(report);
    };
    const open = async () => {
      await page.getByRole('button', { name: 'Palettes', exact: true }).click();
      await page.getByRole('dialog', { name: 'Palettes', exact: true }).waitFor();
    };
    const close = async () => {
      await page.getByRole('button', { name: 'Close palettes', exact: true }).click();
      await page.locator('.palette-panel').waitFor({ state: 'hidden' });
    };
    const tab = name => page.getByRole('tab', { name, exact: true });
    const apply = name => page.getByRole('button', { name: `Apply ${name}`, exact: true });
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('hue-palettes-v1')));
    const preview = () => page.locator('iframe').evaluate(frame => Object.fromEntries(['text', 'background', 'primary', 'secondary', 'accent'].map(role => [role, (frame as HTMLIFrameElement).contentDocument.documentElement.style.getPropertyValue(`--p-${role}`)])));
    const remove = async name => {
      await page.getByRole('button', { name: `More actions for ${name}`, exact: true }).click();
      await page.getByRole('menuitem', { name: 'Remove palette', exact: true }).waitFor();
      await audit('remove menu open');
      await page.getByRole('menuitem', { name: 'Remove palette', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab');
      assert.equal(await page.locator('.palette-panel').isVisible(), true);
    };

    await page.goto(`http://127.0.0.1:3000/editor?${paletteQuery(initialPalette)}`);
    await page.locator('[data-app-ready]').waitFor();
    await open();
    assert.equal(await tab('Presets').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.palette-card:visible').count(), Math.min(presets.length, 6));
    await page.mouse.move(5, 5);
    await audit('presets');
    await page.screenshot({ path: `${directory}/${viewport.width}-presets.png` });
    await page.getByRole('button', { name: 'Browse all palettes', exact: true }).click();
    await audit('preset browser');
    const search = page.getByRole('searchbox', { name: 'Search palettes', exact: true });
    await search.fill('Sanzo Wada');
    await page.getByText('348 palettes', { exact: true }).waitFor();
    assert.equal(await page.locator('.palette-card:visible').count(), 24);
    await audit('Sanzo catalog');
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    assert.equal(await page.locator('.palette-card:visible').count(), 48);
    for (const number of [1, 348]) {
      await search.fill(`Sanzo Wada ${number}`);
      await apply(`Sanzo Wada ${number}`).click();
      assert.deepEqual(await preview(), presets.find(item => item.id === `sanzo-wada-${number}`).colors);
      assert.equal(await apply(`Sanzo Wada ${number}`).getAttribute('aria-pressed'), 'true');
      await audit(`Sanzo ${number} applied`);
    }
    await page.screenshot({ path: `${directory}/${viewport.width}-sanzo.png` });
    await search.fill('');
    await apply('Blue hour').focus();
    await audit('palette keyboard focus');
    await page.keyboard.press('Enter');
    assert.deepEqual(await preview(), presets.find(item => item.name === 'Blue hour').colors);
    await page.mouse.move(5, 5);
    await page.getByRole('button', { name: 'Quick picks', exact: true }).click();
    await tab('Presets').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await tab('Saved').getAttribute('aria-selected'), 'true');
    await page.getByText('No saved palettes yet.', { exact: true }).waitFor();
    await audit('saved empty');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await tab('Presets').getAttribute('aria-selected'), 'true');
    await apply('Blue hour').click();
    assert.deepEqual(await preview(), presets.find(item => item.name === 'Blue hour').colors);
    assert.equal(await apply('Blue hour').getAttribute('aria-pressed'), 'true');
    await audit('preset applied');
    await page.getByRole('button', { name: 'Save palette', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await tab('Saved').getAttribute('aria-selected'), 'true');
    assert.equal(await apply('My palette 1').getAttribute('aria-pressed'), 'true');
    assert.equal((await saved()).length, 1);
    await audit('saved applied');
    await page.getByRole('button', { name: 'Save palette', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal((await saved()).length, 1, 'Saving the same colors must not create a duplicate');
    await page.getByText('This palette is already saved.', { exact: true }).waitFor();
    await audit('duplicate notice');
    await tab('Presets').click();
    await apply('Garden party').click();
    await page.getByRole('button', { name: 'Save palette', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal((await saved()).length, 2);
    await remove('My palette 1');
    assert.equal((await saved())[0].name, 'My palette 2');
    await tab('Presets').click();
    await apply('Plum perfect').click();
    await page.getByRole('button', { name: 'Save palette', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
    const names = (await saved()).map(item => item.name);
    assert.equal(new Set(names).size, 2, 'Names must stay unique after removing and saving');
    const newName = names.find(name => name !== 'My palette 2');
    await apply('My palette 2').click();
    assert.deepEqual(await preview(), presets.find(item => item.name === 'Garden party').colors);
    await page.mouse.move(5, 5);
    await audit('saved reapplied');
    await page.locator('.toast').waitFor({ state: 'hidden' });
    await page.screenshot({ path: `${directory}/${viewport.width}-saved.png` });
    await close();
    await page.reload();
    await page.locator('[data-app-ready]').waitFor();
    await open();
    await tab('Saved').click();
    await page.waitForFunction(() => document.querySelectorAll('.palette-card').length === 2);
    assert.equal(await page.locator('.palette-card:visible').count(), 2, 'Saved palettes must survive a reload');
    await remove(newName);
    await remove('My palette 2');
    await page.getByText('No saved palettes yet.', { exact: true }).waitFor();
    assert.deepEqual(await saved(), []);
    await audit('last palette removed');
    await page.keyboard.press('Escape');
    await page.locator('.palette-panel').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Palettes');

    await page.getByRole('button', { name: 'Use dark palette', exact: true }).click();
    await open();
    await tab('Presets').click();
    await page.mouse.move(5, 5);
    await audit('dark preview');
    await close();
    await page.getByRole('button', { name: 'Primary color', exact: true }).click();
    await page.getByRole('button', { name: 'Palettes', exact: true }).click();
    await page.locator('.palette-panel').waitFor();
    assert.equal(await page.locator('.color-picker-content').count(), 0);
    await page.getByRole('button', { name: 'Primary color', exact: true }).click();
    await page.locator('.color-picker-content').waitFor();
    assert.equal(await page.locator('.palette-panel').count(), 0);
    await page.getByRole('button', { name: 'Close color picker', exact: true }).click();
    await open();
    await page.locator('iframe').contentFrame().locator('body').click({ position: { x: 10, y: 10 } });
    await page.locator('.palette-panel').waitFor({ state: 'hidden' });

    // Check existing storage records, including long names and a full collection.
    const collection = Array.from({ length: 24 }, (_, i) => ({
      name: i === 0 ? 'A saved palette with a long name' : `My palette ${i + 1}`,
      colors: quickPickPresets[i % quickPickPresets.length].colors,
    }));
    await page.evaluate(items => localStorage.setItem('hue-palettes-v1', JSON.stringify(items)), collection);
    await page.reload();
    await page.locator('[data-app-ready]').waitFor();
    await open();
    await tab('Saved').click();
    await page.getByRole('button', { name: 'Browse all palettes', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.palette-card').length === 24);
    assert.equal(await page.locator('.palette-card:visible').count(), 24);
    await apply('My palette 24').scrollIntoViewIfNeeded();
    await apply('My palette 24').click();
    await page.mouse.move(5, 5);
    await audit('full saved collection');
    await page.getByRole('button', { name: 'More actions for My palette 24', exact: true }).click();
    await audit('scrolled remove menu');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.palette-panel').isVisible(), true, 'Escape must close the menu before the panel');
    await close();

    const large = Array.from({ length: 3000 }, (_, i) => ({ name: `Collection ${i + 1}`, colors: quickPickPresets[i % quickPickPresets.length].colors }));
    await page.evaluate(items => localStorage.setItem('hue-palettes-v1', JSON.stringify(items)), large);
    await page.reload();
    await page.locator('[data-app-ready]').waitFor();
    await open();
    await tab('Saved').click();
    assert.equal(await page.locator('.palette-card:visible').count(), 6);
    await page.getByRole('button', { name: 'Browse all palettes', exact: true }).click();
    assert.equal(await page.locator('.palette-card:visible').count(), 24);
    assert.equal((await saved()).length, 3000);
    await audit('3000 palettes first batch');
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    assert.equal(await page.locator('.palette-card:visible').count(), 48);
    await apply('Collection 48').click();
    const scrollBefore = await page.getByRole('tabpanel').evaluate(node => node.scrollTop);
    await close();
    await open();
    assert.equal(await page.locator('.palette-card:visible').count(), 48);
    assert.equal(await page.getByRole('tabpanel').evaluate(node => node.scrollTop), scrollBefore);
    await page.getByRole('searchbox', { name: 'Search palettes', exact: true }).fill('blue pastel');
    await page.getByLabel('Color', { exact: true }).selectOption('blue');
    await page.getByLabel('Theme', { exact: true }).selectOption('light');
    await page.getByLabel('Style', { exact: true }).selectOption('pastel');
    await page.getByRole('status').filter({ hasText: '600 palettes' }).waitFor();
    await audit('combined search and filters');
    await page.screenshot({ path: `${directory}/${viewport.width}-browser.png` });
    await page.getByRole('searchbox').fill('Collection 2998');
    await apply('Collection 2998').waitFor();
    await apply('Collection 2998').click();
    assert.deepEqual(await preview(), presets[2].colors);
    await remove('Collection 2998');
    assert.equal((await saved()).length, 2999);
    assert.equal((await saved()).some(item => item.name === 'Collection 2998'), false);
    assert.equal((await saved()).some(item => item.name === 'Collection 1'), true);
    await page.getByText('No palettes match your search.', { exact: true }).waitFor();
    await audit('no search results');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    assert.equal(await page.getByRole('searchbox').inputValue(), '');
    assert.equal(await page.getByLabel('Theme', { exact: true }).inputValue(), '');
    await page.getByLabel('Theme', { exact: true }).selectOption('dark');
    await apply('Collection 5').click();
    await audit('dark filtered results');
    await close();
    await page.reload();
    await page.locator('[data-app-ready]').waitFor();
    assert.equal((await saved()).length, 2999);

    await page.evaluate(() => localStorage.setItem('hue-palettes-v1', 'invalid json'));
    await page.reload();
    await page.locator('[data-app-ready]').waitFor();
    await page.getByText('Saved palettes could not be loaded.', { exact: true }).waitFor();
    await open();
    await tab('Saved').click();
    await audit('storage read error');
    await close();
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'hue-palettes-v1') throw new DOMException('Storage unavailable', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });
    await open();
    await page.getByRole('button', { name: 'Save palette', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Your browser could not save this palette.', { exact: true }).waitFor();
    await audit('storage write error');
    assert.deepEqual(errors, []);
    await context.close();
  }
  completed = true;
} finally {
  await browser.close();
  await writeFile(`${directory}/report.json`, JSON.stringify({ completed, reports, failures }, null, 2));
}
assert.deepEqual(failures, []);
console.log(`Passed palette actions and ${reports.length} UI states. Report: ${directory}/report.json`);
