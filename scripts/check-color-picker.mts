import {clickToolbarAction} from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, paletteQuery, isDarkPalette } from '../src/lib/palette.ts';

const reportPath = 'artifacts/reui';
await mkdir(reportPath, { recursive: true });
const browser = await chromium.launch();
const results = [];
const failures = [];
let completed = false;
const roles = ['Text', 'Background', 'Primary', 'Secondary', 'Accent'];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const inDarkMode = async () => isDarkPalette({ ...initialPalette, background: await page.frameLocator('iframe').locator('html').evaluate(node => node.style.getPropertyValue('--p-background')) });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const audit = async name => {
      let report = { name, viewport, findings: [] };
      try {
        await expectUI(page, { attach: async (_, attachment) => {
          report = { name, ...JSON.parse(String(attachment.body)) };
        } });
      } catch (error) {
        failures.push(`${viewport.width} ${name}: ${error.message}`);
      }
      results.push(report);
    };
    const open = async role => {
      const button = page.getByRole('button', { name: `${role} color`, exact: true });
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await page.getByRole('dialog', { name: `${role} color`, exact: true }).waitFor();
    };
    const close = async () => {
      await page.getByRole('button', { name: 'Close color picker', exact: true }).click();
      await page.locator('.color-picker-content').waitFor({ state: 'hidden' });
    };
    const primary = () => page.locator('iframe').evaluate(frame => (frame as HTMLIFrameElement).contentDocument.documentElement.style.getPropertyValue('--p-primary'));
    await page.goto(new URL(`/editor?${paletteQuery(initialPalette)}`, process.env.APP_URL || 'http://127.0.0.1:3000').href);
    await page.locator('iframe').evaluate(async frame => {
      if ((frame as HTMLIFrameElement).contentDocument?.readyState !== 'complete') await new Promise<void>(resolve => frame.addEventListener('load', () => resolve(), { once: true }));
    });
    await audit('closed');
    await clickToolbarAction(page, 'Fonts');
    await audit('fonts open');
    await page.getByLabel('Headings', { exact: true }).selectOption('Arial');
    await page.getByLabel('Body', { exact: true }).selectOption('Verdana');
    assert.deepEqual(await page.locator('iframe').evaluate(frame => [
      (frame as HTMLIFrameElement).contentDocument.documentElement.style.getPropertyValue('--p-heading-font'),
      (frame as HTMLIFrameElement).contentDocument.documentElement.style.getPropertyValue('--p-body-font'),
    ]), ['Arial, Helvetica, sans-serif', 'Verdana, Geneva, sans-serif']);
    await audit('fonts applied');
    await page.getByRole('button', { name: 'Close fonts', exact: true }).click();
    await clickToolbarAction(page, 'Share palette');
    const shared = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    assert.equal(shared.searchParams.has('template'), false);
    assert.equal(shared.searchParams.get('heading'), 'Arial');
    assert.equal(shared.searchParams.get('body'), 'Verdana');
    await clickToolbarAction(page, 'Reset palette and fonts');
    await clickToolbarAction(page, 'Export palette');
    await audit('export open');
    assert.match(await page.getByRole('dialog', { name: 'Export' }).locator('pre').innerText(), /--color-primary:/);
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await clickToolbarAction(page, 'Hide color toolbar');
    await audit('toolbar hidden');
    await page.getByRole('button', { name: 'Open color toolbar', exact: true }).click();
    for (const role of roles) {
      await open(role);
      await audit(`${role.toLowerCase()} open`);
      await close();
    }
    await open('Primary');
    const before = await primary();
    const hex = page.getByRole('textbox', { name: 'Hex', exact: true });
    await hex.fill('not-hex');
    await audit('invalid hex being edited');
    await hex.press('Enter');
    assert.equal(await primary(), before, 'Invalid input must keep the current color');
    await hex.fill('123456');
    await hex.press('Enter');
    assert.equal(await primary(), '#123456', 'A hex edit must update the preview');
    assert.equal(await page.frameLocator('iframe').locator('.colors span').first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(18, 52, 86)');
    await audit('hex applied');
    await page.getByRole('combobox', { name: 'Color format', exact: true }).selectOption('rgb');
    assert.equal(await page.getByRole('spinbutton').count(), 3);
    await page.getByRole('spinbutton', { name: 'Red', exact: true }).fill('255');
    await page.getByRole('spinbutton', { name: 'Red', exact: true }).press('Enter');
    assert.equal(await primary(), '#ff3456');
    await audit('rgb applied');
    await page.getByRole('combobox', { name: 'Color format', exact: true }).selectOption('hsl');
    await audit('hsl fields');
    await page.getByRole('combobox', { name: 'Color format', exact: true }).selectOption('hex');
    // A drag must preview while held and add just one undo step when released.
    const dragStart = await primary();
    const area = page.getByRole('slider', { name: 'Color', exact: true });
    const rect = await area.boundingBox();
    assert.ok(rect);
    await page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.4, { steps: 8 });
    const dragged = await primary();
    assert.notEqual(dragged, dragStart, 'Dragging must update the live preview');
    await page.mouse.up();
    await close();
    await clickToolbarAction(page, 'Undo palette');
    assert.equal(await primary(), dragStart, 'One undo must reverse a complete drag');
    await clickToolbarAction(page, 'Redo palette');
    assert.equal(await primary(), dragged);
    await open('Primary');
    await page.getByRole('slider', { name: 'Hue', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await primary(), dragged, 'The hue slider must support the keyboard');
    await audit('keyboard hue');
    await page.getByRole('option', { name: 'Blue hour', exact: true }).click();
    assert.equal(await primary(), '#82a4d3');
    await page.getByRole('button', { name: 'Copy color', exact: true }).click();
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).toLowerCase(), '#82a4d3');
    await audit('preset and copy');
    await page.getByRole('button', { name: 'Lock primary', exact: true }).click();
    await audit('locked');
    await close();
    assert.equal(await page.getByRole('button', { name: 'Primary color', exact: true }).locator('svg').count(), 1);
    await clickToolbarAction(page, 'Shuffle palette');
    assert.equal(await primary(), '#82a4d3', 'A locked color must survive randomization');
    if (!await inDarkMode()) await clickToolbarAction(page, 'Use dark palette');
    for (let i = 0; i < 5; i++) {
      await clickToolbarAction(page, 'Shuffle palette');
      assert.equal(await inDarkMode(), true, 'Shuffle must keep dark mode');
      assert.equal(await primary(), '#82a4d3', 'Shuffle must keep locked colors in dark mode');
    }
    await clickToolbarAction(page, 'Undo palette');
    assert.equal(await inDarkMode(), true);
    await clickToolbarAction(page, 'Redo palette');
    await page.mouse.move(5, 5);
    await audit('dark after shuffle');
    assert.equal(await page.frameLocator('iframe').getByRole('heading', { name: 'Blank page' }).count(), 1);
    assert.equal(await page.frameLocator('iframe').locator('.colors span').count(), 3);
    await page.mouse.move(5, 5);
    await page.screenshot({ path: `${reportPath}/${viewport.width}-dark-preview.png` });
    await page.locator('iframe').evaluate(frame => (frame as HTMLIFrameElement).contentWindow.scrollTo(0, 0));
    await open('Primary');
    await audit('dark preview');
    await page.screenshot({ path: `${reportPath}/${viewport.width}-dark.png` });
    await close();
    await clickToolbarAction(page, 'Use light palette');
    await clickToolbarAction(page, 'Shuffle palette');
    assert.equal(await inDarkMode(), false, 'Shuffle must keep light mode');
    await page.mouse.move(5, 5);
    await audit('light after shuffle');
    await clickToolbarAction(page, 'Reset palette and fonts');
    await open('Primary');
    await page.getByRole('button', { name: 'Unlock primary', exact: true }).click();
    await page.getByRole('textbox', { name: 'Hex', exact: true }).fill('abcdef');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.color-picker-content').count(), 1, 'Escape must first revert the edited field');
    await page.keyboard.press('Escape');
    await page.locator('.color-picker-content').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Primary color');
    await open('Primary');
    // Verify the native sampler boundary without starting the operating system picker.
    await page.evaluate(() => { window.EyeDropper = class { async open() { return { sRGBHex: '#654321' }; } }; });
    await page.getByRole('button', { name: 'Pick a color from the screen', exact: true }).click();
    assert.equal(await primary(), '#654321');
    await audit('sampled color');
    await page.getByRole('button', { name: 'Pick a color from the screen', exact: true }).hover();
    await audit('sampler tooltip');
    await page.getByRole('textbox', { name: 'Hex', exact: true }).focus();
    await page.mouse.move(5, 5);
    await page.locator('main.studio > .toast').waitFor({ state: 'hidden' });
    await page.screenshot({ path: `${reportPath}/${viewport.width}-picker.png` });
    await page.locator('iframe').contentFrame().locator('body').click({ position: { x: 10, y: 10 } });
    await page.locator('.color-picker-content').waitFor({ state: 'hidden' });
    await open('Accent');
    if (viewport.width <= 560) await close();
    await page.getByRole('button', { name: 'Primary color', exact: true }).click();
    await page.getByRole('dialog', { name: 'Primary color', exact: true }).waitFor();
    assert.equal(await page.locator('.color-picker-content').count(), 1, 'Only one picker can be open');
    await close();
    assert.deepEqual(errors, []);
    await context.close();
  }
  completed = true;
} finally {
  await browser.close();
  await writeFile(`${reportPath}/picker-report.json`, JSON.stringify({ completed, results, failures }, null, 2));
}
assert.deepEqual(failures, []);
console.log(`Passed picker actions and ${results.length} UI states. Report: ${reportPath}/picker-report.json`);
