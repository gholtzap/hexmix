import { clickToolbarAction } from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { checkPage } from 'lintapple';
import uiPolicy from '../ui-policy.json' with { type: 'json' };
import { fonts } from '../src/lib/fonts.ts';
import { previewCatalog, previewHref } from '../src/lib/preview-catalog.ts';
import { defaultDarkPalette, initialPalette } from '../src/lib/palette.ts';

const directory = 'artifacts/fonts';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const reports = [];
const checks = [];
const errors = [];
let completed = false;
const normalize = value => value.replaceAll('"', '').replaceAll("'", '');
const loadFont = async (surface, name) => {
  if (['System', 'Arial', 'Verdana'].includes(name)) return;
  const result = await surface.evaluate(async name => {
    const regular = await document.fonts.load(`400 16px "${name}"`);
    const medium = await document.fonts.load(`500 24px "${name}"`);
    return [...regular, ...medium].every(font => font.status === 'loaded') && regular.length > 0 && medium.length > 0;
  }, name);
  assert.equal(result, true, `${name} must load its font file`);
};
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => {
      if (/\/fonts\/|\/font-catalog\.js/.test(request.url())) errors.push(`${request.url()}: ${request.failure()?.errorText}`);
    });
    await page.goto('http://127.0.0.1:3000/');
    await page.locator('[data-app-ready]').waitFor();
    await clickToolbarAction(page, 'Fonts');
    for (const name of Object.keys(fonts)) {
      await page.getByRole('combobox', { name: 'Headings', exact: true }).selectOption(name);
      await page.getByRole('combobox', { name: 'Body', exact: true }).selectOption(name);
      await loadFont(page, name);
      assert.equal(normalize(await page.locator('.home-intro h1').evaluate(el => getComputedStyle(el).fontFamily)), normalize(fonts[name]));
      assert.equal(new URL(page.url()).searchParams.get('heading'), name);
      assert.equal(new URL(page.url()).searchParams.get('body'), name);
      checks.push({ width, page: '/', font: name });
    }
    await page.getByRole('combobox', { name: 'Headings', exact: true }).selectOption('Playfair Display');
    await page.getByRole('combobox', { name: 'Body', exact: true }).selectOption('DM Sans');
    assert.equal(new URL(page.url()).searchParams.get('heading'), 'Playfair Display');
    assert.equal(new URL(page.url()).searchParams.get('body'), 'DM Sans');
    await page.reload();
    await page.locator('[data-app-ready]').waitFor();
    await clickToolbarAction(page, 'Fonts');
    assert.equal(await page.getByRole('combobox', { name: 'Headings', exact: true }).inputValue(), 'Playfair Display');
    assert.equal(await page.getByRole('combobox', { name: 'Body', exact: true }).inputValue(), 'DM Sans');
    await loadFont(page, 'Playfair Display');
    await loadFont(page, 'DM Sans');
    await page.locator('.font-panel').screenshot({ path: `${directory}/${width}-homepage.png` });
    reports.push({ width, path: '/', state: 'custom pair restored', ...await checkPage(page, uiPolicy) });
    for (const [theme, palette] of [['dark', defaultDarkPalette], ['light', initialPalette]] as const) {
      for (const preview of previewCatalog) {
        await page.goto(`http://127.0.0.1:3000${previewHref(preview.path, palette, 'Playfair Display', 'DM Sans')}`);
        const frame = page.frames().find(frame => frame.parentFrame());
        await frame.waitForFunction(expected => document.documentElement.style.getPropertyValue('--p-heading-font') === expected, fonts['Playfair Display']);
        await frame.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/fonts/fonts.css')));
        await loadFont(frame, 'Playfair Display');
        await loadFont(frame, 'DM Sans');
        const heading = frame.getByRole('heading').first();
        assert.equal(normalize(await heading.evaluate(el => getComputedStyle(el).fontFamily)), normalize(fonts['Playfair Display']), `${preview.name} heading`);
        const nested = await heading.locator('span').all();
        for (const span of nested) assert.equal(normalize(await span.evaluate(el => getComputedStyle(el).fontFamily)), normalize(fonts['Playfair Display']));
        await clickToolbarAction(page, 'Fonts');
        assert.deepEqual(await page.getByLabel('Headings', { exact: true }).locator('option').allTextContents(), Object.keys(fonts));
        assert.deepEqual(await page.getByLabel('Body', { exact: true }).locator('option').allTextContents(), Object.keys(fonts));
        reports.push({ width, theme, path: preview.path, state: 'font selectors open', ...await checkPage(page, uiPolicy) });
        await page.getByRole('button', { name: 'Close fonts', exact: true }).click();
        await frame.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
        reports.push({ width, theme, path: preview.path, state: 'preview fonts applied', ...await checkPage(frame, uiPolicy) });
        checks.push({ width, theme, path: preview.path, heading: 'Playfair Display', body: 'DM Sans' });
        await page.screenshot({ path: `${directory}/${width}-${theme}-${preview.id}.png` });
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  completed = true;
} finally {
  await browser.close();
  await writeFile(`${directory}/report.json`, JSON.stringify({ completed, checks, errors, reports }, null, 2));
}
const findings = reports.flatMap(report => report.findings);
console.log(`${checks.length} functional checks completed; ${reports.length} UI states; ${findings.length} UI findings. Report: ${directory}/report.json`);
process.exitCode = findings.length ? 1 : 0;
