import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { checkPage } from 'lintapple';
import { initialPalette, defaultDarkPalette, paletteQuery, readPalette } from '../src/lib/palette.ts';
import { clickToolbarAction } from './lib/studio-toolbar.mts';

const base = process.env.APP_URL || 'http://127.0.0.1:3335';
const directory = 'artifacts/performance/errors';
await mkdir(directory, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch(), reports = [], actions = [], errors: string[] = [];
let complete = false;
try {
  for (const width of [390, 1440]) for (const [theme, palette] of [['light', initialPalette], ['dark', defaultDarkPalette]] as const) {
    for (const feature of ['color picker', 'palettes', 'site menu']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.on('pageerror', error => errors.push(error.message));
      let fail = true, blocked = 0;
      const audit = async state => {
        await page.mouse.move(1, 1);
        reports.push({ width, theme, feature, state, report: await checkPage(page, policy) });
        await page.screenshot({ path: `${directory}/${width}-${theme}-${feature.replaceAll(' ', '-')}-${state}.png` });
      };
      try {
        if (feature === 'site menu') {
          await page.route('**/_next/static/**/*.js', async route => {
            if (!fail) { await route.continue(); return; }
            const response = await route.fetch();
            if ((await response.text()).includes('Switch site:')) { blocked++; await route.abort(); }
            else await route.fulfill({ response });
          });
          await page.goto(`${base}/avenlo?${paletteQuery(palette)}`);
        } else {
          await page.goto(`${base}/?${paletteQuery(palette)}`, { waitUntil: 'networkidle' });
          await page.locator('[data-app-ready]').waitFor();
          await page.route('**/_next/static/**/*.js', route => { if (fail) { blocked++; return route.abort(); } return route.continue(); });
          if (feature === 'color picker') await page.getByRole('button', { name: 'Primary color', exact: true }).press('Enter');
          else await clickToolbarAction(page, 'Palettes');
        }
        const retry = page.getByRole('button', { name: `Retry loading ${feature}`, exact: true });
        await retry.waitFor();
        assert(blocked > 0, `${feature} must have a failed download`);
        assert.deepEqual(readPalette(new URL(page.url()).search), palette);
        assert.equal(await page.locator('[data-app-ready]').count(), 1);
        await audit('failed');
        fail = false;
        await retry.press('Enter');
        if (feature === 'color picker') await page.getByRole('textbox', { name: 'Hex', exact: true }).waitFor();
        else if (feature === 'palettes') await page.getByRole('button', { name: 'Save palette', exact: true }).waitFor();
        else {
          await page.getByRole('button', { name: /^Switch site:/ }).waitFor();
          await page.waitForFunction(() => document.activeElement?.matches('.site-switcher-trigger'));
          await page.keyboard.press('Enter');
          await page.getByRole('menuitem', { name: 'All sites', exact: true }).waitFor();
        }
        assert.deepEqual(readPalette(new URL(page.url()).search), palette);
        await audit('recovered');
        actions.push({ width, theme, feature, blocked, passed: true });
      } finally { await context.close(); }
    }
  }
  assert.deepEqual(errors, []);
  complete = true;
} finally {
  await browser.close();
  await writeFile(`${directory}/report.json`, JSON.stringify({ complete, actions, reports, errors }, null, 2));
}
const findings = reports.reduce((sum, entry) => sum + entry.report.findings.length, 0);
console.log(`${actions.length} retry flows; ${reports.length} UI scans; ${findings} findings`);
if (findings) process.exitCode = 1;
