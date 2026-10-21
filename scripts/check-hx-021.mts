import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { checkPage } from 'lintapple';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
import { clickToolbarAction } from './lib/studio-toolbar.mts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320';
const out = 'artifacts/hx-021'; await mkdir(out, { recursive: true });
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
      await page.goto(`${base}/compare?preview=workspace&mode=${mode}`);
      await page.locator('[data-app-ready]').waitFor();
      const outerA = page.frameLocator('iframe[title="Palette A preview"]'), outerB = page.frameLocator('iframe[title="Palette B preview"]');
      const a = outerA.frameLocator('iframe'), b = outerB.frameLocator('iframe');
      const show = async (side: 'A' | 'B') => { if (width === 390) await page.getByRole('button', { name: `Show palette ${side}`, exact: true }).click(); };
      for (const pane of [a, b]) await pane.locator('style[data-comparison-scrollbars]').waitFor({ state: 'attached' });
      const requests = [];
      page.on('filechooser', request => requests.push(request));
      for (const [side, pane, other] of [['A', a, b], ['B', b, a]] as const) {
        await show(side);
        await pane.getByRole('button', { name: 'Add files and more', exact: true }).click();
        await other.getByRole('menuitem', { name: 'Add photos & files', exact: true }).waitFor({ state: 'attached' });
        const before = requests.length;
        await pane.getByRole('menuitem', { name: 'Add photos & files', exact: true }).click();
        await page.waitForTimeout(300);
        assert.equal(requests.length - before, 1);
        const name = `palette-${side}.txt`;
        await requests.at(-1).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('Palette sample') });
        await other.locator('.attachment').filter({ hasText: name }).waitFor({ state: 'attached' });
        assert.match(await pane.locator('.attachments').innerText(), new RegExp(name));
        await audit(page, pane, `${mode}-${side}-file-selected`);
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
