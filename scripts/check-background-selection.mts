import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320', out = 'artifacts/background-selection';
await mkdir(out, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch(), flows = [], reports = [], errors = [];
async function audit(page, state) {
  let report = { findings: [] }, attached = false;
  try { await expectUI(page, { attach: async (_, data) => { attached = true; report = JSON.parse(String(data.body)); } }, policy); }
  catch (error) { if (!attached) throw error; }
  reports.push({ width: page.viewportSize().width, state, report });
}
try {
  for (const width of [390, 1440]) for (const [mode, palette] of [['light', initialPalette], ['dark', defaultDarkPalette]] as const) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: mode, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(`${base}/dashboards/ai-chatbot?${paletteQuery(palette)}`);
      await page.locator('[data-app-ready]').waitFor();
      const frame = page.frameLocator('iframe.website-frame'); await frame.locator('.chat-main').waitFor();
      const native = await (await frame.locator('html').elementHandle())!.ownerFrame();
      const blank = async () => { const w = await frame.locator('.chat-main').evaluate(n => n.clientWidth); await frame.locator('.chat-main').click({ modifiers: width === 1440 ? [] : ['Alt'], position: { x: w * .6, y: 180 } }); };
      if (width === 1440) await page.getByRole('button', { name: /^(Edit element|Select an element)$/ }).click();
      await blank(); await page.locator('.element-panel').waitFor();
      assert.equal(await frame.locator('.chat-main[data-hexmix-selected]').count(), 1, 'Empty chat space must select a background surface');
      const textColors = await frame.locator('aside').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).color));
      const original = await frame.locator('body').evaluate(n => getComputedStyle(n).backgroundColor);
      assert.equal(await page.locator('.element-swatch-fill').first().evaluate(n => getComputedStyle(n).backgroundColor), original);
      await audit(page, `${mode}-selected`);
      await page.getByRole('button', { name: 'Change new color', exact: true }).click();
      await audit(page, `${mode}-role-menu`);
      await page.getByRole('menuitem', { name: 'Primary', exact: true }).click();
      await native!.waitForFunction(() => document.querySelector<HTMLElement>('.chat-main')!.style.backgroundColor === 'var(--p-primary)');
      assert.equal(await frame.locator('.chat-main').evaluate(n => getComputedStyle(n).backgroundColor), `rgb(${[1, 3, 5].map(i => parseInt(palette.primary.slice(i, i + 2), 16)).join(', ')})`);
      assert.deepEqual(await frame.locator('aside').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).color)), textColors);
      const assignment = JSON.parse(new URL(page.url()).searchParams.get('elements') || '[]').find(x => x.property === 'background');
      assert.equal(assignment?.property, 'background');
      await page.screenshot({ path: `${out}/${width}-${mode}-changed.png` });
      await audit(page, `${mode}-changed`);
      await page.reload(); await frame.locator('.chat-main').waitFor();
      const reloaded = await (await frame.locator('html').elementHandle())!.ownerFrame();
      await reloaded!.waitForFunction(() => document.querySelector<HTMLElement>('.chat-main')!.style.backgroundColor === 'var(--p-primary)');
      await frame.locator('.chat-main').click({ modifiers: ['Alt'], position: { x: 100, y: 180 } });
      assert.equal(await page.locator('.element-swatch-fill').first().evaluate(n => getComputedStyle(n).backgroundColor), original);
      await page.getByRole('button', { name: 'Use old color', exact: true }).click();
      await reloaded!.waitForFunction(original => getComputedStyle(document.body).backgroundColor === original && document.querySelector<HTMLElement>('.chat-main')!.style.backgroundColor !== 'var(--p-primary)', original);
      await page.keyboard.press('Escape');
      await frame.locator('h1').click({ modifiers: ['Alt'] });
      assert.equal(await frame.locator('h1[data-hexmix-selected]').count(), 1, 'Heading selection must remain a text selection');
      await page.keyboard.press('Escape');
      await frame.locator('textarea').first().click({ modifiers: ['Alt'] });
      assert.equal(await frame.locator('textarea[data-hexmix-selected]').count(), 1, 'Transparent inputs must remain selectable');
      await page.keyboard.press('Escape');
      await frame.locator('body').evaluate(n => { n.style.backgroundColor = '#000000'; });
      await frame.locator('.chat-main').dispatchEvent('click', { altKey: true });
      assert.equal(await page.locator('.element-swatch-fill').first().evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(0, 0, 0)');
      await frame.locator('body').evaluate(n => { n.style.backgroundColor = 'rgba(255, 0, 0, 0)'; document.documentElement.style.backgroundColor = '#123456'; });
      await frame.locator('.chat-main').dispatchEvent('click', { altKey: true });
      assert.equal(await page.locator('.element-swatch-fill').first().evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(18, 52, 86)');
      await audit(page, `${mode}-inherited-background`);
      flows.push({ width, mode, passed: true }); console.log(width, mode, 'passed');
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify({ flows, errors, reports }, null, 2)); }
const findings = reports.reduce((n, x) => n + x.report.findings.length, 0);
console.log(flows.length, 'action flows;', reports.length, 'UI scans;', findings, 'findings.');
if (findings) process.exitCode = 1;
