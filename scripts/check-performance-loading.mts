import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { checkPage } from 'lintapple';
import { paletteQuery, initialPalette, defaultDarkPalette } from '../src/lib/palette.ts';

const base = process.env.APP_URL || 'http://127.0.0.1:3335';
const directory = 'artifacts/performance/loading';
await mkdir(directory, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch();
const reports = [], actions = [], errors: string[] = [];
let complete = false;
try {
  const homeResponse = await fetch(`${base}/?${paletteQuery(initialPalette)}&heading=Arial`);
  const home = await homeResponse.text();
  assert.match(home, /id="home-title"[^>]*font-family:Arial/);
  assert.match(home, /<image href="\/preview-captures\/avenlo\/light\/original.webp"[^>]*opacity="1"/);
  for (const id of ['avenlo', 'tervix']) {
    const path = `/preview-captures/${id}/light/original.webp`;
    const header = homeResponse.headers.get('link')?.split(',').find(value => value.includes(`<${path}>`));
    assert(header?.includes('fetchpriority="high"') || new RegExp(`<link rel="preload" href="${path}" as="image" fetchPriority="high"`).test(home), `${id} must load at high priority before React starts`);
  }
  const dashboard = await (await fetch(`${base}/dashboard-previews/infrastructure`)).text();
  assert.match(dashboard, /class="infrastructure-app\b/);
  for (const width of [390, 1440]) for (const [theme, palette] of [['light', initialPalette], ['dark', defaultDarkPalette]] as const) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    let release: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    try {
      const scripts: string[] = [], responses: Promise<void>[] = [];
      page.on('response', response => { if (response.ok() && response.url().includes('/_next/static/') && new URL(response.url()).pathname.endsWith('.js')) responses.push(response.text().then(text => { scripts.push(text); })); });
      await page.goto(`${base}/?${paletteQuery(palette)}`, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready]').waitFor();
      await Promise.all(responses);
      assert(scripts.length > 0, 'The bundle check must inspect loaded scripts');
      assert.equal(scripts.some(text => text.includes('color-picker-area')), false, 'The picker must wait for intent');
      if (width === 390) assert.equal(await page.locator('[data-capture="infrastructure"] image').getAttribute('href'), null, 'Offscreen thumbnails must wait');
      await page.route('**/_next/static/**/*.js', async route => { await gate; await route.continue(); });
      const trigger = page.getByRole('button', { name: 'Primary color', exact: true });
      await trigger.focus();
      await trigger.press('Control+c');
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), palette.primary);
      await trigger.press('Enter');
      await page.getByRole('status').filter({ hasText: 'Loading color picker…' }).waitFor();
      reports.push({ width, theme, state: 'picker-loading', report: await checkPage(page, policy) });
      await page.screenshot({ path: `${directory}/${width}-${theme}-loading.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Primary color');
      release();
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Primary color');
      await trigger.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Primary color', exact: true });
      await dialog.waitFor();
      await page.waitForFunction(() => !!document.activeElement?.closest('[role="dialog"]'));
      await page.getByRole('textbox', { name: 'Hex', exact: true }).fill('123456');
      await page.getByRole('textbox', { name: 'Hex', exact: true }).press('Enter');
      assert.match(new URL(page.url()).searchParams.get('colors')!, /123456/);
      reports.push({ width, theme, state: 'picker-loaded', report: await checkPage(page, policy) });
      const shared = page.url();
      await page.getByRole('button', { name: 'Close color picker', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Primary color');
      await page.goto(shared);
      await page.getByRole('dialog', { name: 'Primary color', exact: true }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'Hex', exact: true }).inputValue(), '123456');
      actions.push({ width, theme, passed: true, states: ['deferred code', 'deferred thumbnails', 'copy shortcut', 'loading', 'cancel', 'reopen', 'edit', 'focus', 'shared open picker'] });
    } finally { release(); await context.close(); }
  }
  assert.deepEqual(errors, []);
  complete = true;
} finally {
  await browser.close();
  await writeFile(`${directory}/report.json`, JSON.stringify({ complete, reports, actions, errors }, null, 2));
}
const findings = reports.reduce((sum, entry) => sum + entry.report.findings.length, 0);
console.log(`${actions.length} flows; ${reports.length} UI scans; ${findings} findings`);
if (findings) process.exitCode = 1;
