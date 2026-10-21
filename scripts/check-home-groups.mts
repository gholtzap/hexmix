import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { previewCatalog } from '../src/lib/preview-catalog.ts';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = 'artifacts/home-groups';
await mkdir(output, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch();
const reports = [];
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const colors = theme === 'dark' ? 'ededed-171717-e98878-333333-a8655f' : '171717-ffffff-e98878-ffe291-a8655f';
    await page.goto(`${base}/?colors=${colors}&heading=Arial&body=Verdana`);
    await page.locator('[data-app-ready]').waitFor();
    for (const category of ['All', 'Homepages', 'Dashboards']) {
      const button = page.getByRole('button', { name: category, exact: true });
      await button.scrollIntoViewIfNeeded();
      await button.focus();
      await page.keyboard.press('Space');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      const groups = category === 'All' ? ['Homepages', 'Dashboards'] : [category];
      assert.deepEqual(await page.locator('.home-preview-group > h3').allTextContents(), groups);
      for (const group of groups) {
        const region = page.getByRole('region', { name: group, exact: true });
        const expected = previewCatalog.filter(preview => preview.category === group);
        assert.deepEqual(await region.locator('h4').allTextContents(), expected.map(preview => preview.name));
        for (const preview of expected) {
          const href = new URL(await region.getByRole('link', { name: preview.name, exact: true }).getAttribute('href'), base);
          assert.equal(href.pathname, preview.path);
          assert.equal(href.searchParams.get('colors'), colors);
          assert.equal(href.searchParams.get('heading'), 'Arial');
          assert.equal(href.searchParams.get('body'), 'Verdana');
        }
        await region.locator('.home-preview-card').last().scrollIntoViewIfNeeded();
        let report = { findings: [] };
        try { await expectUI(page, { attach: async (_, data) => { report = JSON.parse(String(data.body)); } }, policy); }
        finally { reports.push({ width, theme, category, group, report }); }
      }
      await page.locator('.home-page').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: `${output}/${width}-${theme}-${category.toLowerCase()}.png`, fullPage: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(reports, null, 2));
}
console.log(`Passed ${reports.length} UI checks across both sizes, themes, and all three filters.`);
