import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { checkPage } from 'lintapple';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320';
const out = 'artifacts/hx-020'; await mkdir(out, { recursive: true });
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
      await page.goto(`${base}/compare?preview=avenlo&mode=${mode}&a=171717-ffffff-e98878-ffe291-a8655f&b=171717-ffffff-8eac85-e1e8c4-526c46`);
      await page.locator('[data-app-ready]').waitFor();
      const outerA = page.frameLocator('iframe[title="Palette A preview"]'), outerB = page.frameLocator('iframe[title="Palette B preview"]');
      const a = outerA.frameLocator('iframe'), b = outerB.frameLocator('iframe');
      const show = async (side: 'A' | 'B') => { if (width === 390) await page.getByRole('button', { name: `Show palette ${side}`, exact: true }).click(); };
      for (const pane of [a, b]) await pane.locator('style[data-comparison-scrollbars]').waitFor({ state: 'attached' });
      const paths = async () => [await outerA.locator('html').evaluate(() => location.pathname), await outerB.locator('html').evaluate(() => location.pathname)];
      const waitPaths = async (left: string, right = left) => {
        await page.waitForFunction(([left, right]) => ['A', 'B'].every((side, index) => document.querySelector<HTMLIFrameElement>(`iframe[title="Palette ${side} preview"]`)?.contentDocument?.location.pathname === [left, right][index]), [left, right]);
        for (const outer of [outerA, outerB]) await outer.locator('iframe[data-preview-ready="true"]').waitFor({ state: 'attached' });
        await page.waitForFunction(() => ['A', 'B'].every((side, index) => {
          const doc = document.querySelector<HTMLIFrameElement>(`iframe[title="Palette ${side} preview"]`)?.contentDocument?.querySelector('iframe')?.contentDocument;
          return doc?.documentElement.style.getPropertyValue('--p-primary').trim().toLowerCase() === ['#e98878', '#8eac85'][index];
        }));
        for (const [path, pane] of [[left, a], [right, b]] as const) {
          const title = path.endsWith('/space') ? 'All' : path.endsWith('/scheduled') ? 'Schedule a task' : path.endsWith('/deployments') ? 'Deployments' : path.endsWith('/logs') ? 'Logs' : null;
          if (title) await pane.getByRole('heading', { name: title, exact: true }).waitFor({ state: 'attached' });
        }
      };
      const traverse = async (direction: 'back' | 'forward', path: string) => {
        await page.evaluate(direction => history[direction](), direction);
        await waitPaths(path); assert.deepEqual(await paths(), [path, path]);
      };
      await show('A');
      for (const path of ['/avenlo/blog', '/avenlo', '/avenlo/blog']) {
        const before = await page.evaluate(() => history.length);
        if (path.endsWith('/blog')) await a.getByRole('link', { name: 'Blog', exact: true }).first().click();
        else await a.locator('a[data-preview-path="/"]').first().click();
        await waitPaths(path);
        assert.equal(await page.evaluate(() => history.length), before + 1);
      }
      for (const path of ['/avenlo', '/avenlo/blog', '/avenlo']) await traverse('back', path);
      for (const path of ['/avenlo/blog', '/avenlo', '/avenlo/blog']) await traverse('forward', path);
      await audit(page, a, `${mode}-avenlo-history`);
      for (const [preview, prefix, labels] of [
        ['workspace', '/dashboards/ai-chatbot', ['Space', 'Scheduled']],
        ['infrastructure', '/dashboards/infra-dashboard', ['Deployments', 'Logs']],
      ] as const) {
        await show('A');
        await page.goto(`${base}/compare?preview=${preview}&mode=${mode}&a=171717-ffffff-e98878-ffe291-a8655f&b=171717-ffffff-8eac85-e1e8c4-526c46`);
        await page.locator('[data-app-ready]').waitFor();
        for (const pane of [a, b]) await pane.locator('style[data-comparison-scrollbars]').waitFor({ state: 'attached' });
        await show('A');
        for (const label of labels) {
          const opener = a.getByRole('button', { name: 'Open sidebar', exact: true }).first();
          if (await opener.isVisible()) await opener.press('Enter');
          await a.getByRole('button', { name: new RegExp(`^${label}`) }).first().click();
          await waitPaths(`${prefix}/${label.toLowerCase()}`);
        }
        await traverse('back', `${prefix}/${labels[0].toLowerCase()}`);
        await traverse('forward', `${prefix}/${labels[1].toLowerCase()}`);
        await audit(page, a, `${mode}-${preview}-history`);
      }
      await page.goto(`${base}/compare?preview=avenlo&mode=${mode}&a=171717-ffffff-e98878-ffe291-a8655f&b=171717-ffffff-8eac85-e1e8c4-526c46&linked=0`); await page.locator('[data-app-ready]').waitFor();
      for (const pane of [a, b]) await pane.locator('style[data-comparison-scrollbars]').waitFor({ state: 'attached' });
      await show('A'); await a.getByRole('link', { name: 'Blog', exact: true }).first().click();
      await waitPaths('/avenlo/blog', '/avenlo');
      assert.deepEqual(await paths(), ['/avenlo/blog', '/avenlo']);

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
