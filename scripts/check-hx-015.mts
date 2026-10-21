import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { checkPage } from 'lintapple';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
import { clickToolbarAction } from './lib/studio-toolbar.mts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320';
const out = 'artifacts/hx-015'; await mkdir(out, { recursive: true });
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
      const side = mode === 'light' ? 'A' : 'B', pane = side === 'A' ? a : b, outer = side === 'A' ? outerA : outerB;
      await show(side);
      if (width === 390) await pane.getByRole('button', { name: 'Open sidebar', exact: true }).click();
      await pane.getByRole('button', { name: /Open profile menu/ }).click();
      await pane.getByRole('menuitem', { name: 'Help', exact: true }).waitFor();
      if (width === 390) assert.equal(await outer.locator('.toolbar-anchor').isVisible(), false);
      else {
        const menu = await pane.getByRole('menuitem', { name: 'Help', exact: true }).boundingBox();
        const bar = await outer.locator('.toolbar-anchor').boundingBox();
        assert.ok(menu && bar);
        assert.ok(menu.x >= bar.x + bar.width || menu.x + menu.width <= bar.x || menu.y >= bar.y + bar.height || menu.y + menu.height <= bar.y);
      }
      await audit(page, pane, `${mode}-profile-menu`);
      await page.screenshot({ path: `${out}/${width}-${mode}-profile-menu.png` });
      await pane.getByRole('menuitem', { name: 'Help', exact: true }).click();
      await pane.getByRole('dialog', { name: 'Help', exact: true }).waitFor();
      await audit(page, pane, `${mode}-help-dialog`);
      await page.screenshot({ path: `${out}/${width}-${mode}-help-dialog.png` });
      await pane.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await pane.locator('body').press('Escape');
      await outer.locator('.toolbar-anchor').waitFor({ state: 'visible' });
      await page.goto(`${base}/dashboards/ai-chatbot?${paletteQuery(mode === 'light' ? initialPalette : defaultDarkPalette)}`);
      await page.locator('[data-app-ready]').waitFor();
      const single = page.frameLocator('iframe'); await single.locator('[data-app-ready]').waitFor();
      for (const text of ['First message', 'Second message']) {
        await single.getByRole('textbox', { name: 'Ask Pebble', exact: true }).fill(text);
        await single.getByRole('button', { name: 'Send message', exact: true }).click();
      }
      assert.equal(await single.locator('.chat-message.user').count(), 2);
      await audit(page, single, `${mode}-composer-clearance`);

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
