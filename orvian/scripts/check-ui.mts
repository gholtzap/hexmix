import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';

const output = '../artifacts/orvian-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const summary = [];
let findings = 0;
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const external = [];
    page.on('request', request => {
      if (new URL(request.url()).protocol.startsWith('http') && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
    });
    await page.goto('http://127.0.0.1:3002');
    await page.waitForSelector('[data-app-ready]');
    async function check(state) {
      let count = 0;
      try {
        await expectUI(page, { attach: async (_, attachment) => {
          const report = JSON.parse(String(attachment.body));
          count = report.findings.length;
          await writeFile(`${output}/${width}-${state}.json`, JSON.stringify(report, null, 2));
        } });
      } catch (error) {
        if (error.code !== 'ERR_ASSERTION') throw error;
        findings += count;
      }
      summary.push({ width, state, findings: count });
    }
    await check('initial');
    assert.equal(await page.locator('[data-scene]').count(), 6);
    assert.equal(await page.locator('body').evaluate(e => e.scrollWidth <= innerWidth), true);
    if (width === 768) { await context.close(); continue; }
    const menu = page.getByRole('button', { name: width === 390 ? 'Toggle menu' : 'Resources', exact: true });
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await check('menu-open');
    await menu.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');

    for (const button of await page.locator('#faq button').all()) {
      await button.click();
      if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
      assert.equal(await page.locator('#faq button[aria-expanded="true"]').count(), 1);
    }
    await page.locator('#faq [aria-hidden="false"]').evaluate(async panel => {
      await Promise.all(panel.getAnimations().map(animation => animation.finished.catch(() => {})));
    });
    await check('faq-open');
    await page.locator('#faq button').last().click();
    assert.equal(await page.locator('#faq button[aria-expanded="true"]').count(), 0);
    await check('faq-closed');

    await page.locator('[data-open-demo]').first().click();
    await page.getByRole('dialog').waitFor();
    await check('demo-open');
    await page.getByRole('button', { name: 'Continue to booking →', exact: true }).click();
    assert.equal(await page.locator('input[aria-invalid="true"]').count(), 3);
    await check('demo-errors');
    await page.getByLabel('First name', { exact: true }).fill('Test');
    await page.getByLabel('Last name', { exact: true }).fill('Preview');
    await page.getByLabel('Company email', { exact: true }).fill('test@gmail.com');
    await page.getByRole('button', { name: '10–50', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to booking →', exact: true }).click();
    assert.equal(await page.getByText('Please use your company email.', { exact: true }).isVisible(), true);
    await check('demo-email-error');
    await page.getByRole('button', { name: '<10', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Continue to booking →', exact: true }).isDisabled(), true);
    await check('demo-small-team');
    await page.getByRole('button', { name: '10–50', exact: true }).click();
    await page.getByLabel('Company email', { exact: true }).fill('test@example.test');
    await page.getByRole('button', { name: 'Continue to booking →', exact: true }).click();
    assert.equal(await page.getByText('Preview complete. No booking was sent.', { exact: true }).isVisible(), true);
    await check('demo-complete');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(external, [], 'The local page made an external request.');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setViewportSize({ width: 768, height: 900 });
    assert.equal(await page.locator('body').evaluate(e => e.scrollWidth <= innerWidth), true, 'A scene extended beyond the page after resize.');
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/summary.json`, JSON.stringify({ states: summary, findings }, null, 2));
}
console.log(`Behavior checks passed. ${summary.length} UI states checked; ${findings} policy findings.`);
process.exitCode = findings ? 1 : 0;
