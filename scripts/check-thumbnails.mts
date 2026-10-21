import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { initialPalette, paletteQuery } from '../src/lib/palette.ts';
import { previewCatalog } from '../src/lib/preview-catalog.ts';

const directory = 'artifacts/preview-captures';
await mkdir(directory, { recursive: true });
const results = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  let assetRequests = 0;
  page.on("request", request => { if (request.url().includes("/preview-captures/")) assetRequests++; });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/preview-captures/') && response.status() !== 200) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`http://127.0.0.1:3000?${paletteQuery(initialPalette)}`);
  await page.locator('[data-app-ready]').waitFor();
  for (const preview of previewCatalog) {
    const thumbnail = page.locator(`[data-capture="${preview.id}"]`);
    const screenshot = await thumbnail.screenshot();
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const original = await sharp(await readFile(`public/preview-captures/${preview.id}/light/original.webp`)).resize(info.width, info.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    let error = 0;
    for (let i = 0; i < data.length; i++) error += Math.abs(data[i] - original[i]);
    const meanError = error / data.length;
    assert.ok(meanError < 12, `${preview.id} must match the actual captured page (${meanError})`);
    results.push({ id: preview.id, state: 'captured layout', meanError });
  }
  assert.equal(await page.locator("iframe").count(), 0);
  const initialRequests = assetRequests;
  const target = page.locator('[data-capture="workspace"]');
  let previous = await sharp(await target.screenshot()).removeAlpha().raw().toBuffer();
  for (const [role, value] of Object.entries({ Text: '243841', Primary: '147d92', Secondary: 'dfe9ef', Accent: '884dcc', Background: 'f3f7fa' })) {
    await page.getByRole('button', { name: new RegExp(`^${role} `) }).click();
    await page.getByRole('textbox', { name: 'Hex', exact: true }).fill(value);
    await page.getByRole('textbox', { name: 'Hex', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    const screenshot = await target.screenshot();
    const current = await sharp(screenshot).removeAlpha().raw().toBuffer();
    const changed = current.reduce((sum, byte, index) => sum + (byte !== previous[index] ? 1 : 0), 0);
    assert.ok(changed > 10, `${role} must change the rendered screenshot`);
    assert.equal(await target.locator(`feFlood[result="${role.toLowerCase()}-color"]`).getAttribute('flood-color'), `#${value}`);
    results.push({ role, state: 'color changed', changedChannels: changed });
    previous = current;
  }
  assert.equal(assetRequests, initialRequests, 'Color edits must not reload capture assets');
  await page.screenshot({ path: `${directory}/recolored-desktop.png` });
  await page.getByRole('button', { name: 'Use dark palette', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.home-thumbnail image')].every(node => node.getAttribute('href').includes('/dark/')));
  for (const preview of previewCatalog) {
    await page.locator(`[data-capture="${preview.id}"]`).screenshot({ path: `${directory}/${preview.id}-dark.png` });
  }
  await page.screenshot({ path: `${directory}/dark-desktop.png` });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${directory}/pixel-checks.json`, JSON.stringify(results, null, 2));
}
console.log(`Passed ${results.length} screenshot layout and color checks.`);
