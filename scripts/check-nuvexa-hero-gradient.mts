import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { contrast, initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
import { sitePreviews } from '../src/lib/previews.ts';
const base = process.env.APP_URL || 'http://127.0.0.1:3100';
const out = 'artifacts/nuvexa-hero-gradient'; await mkdir(out, { recursive: true });
const browser = await chromium.launch(), results = [], errors = [];
try {
  for (const width of [390, 1440]) for (const mode of ['light', 'dark', 'default']) {
    const palette = mode === 'default' ? sitePreviews.nuvexa.colors : mode === 'light' ? initialPalette : defaultDarkPalette;
    const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: mode === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
    page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(`${base}/nuvexa${mode === 'default' ? '' : '?' + paletteQuery(palette)}`);
      await page.locator('iframe[data-preview-ready=true]').waitFor();
      const frame = page.frameLocator('iframe');
      await frame.locator('html[data-copy-ready=true][data-contrast-ready=true]').waitFor();
      const native = await (await frame.locator('html').elementHandle())!.ownerFrame();
      await native!.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect!.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); scrollTo(0, 220); });
      const artwork = frame.locator('#hero-dark > [data-framer-name="Hero Background Video"]');
      const image = await artwork.evaluate(n => getComputedStyle(n).backgroundImage);
      assert.notEqual(image, 'none');
      assert.ok(decodeURIComponent(image).includes(palette.primary));
      assert.equal(await frame.locator('#hero-dark video').evaluate((n: HTMLVideoElement) => getComputedStyle(n).opacity === '0'), true);
      const text = await frame.locator('#hero-dark [data-framer-name="Opening Content"]').evaluate(root => {
        const canvas = document.createElement('canvas').getContext('2d')!;
        return [...root.querySelectorAll('h1,p,span')].filter(n => [...n.childNodes].some(c => c.nodeType === Node.TEXT_NODE && c.textContent?.trim())).map(n => {
          const s = getComputedStyle(n), box = n.getBoundingClientRect(); canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = s.webkitTextFillColor || s.color; canvas.fillRect(0, 0, 1, 1);
          return { label: n.textContent!.trim(), color: '#' + [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3).map(c => c.toString(16).padStart(2, '0')).join(''), box: box.toJSON() };
        });
      });
      const surface = await page.screenshot({ style: '#hero-dark [data-framer-name="Opening Content"],#hero-dark [data-framer-name="Opening Content"] *,.toolbar-anchor { visibility:hidden!important }' });
      const { data, info } = await sharp(surface).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const bounds = (await page.locator('iframe').boundingBox())!;
      const samples = [];
      for (const item of text) for (const fraction of [0.05, 0.5, 0.95]) {
        const x = Math.round(bounds.x + item.box.x + item.box.width * fraction), y = Math.round(bounds.y + item.box.y + item.box.height * 0.5);
        if (x < 0 || x >= info.width || y < 80 || y >= info.height - 110) continue;
        const offset = (y * info.width + x) * info.channels;
        const background = '#' + [...data.subarray(offset, offset + 3)].map(c => c.toString(16).padStart(2, '0')).join('');
        const ratio = contrast(item.color, background); samples.push({ label: item.label, foreground: item.color, background, ratio });
        assert.ok(ratio >= 4.5, `${width} ${mode}: ${item.label} contrast ${ratio}`);
      }
      assert.ok(samples.length, 'Hero text must be checked against the rendered gradient');
      await page.screenshot({ path: `${out}/${width}-${mode}.png` });
      await page.getByRole('button', { name: 'Primary color', exact: true }).click();
      await page.getByRole('textbox', { name: 'Hex', exact: true }).fill('738fbd');
      await page.getByRole('textbox', { name: 'Hex', exact: true }).press('Enter');
      await page.getByRole('button', { name: 'Close color picker', exact: true }).click();
      await native!.waitForFunction(() => document.documentElement.style.getPropertyValue('--p-primary') === '#738fbd' && document.documentElement.dataset.contrastReady === 'true');
      const changed = await artwork.evaluate(n => getComputedStyle(n).backgroundImage);
      assert.notEqual(changed, image); assert.ok(decodeURIComponent(changed).includes('#738fbd'));
      results.push({ width, mode, samples, paletteChange: true, static: true });
      console.log(width, mode, 'passed');
    } finally { await page.close(); }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify({ results, errors }, null, 2)); }
