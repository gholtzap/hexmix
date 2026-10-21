import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {checkPage} from 'lintapple';
import {contrast} from '../src/lib/palette.ts';
import {measure} from './lib/measure-text-contrast.mts';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const out = 'artifacts/orvian-text-surfaces';
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const palettes = [
  ['default', ''],
  ['light', '171717-ffffff-e98878-ffe291-a8655f'],
  ['dark', 'ededed-171717-e98878-333333-a8655f'],
  ['low-contrast', '222222-222222-94ce88-beefcd-4a8b3c'],
] as const;
const browser = await chromium.launch(), checks = [], reports = [];
await mkdir(out, {recursive: true});
try {
  for (const width of [390, 1440]) for (const [theme, colors] of palettes) {
    const page = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: 'reduce'});
    page.setDefaultTimeout(15000);
    try {
      await page.goto(`${base}/orvian${colors ? `?colors=${colors}` : ''}`);
      const frame = await (await page.locator('iframe').elementHandle())!.contentFrame();
      assert.ok(frame);
      const settle = async () => {
        await frame.waitForFunction(colors => {
          const root = document.documentElement;
          const palette = ['text','background','primary','secondary','accent'].map(role => root.style.getPropertyValue(`--p-${role}`)).join('|');
          return root.dataset.copyReady === 'true' && root.dataset.contrastReady === 'true' && root.dataset.contrastPalette === palette && (!colors || palette === colors.split('-').map(color => '#'+color).join('|'));
        }, colors);
        await frame.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        });
        await page.waitForTimeout(250);
      };
      const check = async (state: string, audit = true) => {
        await settle();
        assert.equal(await frame.locator('[data-preview-text-surface]').count(), 0, `${state}: text must not have added background blocks`);
        const text = await measure(frame);
        assert.deepEqual(text.filter(item => contrast(item.foreground, item.background) < 4.5), [], `${state}: text must be readable`);
        assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state}: no horizontal overflow`);
        checks.push({width, theme, state, measurements: text.length, passed: true});
        if (audit) reports.push({width, theme, state, report: await checkPage(frame, policy)});
        await page.screenshot({path: `${out}/${width}-${theme}-${state}.png`});
      };
      await check('home');
      for (const id of ['features', 'faq']) {
        await (id === 'features' ? frame.getByRole('heading', {name: 'A clearer starting point', exact: true}) : frame.locator('#faq')).scrollIntoViewIfNeeded();
        await check(id, false);
      }
      await frame.evaluate(() => window.scrollTo(0, 0));
      const menu = frame.getByRole('button', {name: width === 390 ? 'Toggle menu' : 'Resources', exact: true});
      await menu.click();
      await check('resources');
      await menu.press('Escape');
      await frame.locator('main button[data-open-demo]').first().click();
      await frame.getByRole('dialog').waitFor();
      await check('dialog');
      await frame.getByRole('button', {name: 'Continue to booking', exact: false}).click();
      await frame.locator('[aria-invalid=true]').first().waitFor();
      await check('errors');
      await frame.getByLabel('First name', {exact: true}).fill('Test');
      await frame.getByLabel('Last name', {exact: true}).fill('User');
      await frame.getByLabel('Company email', {exact: true}).fill('test@example.invalid');
      await frame.getByRole('button', {name: '10–50', exact: true}).click();
      await frame.getByRole('button', {name: 'Continue to booking', exact: false}).click();
      await frame.getByText('Preview complete. No booking was sent.', {exact: true}).waitFor();
      await check('complete');
      await frame.getByRole('button', {name: 'Close', exact: true}).last().click();
      await frame.getByRole('dialog').waitFor({state: 'hidden'});
      await check('closed', false);
    } catch (error) {
      checks.push({width, theme, passed: false, error: String(error)});
    } finally { await page.close(); }
  }
} finally {
  await browser.close();
  await writeFile(`${out}/report.json`, JSON.stringify({checks, reports}, null, 2));
}
const failures = checks.filter(check => !check.passed);
const findings = reports.reduce((sum, record) => sum + record.report.findings.length, 0);
console.log(`${checks.length} states; ${failures.length} failed actions; ${findings} UI findings. Report: ${out}/report.json`);
console.log(failures);
process.exitCode = failures.length ? 2 : findings ? 1 : 0;
