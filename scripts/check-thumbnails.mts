import {clickToolbarAction} from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { defaultDarkPalette, initialPalette, paletteQuery } from '../src/lib/palette.ts';
import { previewCatalog } from '../src/lib/preview-catalog.ts';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const directory = 'artifacts/preview-captures';
await mkdir(directory, { recursive: true });
const results = [];
async function captureThumbnail(page, thumbnail) {
  const toolbar = await page.locator('.toolbar-anchor').count();
  if (toolbar) await clickToolbarAction(page, 'Hide color toolbar');
  const image = await thumbnail.screenshot();
  if (toolbar) await page.getByRole('button', {name:'Open color toolbar',exact:true}).click();
  return image;
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  let assetRequests = 0;
  const assetURLs: string[] = [];
  page.on("request", request => { if (request.url().includes("/preview-captures/")) { assetRequests++; assetURLs.push(request.url()); } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/preview-captures/') && response.status() !== 200) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${base}?${paletteQuery(initialPalette)}`);
  await page.locator('[data-app-ready]').waitFor();
  for (const preview of previewCatalog) {
    const thumbnail = page.locator(`[data-capture="${preview.id}"]`);
    await thumbnail.scrollIntoViewIfNeeded();
    await thumbnail.locator('image[href]').waitFor({ state: 'attached' });
    assert.ok(await thumbnail.locator('.thumbnail-placeholder rect').count(), 'The capture must have a placeholder while the image loads');
    await thumbnail.locator('image').evaluate(async node => {
      const image = new Image(); image.src = node.getAttribute('href'); await image.decode();
    });
    await thumbnail.locator('image[opacity="1"]').waitFor();
    const screenshot = await captureThumbnail(page, thumbnail);
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
  assert.equal(await page.locator('.home-thumbnail feImage').count(), 0, 'Default colors must not load recoloring masks');
  assert.ok(assetURLs.every(url => url.endsWith('/original.webp')), 'Default colors must load only the original screenshots');
  const target = page.locator('[data-capture="workspace"]');
  let previous = await sharp(await captureThumbnail(page, target)).removeAlpha().raw().toBuffer();
  for (const [role, value] of Object.entries({ Text: '243841', Primary: '147d92', Secondary: 'dfe9ef', Accent: '884dcc', Background: 'f3f7fa' })) {
    await page.getByRole('button', { name: new RegExp(`^${role} `) }).click();
    await page.getByRole('textbox', { name: 'Hex', exact: true }).fill(value);
    await page.getByRole('textbox', { name: 'Hex', exact: true }).press('Enter');
    await page.getByRole('button', { name: /^Close(?: color picker)?$/ }).click();
    assert.equal(await target.locator('rect[filter]').count(), 1, 'A changed palette must apply the color filter');
    const screenshot = await captureThumbnail(page, target);
    const current = await sharp(screenshot).removeAlpha().raw().toBuffer();
    const changed = current.reduce((sum, byte, index) => sum + (byte !== previous[index] ? 1 : 0), 0);
    assert.ok(changed > 10, `${role} must change the rendered screenshot`);
    assert.equal(await target.locator(`feFlood[result="${role.toLowerCase()}-color"]`).getAttribute('flood-color'), `#${value}`);
    results.push({ role, state: 'color changed', changedChannels: changed });
    previous = current;
  }
  assert.equal(assetRequests, initialRequests + previewCatalog.length * 6, 'Color edits must load each recoloring image once');
  await page.screenshot({ path: `${directory}/recolored-desktop.png` });
  await clickToolbarAction(page, 'Use dark palette');
  await page.waitForFunction(() => [...document.querySelectorAll('.home-thumbnail image')].every(node => node.getAttribute('href').includes('/dark/')));
  for (const preview of previewCatalog) {
    await page.locator(`[data-capture="${preview.id}"]`).screenshot({ path: `${directory}/${preview.id}-dark.png` });
  }
  await page.screenshot({ path: `${directory}/dark-desktop.png` });
  const fallback = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await fallback.route('**/preview-captures/**', route => route.abort());
  await fallback.goto(`${base}?${paletteQuery(defaultDarkPalette)}`, { waitUntil: 'domcontentloaded' });
  await fallback.locator('[data-app-ready]').waitFor();
  const waiting = fallback.locator('[data-capture="nuvexa"]');
  assert.equal(await waiting.locator('.thumbnail-placeholder rect').first().getAttribute('fill'), defaultDarkPalette.background);
  const fallbackImage = await captureThumbnail(fallback, waiting);
  await writeFile(`${directory}/nuvexa-loading.png`, fallbackImage);
  const { data: fallbackPixels, info: fallbackInfo } = await sharp(fallbackImage).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (Math.floor(fallbackInfo.height * .6) * fallbackInfo.width + Math.floor(fallbackInfo.width * .8)) * fallbackInfo.channels;
  const expected = defaultDarkPalette.secondary.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
  assert.deepEqual([...fallbackPixels.subarray(pixel, pixel + 3)], expected, 'A failed image download must leave the colored placeholder visible');
  await fallback.close();
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${directory}/pixel-checks.json`, JSON.stringify(results, null, 2));
}
console.log(`Passed ${results.length} screenshot layout and color checks.`);
