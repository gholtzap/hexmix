import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { checkPage } from 'lintapple';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320';
const out = 'artifacts/hx-017'; await mkdir(out, { recursive: true });
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
      await page.goto(`${base}/dashboards/infra-dashboard/ai-gateway?${paletteQuery(mode === 'light' ? initialPalette : defaultDarkPalette)}`);
      await page.locator('[data-app-ready]').waitFor();
      const frame = page.frameLocator('iframe'); await frame.locator('[data-app-ready]').waitFor();
      await frame.getByRole('searchbox', { name: 'Search', exact: true }).fill('Assistant');
      const table = frame.getByRole('region', { name: 'AI Gateway activity' });
      for (const [period, factor] of [['Last 30 days', 3.8], ['Last 90 days', 11], ['Last 7 days', 1]] as const) {
        await frame.getByRole('button', { name: /^Period:/ }).click();
        await audit(page, frame, `${mode}-period-menu`);
        await frame.getByRole('menuitem', { name: period, exact: true }).click();
        const rows = table.locator('tbody tr');
        for (const [index, count] of [8420, 6180, 3600].entries()) {
          assert.equal(await rows.nth(index).locator('td').nth(1).innerText(), Math.round(count * factor).toLocaleString('en-US'));
        }
        if (factor === 3.8) {
          assert.equal(await rows.nth(0).locator('td').nth(2).innerText(), '7.98M');
          assert.equal(await rows.nth(0).locator('td').nth(3).innerText(), '$23.71');
        }
        await audit(page, frame, `${mode}-${period}`);
      }

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
