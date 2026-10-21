import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { fonts, fontPairs } from '../src/lib/fonts.ts';
import { defaultDarkPalette, isDarkPalette, readPalette, presets, roles } from '../src/lib/palette.ts';
const directory = 'artifacts/home';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const reports = [];
const failures = [];
let completed = false;
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
    const audit = async state => {
      let report;
      try { await expectUI(page, { attach: async (_, data) => { report = JSON.parse(String(data.body)); } }); }
      catch (error) { failures.push(`${viewport.width} ${state}: ${error.message}`); }
      reports.push({ viewport, state, report });
    };
    await page.goto('http://127.0.0.1:3000');
    await page.locator('[data-app-ready]').waitFor();
    assert.equal(await page.locator('.home-preview-card').count(), 6);
    assert.deepEqual(await page.locator('.home-preview-card h3').allTextContents(), ['AI Chatbot', 'Avenlo', 'Tervix', 'Orvian', 'Nuvexa', 'Infra Dashboard']);
    assert.equal(await page.getByRole('button', { name: 'Use light palette', exact: true }).count(), 1);
    assert.equal(await page.locator('body').evaluate(node => getComputedStyle(node).colorScheme), 'dark');
    await audit('homepage all previews');
    await page.screenshot({ path: `${directory}/${viewport.width}-home.png`, fullPage: true });
    await page.locator('.home-preview-card').last().scrollIntoViewIfNeeded();
    await audit('gallery lower cards');
    await page.screenshot({ path: `${directory}/${viewport.width}-gallery.png` });
    await page.locator('.home-page').evaluate(node => { node.scrollTop = 0; });
    for (const mode of ['dark', 'light']) {
      if (mode === 'light') await page.getByRole('button', { name: 'Use light palette', exact: true }).click();
      const colorsBeforeFonts = readPalette(new URL(page.url()).search) ?? defaultDarkPalette;
      for (const pair of fontPairs) {
        const selector = page.getByRole('combobox', { name: 'Font pair', exact: true });
        await selector.selectOption(`${pair.heading}|${pair.body}`);
        assert.equal(await selector.inputValue(), `${pair.heading}|${pair.body}`);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(new URL(page.url()).searchParams.get('heading'), pair.heading);
        assert.equal(new URL(page.url()).searchParams.get('body'), pair.body);
        assert.deepEqual(readPalette(new URL(page.url()).search), colorsBeforeFonts);
        const normalizeFont = value => value.replaceAll('"', '').replaceAll("'", '');
        assert.equal(normalizeFont(await page.locator('.home-intro h1').evaluate(node => getComputedStyle(node).fontFamily)), normalizeFont(fonts[pair.heading]));
        for (const href of await page.locator('.home-preview-link').evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).href))) {
          assert.equal(new URL(href).searchParams.get('heading'), pair.heading);
          assert.equal(new URL(href).searchParams.get('body'), pair.body);
        }
        await audit(`${mode} font pair ${pair.heading} and ${pair.body}`);
      }
      await page.screenshot({ path: `${directory}/${viewport.width}-${mode}-font-pairs.png`, fullPage: true });

      await page.getByRole('button', { name: 'Browse palettes', exact: true }).click();
      const search = page.getByRole('searchbox', { name: 'Search palettes', exact: true });
      await search.waitFor();
      await page.getByRole('tab', { name: 'Presets', exact: true }).click();
      await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('');
      await audit(`${mode} homepage palette browser`);
      await page.screenshot({ path: `${directory}/${viewport.width}-${mode}-palette-browser.png` });
      await page.getByRole('button', { name: 'Load more', exact: true }).click();
      assert.equal(await page.locator('.palette-card:visible').count(), 48);
      await search.fill('no-palette-matches-this');
      await page.getByText('No palettes match your search.', { exact: true }).waitFor();
      await audit(`${mode} homepage palette search empty`);
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(mode);
      const selectedName = await page.locator('.palette-card-caption').first().innerText();
      const chosen = presets.find(item => item.name === selectedName.trim()).colors;
      await page.getByRole('button', { name: `Apply ${selectedName.trim()}`, exact: true }).click();
      assert.deepEqual(readPalette(new URL(page.url()).search), chosen);
      for (const role of roles) assert.equal(await page.getByRole('button', { name: `${role[0].toUpperCase() + role.slice(1)} ${chosen[role]}`, exact: true }).count(), 1);
      assert.deepEqual(await page.locator('.home-preview-link').evaluateAll(nodes => nodes.map(node => new URL((node as HTMLAnchorElement).href).searchParams.get('colors'))), Array(6).fill(new URL(page.url()).searchParams.get('colors')));
      await audit(`${mode} homepage preset applied`);
      await page.getByRole('tab', { name: 'Saved', exact: true }).click();
      await audit(`${mode} homepage saved palettes`);
      await page.getByRole('button', { name: 'Save palette', exact: true }).click();
      const nameField = page.getByRole('textbox', { name: 'Palette name', exact: true });
      await nameField.fill(`  ${mode} study  `);
      await audit(`${mode} name palette form`);
      await nameField.press('Enter');
      await page.getByRole('button', { name: `Apply ${mode} study`, exact: true }).waitFor();
      const storedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('hue-palettes-v1'))[0]);
      assert.equal(storedBefore.name, `${mode} study`);
      assert.deepEqual(storedBefore.colors, chosen);
      assert.equal(await page.locator('.saved-row .home-thumbnail').count(), mode === 'dark' ? 1 : 2);
      const openRename = async () => {
        await page.getByRole('button', { name: `More actions for ${mode} study`, exact: true }).click();
        await audit(`${mode} saved palette menu`);
        await page.getByRole('menuitem', { name: 'Rename palette', exact: true }).click();
        await nameField.waitFor();
      };
      await openRename();
      await nameField.fill('Cancelled name');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: `Apply ${mode} study`, exact: true }).waitFor();
      await openRename();
      await nameField.fill('   ');
      await page.getByRole('button', { name: 'Save name', exact: true }).click();
      await page.getByText('Enter a palette name.', { exact: true }).waitFor();
      await audit(`${mode} blank palette name error`);
      await nameField.fill(`${mode} collection`);
      await audit(`${mode} rename palette form`);
      await nameField.press('Enter');
      await page.getByRole('button', { name: `Apply ${mode} collection`, exact: true }).waitFor();
      const storedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('hue-palettes-v1'))[0]);
      assert.deepEqual(storedAfter, { ...storedBefore, name: `${mode} collection` });
      await audit(`${mode} homepage palette saved`);
      await page.screenshot({ path: `${directory}/${viewport.width}-${mode}-saved-designs.png` });
      await page.getByRole('button', { name: 'Close palettes', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.textContent === 'Browse palettes');
    }
    await page.getByRole('button', { name: 'Use dark palette', exact: true }).click();
    await page.reload();
    await page.locator('[data-app-ready]').waitFor();
    await page.getByRole('button', { name: 'Browse palettes', exact: true }).click();
    await page.getByRole('tab', { name: 'Saved', exact: true }).click();
    await page.getByRole('button', { name: 'Apply dark collection', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Apply light collection', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.palette-card').length === 2);
    assert.equal(await page.locator('.palette-card:visible').count(), 2, 'Homepage saves must survive reload');
    await page.keyboard.press('Escape');

    for (const role of ['Text', 'Background', 'Primary', 'Secondary', 'Accent']) {
      await page.getByRole('button', { name: new RegExp(`^${role} `) }).click();
      await page.getByRole('textbox', { name: 'Hex', exact: true }).waitFor();
      await audit(`${role.toLowerCase()} picker open`);
      if (role === 'Primary') {
        await page.getByRole('textbox', { name: 'Hex', exact: true }).fill('123456');
        await page.getByRole('textbox', { name: 'Hex', exact: true }).press('Enter');
      }
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    }
    assert.equal(readPalette(new URL(page.url()).search).primary, '#123456');
    assert.deepEqual(await page.locator('.home-thumbnail').evaluateAll(nodes => nodes.map(node => node.querySelector('feFlood[result="primary-color"]').getAttribute('flood-color'))), Array(6).fill('#123456'));
    await page.getByRole('button', { name: 'Homepages', exact: true }).click();
    assert.equal(await page.locator('.home-preview-card').count(), 4);
    await audit('homepages category');
    await page.getByRole('button', { name: 'Dashboards', exact: true }).click();
    assert.equal(await page.locator('.home-preview-card').count(), 2);
    await audit('dashboards category');
    await page.getByRole('button', { name: 'Use light palette', exact: true }).click();
    assert.equal(isDarkPalette(readPalette(new URL(page.url()).search)), false);
    await audit('light palette');
    await page.getByRole('button', { name: 'Use dark palette', exact: true }).click();
    assert.equal(isDarkPalette(readPalette(new URL(page.url()).search)), true);
    await page.getByRole('button', { name: 'Random', exact: true }).click();
    const selected = readPalette(new URL(page.url()).search);
    assert.equal(isDarkPalette(selected), true, 'Random must keep dark mode');
    await audit('dark palette');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await audit('dark all previews');
    const links = await page.locator('.home-preview-link').evaluateAll(nodes => nodes.map(node => ({ name: node.textContent, href: (node as HTMLAnchorElement).href })));
    for (const { href } of links) assert.deepEqual(readPalette(new URL(href).search), selected);
    const homeURL = page.url();
    await page.getByRole('link', { name: 'AI Chatbot', exact: true }).click();
    await page.locator('[data-app-ready]').waitFor();
    await page.frameLocator('iframe').locator('html[data-editor-ready="true"]').waitFor();
    const lastPair = fontPairs.at(-1);
    await page.waitForFunction(pair => {
      const root = document.querySelector('iframe')?.contentDocument?.documentElement;
      return root?.style.getPropertyValue('--p-heading-font') === pair.heading && root.style.getPropertyValue('--p-body-font') === pair.body;
    }, { heading: fonts[lastPair.heading], body: fonts[lastPair.body] });

    await page.waitForFunction(color => document.querySelector('iframe')?.contentDocument?.documentElement.style.getPropertyValue('--p-primary') === color, selected.primary);
    await page.goBack();
    await page.locator('[data-app-ready]').waitFor();
    assert.deepEqual(readPalette(new URL(page.url()).search), selected);
    for (const { href } of links.filter(({ href }) => !href.includes('/dashboards/'))) {
      await page.goto(homeURL);
      await page.locator('[data-app-ready]').waitFor();
      await page.locator(`a[href="${new URL(href).pathname}${new URL(href).search}"]`).click();
      await page.locator('[data-app-ready]').waitFor();
      assert.deepEqual(readPalette(new URL(page.url()).search), selected);
      const frame = page.frameLocator('iframe');
      await frame.locator('html[data-editor-site]').waitFor();
      assert.equal(await frame.locator('html').evaluate(node => node.style.getPropertyValue('--p-primary')), selected.primary);
    }
    await page.goto('http://127.0.0.1:3000/editor');
    await page.locator('[data-app-ready]').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Use light palette', exact: true }).count(), 1);
    await audit('blank editor default dark');
    await page.getByRole('button', { name: 'Palettes', exact: true }).click();
    await page.getByRole('tab', { name: 'Saved', exact: true }).click();
    await page.getByRole('button', { name: 'Apply dark collection', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Apply light collection', exact: true }).waitFor();
    await audit('editor shared named palettes');
    assert.deepEqual(errors, []);
    await page.close();
  }
  completed = true;
} finally {
  await browser.close();
  await writeFile(`${directory}/report.json`, JSON.stringify({ completed, reports, failures }, null, 2));
}
assert.deepEqual(failures, []);
console.log(`Checked homepage actions and ${reports.length} UI states. Report: ${directory}/report.json`);
