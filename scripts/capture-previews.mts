import {clickToolbarAction} from './lib/studio-toolbar.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { previewCatalog } from '../src/lib/preview-catalog.ts';
import { defaultDarkPalette, initialPalette, paletteQuery, roles } from '../src/lib/palette.ts';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const width = 1200, height = 750;
const compress = input => sharp(input).resize(720, 450).webp({ lossless: true }).toBuffer();
const requested = process.argv.slice(2);
assert.ok(requested.every(id => previewCatalog.some(preview => preview.id === id)), "Unknown preview ID");
const targets = requested.length ? previewCatalog.filter(preview => requested.includes(preview.id)) : previewCatalog;
const browser = await chromium.launch();
const reports = [];
try {
  for (const preview of targets) {
    for (const mode of ['light', 'dark']) {
      const palette = mode === 'light' ? initialPalette : defaultDarkPalette;
      console.log(`Capturing ${preview.id} (${mode})`);
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(20000);
      await page.goto(`${base}${preview.path}?${paletteQuery(palette)}`);
      await page.locator('[data-app-ready]').waitFor();
      await clickToolbarAction(page, 'Hide color toolbar');
      await page.getByRole('button', {name:'Open color toolbar',exact:true}).waitFor();
      const frame = page.frameLocator('iframe');
      if(['avenlo','tervix','orvian','nuvexa'].includes(preview.id))await frame.locator('html[data-copy-ready=true]').waitFor();
      if(preview.id==='tervix')await frame.locator('html[data-home-ready=true]').waitFor();
      await frame.locator('html').evaluate(async (node, color) => {
        await Promise.race([document.fonts.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Preview fonts did not load')), 15000))]);
        if (node.style.getPropertyValue('--p-primary') !== color) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('Preview did not apply the palette')); }, 15000);
            const observer = new MutationObserver(() => {
              if (node.style.getPropertyValue('--p-primary') === color) { clearTimeout(timeout); observer.disconnect(); resolve(); }
            });
            observer.observe(node, { attributes: true });
          });
        }
        await Promise.race([Promise.all([...document.images].filter(image => { const r = image.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < 750 && r.bottom > 0; }).map(image => image.decode().catch(() => {}))), new Promise<void>(resolve => setTimeout(resolve, 5000))]);
      }, palette.primary);
      await frame.locator('html[data-contrast-ready="true"]').waitFor();
      await frame.locator('html').evaluate(async (node, palette) => {
        const ready = () => node.dataset.contrastReady === 'true' && node.dataset.contrastPalette === ['text','background','primary','secondary','accent'].map(role => palette[role]).join('|');
        if (ready()) return;
        await new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); resolve(); } }); observer.observe(node, { attributes:true }); });
      }, palette);
      if (preview.id === 'nuvexa') await frame.locator('html').evaluate(async () => {
        await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
        window.scrollTo({ top: 220, behavior: 'instant' });
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      await page.locator('.toolbar-anchor, .toolbar-reopen, .preview-site-switcher').evaluateAll(nodes => nodes.forEach(node => { node.style.visibility = 'hidden'; }));
      const image = await page.screenshot({ clip: { x: 0, y: 0, width, height }, animations: 'disabled' });
      const directory = `public/preview-captures/${preview.id}/${mode}`;
      await mkdir(directory, { recursive: true });
      const layers = await page.evaluate(async ({ png, palette, roles, width, height }) => {
        const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const original = context.getImageData(0, 0, width, height);
        const fixed = new ImageData(new Uint8ClampedArray(original.data), width, height);
        const masks = roles.map(() => new ImageData(width, height));
        const colors = roles.map(role => [1, 3, 5].map(i => parseInt(palette[role].slice(i, i + 2), 16)));
        const background = colors[roles.indexOf('background')];
        const text = colors[roles.indexOf('text')];
        const delta = text.map((v, k) => v - background[k]);
        const length = delta.reduce((sum, v) => sum + v * v, 0);
        let changed = 0, error = 0;
        for (let offset = 0; offset < original.data.length; offset += 4) {
          const pixel = original.data.subarray(offset, offset + 3);
          const t = Math.max(0, Math.min(1, delta.reduce((sum, v, k) => sum + (pixel[k] - background[k]) * v, 0) / length));
          let distance = pixel.reduce((sum, v, k) => sum + (v - background[k] - delta[k] * t) ** 2, 0);
          let weights = [[roles.indexOf('text'), Math.round(t * 255)], [roles.indexOf('background'), 255 - Math.round(t * 255)]];
          for (const [index, color] of colors.entries()) {
            const d = pixel.reduce((sum, v, k) => sum + (v - color[k]) ** 2, 0);
            if (d < distance) { distance = d; weights = [[index, 255]]; }
          }
          // shortcut: captured artwork stays fixed; recapture when the source design changes.
          if (distance > 3 ** 2) continue;
          fixed.data[offset + 3] = 0;
          for (const [index, alpha] of weights) masks[index].data.set([255, 255, 255, alpha], offset);
          changed++;
          error += pixel.reduce((sum, v, k) => sum + Math.abs(v - weights.reduce((n, [index, alpha]) => n + colors[index][k] * alpha / 255, 0)), 0);
        }
        const encode = data => { context.putImageData(data, 0, 0); return canvas.toDataURL('image/png').split(',')[1]; };
        return { fixed: encode(fixed), masks: masks.map(encode), changed, meanError: error / (width * height * 3) };
      }, { png: image.toString('base64'), palette, roles, width, height });
      assert.ok(layers.changed > width * height / 1000, `${preview.id}: capture must contain palette-colored pixels`);
      assert.ok(layers.meanError < 3, `${preview.id}: reconstruction must retain the captured colors`);
      await writeFile(`${directory}/original.webp`, await compress(image));
      await writeFile(`${directory}/fixed.webp`, await compress(Buffer.from(layers.fixed, 'base64')));
      for (const [i, role] of roles.entries()) await writeFile(`${directory}/${role}.webp`, await compress(Buffer.from(layers.masks[i], 'base64')));
      reports.push({ id: preview.id, mode, captureWidth: width, captureHeight: height, width: 720, height: 450, meanError: layers.meanError, recoloredPixels: layers.changed });
      console.log(`Captured ${preview.id} (${mode})`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await mkdir('artifacts/preview-captures', { recursive: true });
  await writeFile('artifacts/preview-captures/report.json', JSON.stringify(reports, null, 2));
}
assert.equal(reports.length, targets.length * 2);
