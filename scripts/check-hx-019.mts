import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { checkPage } from 'lintapple';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
import { clickToolbarAction } from './lib/studio-toolbar.mts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320';
const out = 'artifacts/hx-019'; await mkdir(out, { recursive: true });
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
      await page.goto(`${base}/dashboards/infra-dashboard/agent?${paletteQuery(mode === 'light' ? initialPalette : defaultDarkPalette)}`);
      await page.locator('[data-app-ready]').waitFor();
      const frame = page.frameLocator('iframe'); await frame.locator('[data-app-ready]').waitFor();
      for (const title of ['Invite member', 'New case', 'Review the project']) {
        await frame.getByLabel('Message Agent', { exact: true }).fill(title);
        await frame.getByRole('button', { name: 'Send message', exact: true }).click();
        await frame.getByRole('button', { name: title, exact: true }).click();
        const dialog = frame.getByRole('dialog', { name: title, exact: true });
        assert.equal(await dialog.locator('form').count(), 0);
        assert.match(await dialog.innerText(), /task checks the local sample data/);
        await audit(page, frame, `${mode}-${title}-details`);
        await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      }
      await page.goto(`${base}/dashboards/infra-dashboard/support?${paletteQuery(mode === 'light' ? initialPalette : defaultDarkPalette)}`);
      await page.locator('[data-app-ready]').waitFor();
      await frame.getByRole('button', { name: 'New case', exact: true }).click();
      const supportDialog = frame.getByRole('dialog', { name: 'New case', exact: true });
      await supportDialog.getByLabel('Subject', { exact: true }).fill('New case');
      await supportDialog.getByLabel('Message', { exact: true }).fill('A case whose subject matches the create action');
      await supportDialog.getByRole('button', { name: 'Create case', exact: true }).click();
      await frame.getByRole('region', { name: 'Support cases' }).getByRole('button', { name: 'New case', exact: true }).click();
      assert.equal(await supportDialog.locator('form').count(), 0);
      await supportDialog.getByRole('button', { name: 'Close case', exact: true }).waitFor();
      await audit(page, frame, `${mode}-case-details`);
      await supportDialog.getByRole('button', { name: 'Close case', exact: true }).click();
      await frame.getByRole('button', { name: 'New case', exact: true }).first().click();
      assert.equal(await supportDialog.locator('form').count(), 1);

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
