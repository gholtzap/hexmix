import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { checkPage } from 'lintapple';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
import { clickToolbarAction } from './lib/studio-toolbar.mts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320';
const out = 'artifacts/hx-018'; await mkdir(out, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch(), actions = [], reports = [], errors = [];
async function audit(page: Page, frame: FrameLocator, state: string) {
  let host = { findings: [] }, attached = false;
  try { await expectUI(page, { attach: async (_, data) => { attached = true; host = JSON.parse(String(data.body)); } }, policy); }
  catch (error) { if (!attached) throw error; }
  reports.push({ state, width: page.viewportSize()!.width, surface: 'studio', report: host });
  const native = await (await frame.locator('html').elementHandle())!.ownerFrame();
  reports.push({ state, width: page.viewportSize()!.width, surface: 'preview', report: await checkPage(native!, policy) });
}
try {
  for (const width of [390, 1440]) for (const mode of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: mode, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${base}/dashboards/infra-dashboard/environment-variables?${paletteQuery(mode === 'light' ? initialPalette : defaultDarkPalette)}`);
      await page.locator('[data-app-ready]').waitFor();
      const frame = page.frameLocator('iframe'); await frame.locator('[data-app-ready]').waitFor();
      await frame.getByRole('button', { name: 'Create Variable', exact: true }).click();
      const dialog = frame.getByRole('dialog');
      await dialog.getByLabel('Name', { exact: true }).fill('invalid name');
      await dialog.getByLabel('Value', { exact: true }).fill('  exact sample value  ');
      await dialog.getByRole('button', { name: 'Create Variable', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      await audit(page, frame, `${mode}-validation`);
      await dialog.getByLabel('Name', { exact: true }).fill('  HUNT_EXACT_VALUE  ');
      await dialog.getByRole('button', { name: 'Create Variable', exact: true }).click();
      const row = frame.locator('tbody tr').filter({ hasText: 'HUNT_EXACT_VALUE' });
      await row.getByRole('button', { name: 'Show', exact: true }).click();
      assert.equal(await row.locator('.vr-value > span').textContent(), '  exact sample value  ');
      await audit(page, frame, `${mode}-created-value`);
      await row.getByRole('button', { name: 'Actions for HUNT_EXACT_VALUE', exact: true }).click();
      await frame.getByRole('menuitem', { name: 'Edit', exact: true }).press('Enter');
      assert.equal(await dialog.getByLabel('Value', { exact: true }).inputValue(), '  exact sample value  ');
      await dialog.getByLabel('Value', { exact: true }).fill('  edited sample value  ');
      await audit(page, frame, `${mode}-edit-value`);
      await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
      assert.equal(await row.locator('.vr-value > span').textContent(), '  edited sample value  ');

      await page.screenshot({ path: `${out}/${width}-${mode}.png` });
      actions.push({ width, mode, passed: true }); console.log(width, mode, 'passed');
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify({ actions, errors, reports }, null, 2));
}
const findings = reports.reduce((count, item) => count + item.report.findings.length, 0);
console.log(`${actions.length} action flows; ${reports.length} UI scans; ${findings} findings.`);
if (findings) process.exitCode = 1;
