import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { checkPage } from 'lintapple';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { openSiteSwitcher } from './lib/studio-toolbar.mts';
import { readComparison } from '../src/lib/comparison.ts';
import { fonts } from '../src/lib/fonts.ts';
const base = process.env.APP_URL || 'http://127.0.0.1:3100';
const output = 'artifacts/shared-comparison-toolbar';
await mkdir(output, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const reports = [], actions = [];
const browser = await chromium.launch();
// Keep menu selection independent of pointer hover during UI scans.
async function toolbarAction(frame, name: string) {
  const button = frame.getByRole('button', { name, exact: true });
  if (await button.isVisible()) return button.click();
  await frame.getByRole('button', { name: 'More tools', exact: true }).click();
  const item = frame.getByRole('menuitem', { name, exact: true });
  await item.focus(); await item.press('Enter');
}
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    try {
      await page.goto(`${base}/compare`); await page.locator('[data-app-ready]').waitFor();
      const a = await (await page.locator('iframe[title="Palette A preview"]').elementHandle()).contentFrame();
      await a.locator('[data-comparison-toolbar]').waitFor();
      const scan = async (state: string) => {
        reports.push({ width, state, report: await checkPage(a, policy) });
        await page.screenshot({ path: `${output}/${width}-${state}.png` });
      };
      assert.equal(await page.getByRole('button', { name: /More comparison options for palette/ }).count(), 0);
      const before = readComparison(new URL(page.url()).search);
      const toolbar = await a.getByRole('region', { name: 'Color toolbar', exact: true }).boundingBox();
      assert.ok(toolbar.height >= 88 && toolbar.height <= 140);
      assert.ok(toolbar.width <= (width === 390 ? width : width / 2));
      await scan('toolbar');
      await a.getByRole('button', { name: 'Background color', exact: true }).click();
      await scan('picker');
      await a.getByRole('textbox', { name: 'Hex', exact: true }).fill('142536');
      await a.getByRole('textbox', { name: 'Hex', exact: true }).press('Enter');
      await page.waitForFunction(() => new URLSearchParams(location.search).get('customA') === '1');
      assert.equal(readComparison(new URL(page.url()).search).a.background, '#142536');
      assert.deepEqual(readComparison(new URL(page.url()).search).b, before.b);
      await a.getByRole('button', { name: 'Close color picker', exact: true }).click();
      const shared = page.url();
      await page.reload(); await page.locator('[data-app-ready]').waitFor();
      assert.equal(page.url(), shared);
      const current = await (await page.locator('iframe[title="Palette A preview"]').elementHandle()).contentFrame();
      await current.locator('[data-comparison-toolbar]').waitFor();
      await current.waitForFunction(() => document.querySelector<HTMLIFrameElement>('iframe')?.contentDocument?.documentElement.style.getPropertyValue('--p-background') === '#142536');
      await toolbarAction(current, 'Shuffle palette');
      await page.waitForFunction(old => new URLSearchParams(location.search).get('a') !== old, new URL(shared).searchParams.get('a'));
      await toolbarAction(current, 'Undo palette');
      await page.waitForFunction(old => new URLSearchParams(location.search).get('a') === old, new URL(shared).searchParams.get('a'));
      await toolbarAction(current, 'Fonts');
      await current.getByLabel('Headings', { exact: true }).selectOption('Arial');
      await current.getByLabel('Body', { exact: true }).selectOption('Verdana');
      await page.waitForFunction(() => new URLSearchParams(location.search).get('heading') === 'Arial' && new URLSearchParams(location.search).get('body') === 'Verdana');
      const second = await (await page.locator('iframe[title="Palette B preview"]').elementHandle()).contentFrame();
      await second.waitForFunction(font => document.querySelector<HTMLIFrameElement>('iframe')?.contentDocument?.documentElement.style.getPropertyValue('--p-body-font') === font, fonts.Verdana);
      await current.getByRole('button', { name: 'Close fonts', exact: true }).click();
      await toolbarAction(current, 'Use light palette');
      await page.waitForFunction(() => new URLSearchParams(location.search).get('mode') === 'light' && !new URLSearchParams(location.search).has('customA'));
      await toolbarAction(current, 'Export palette');
      await current.getByRole('dialog', { name: 'Export', exact: true }).waitFor();
      reports.push({ width, state: 'export', report: await checkPage(current, policy) });
      await current.getByLabel('Format', { exact: true }).selectOption('json');
      assert.ok((await current.getByRole('region', { name: 'JSON export', exact: true }).innerText()).includes('#ffffff'));
      await current.getByRole('button', { name: 'Close export', exact: true }).click();
      await toolbarAction(current, 'Compare palettes');
      await page.getByRole('dialog', { name: 'Comparison options for palette A', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await openSiteSwitcher(current);
      reports.push({ width, state: 'preview-menu', report: await checkPage(current, policy) });
      const previews = current.getByRole('menuitem', { name: 'Previews', exact: true });
      await previews.focus(); await previews.press('ArrowRight');
      const target = current.getByRole('menuitem', { name: 'Infra Dashboard', exact: true });
      await target.focus(); await target.press('Enter');
      await page.waitForFunction(() => new URLSearchParams(location.search).get('preview') === 'infrastructure');
      for (const side of ['A', 'B']) await page.frameLocator(`iframe[title="Palette ${side} preview"]`).locator('[data-comparison-toolbar]').waitFor();
      // The same toolbar must still work outside comparison.
      await page.goto(`${base}/avenlo`); await page.locator('[data-app-ready]').waitFor();
      await page.getByRole('region', { name: 'Color toolbar', exact: true }).waitFor();
      await toolbarAction(page, 'Fonts');
      await page.getByLabel('Headings', { exact: true }).selectOption('Arial');
      await page.getByRole('button', { name: 'Close fonts', exact: true }).click();
      actions.push({ width, passed: true });
      console.log(width, 'toolbar flow passed');
    } catch (error) { actions.push({ width, passed: false, error: error.message }); console.error(width, error.stack); }
    finally { await context.close(); }
  }
} finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify({ actions, reports }, null, 2)); }
assert.deepEqual(actions.filter(action => !action.passed), []);
if (reports.some(entry => entry.report.findings.length)) process.exitCode = 1;
