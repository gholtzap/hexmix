import { measure } from './lib/measure-text-contrast.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';
import { contrast, initialPalette, paletteQuery } from '../src/lib/palette.ts';

const directory = 'artifacts/surface-contrast';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const reports = [], checks = [];
let completed = false;
const hex = value => `#${value.match(/[\d.]+/g).slice(0, 3).map(value => Math.round(Number(value)).toString(16).padStart(2, '0')).join('')}`;
const cases = [
  { name: 'black-on-light', text: '#000000', background: '#ffffff' },
  { name: 'white-on-light', text: '#ffffff', background: '#ffffff' },
  { name: 'black-on-dark', text: '#000000', background: '#0c0a09' },
  { name: 'white-on-dark', text: '#ffffff', background: '#0c0a09' },
];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const audit = async state => {
      let report;
      try { await expectUI(page, { attach: async (_, item) => { report = JSON.parse(String(item.body)); } }); }
      finally { reports.push({ viewport, state, report }); }
    };
    const readable = async (locator, label) => {
      // Wait for the source page's color transition before measuring its rendered text.
      await locator.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      const background = await locator.evaluate(node => {
        const context = document.createElement('canvas').getContext('2d');
        const rgba = value => { context.clearRect(0,0,1,1); context.fillStyle=value; context.fillRect(0,0,1,1); const color=[...context.getImageData(0,0,1,1).data]; color[3]/=255; return color; };
        const ancestors=[]; for(let parent=node;parent;parent=parent.parentElement) ancestors.push(parent);
        let result=[255,255,255]; for(const parent of ancestors.toReversed()){const color=rgba(getComputedStyle(parent).backgroundColor);result=color.slice(0,3).map((value,index)=>value*color[3]+result[index]*(1-color[3]));}
        return '#'+result.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');
      });
      const foreground = hex(await locator.evaluate(node => getComputedStyle(node).color));
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= 4.5, `${label}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1`);
      checks.push({ viewport, label, foreground, background, ratio });
    };
    for (const item of cases) {
      const palette = { ...initialPalette, ...item };
      await page.goto(`http://127.0.0.1:3000/orvian?${paletteQuery(palette)}`);
      await page.locator('[data-app-ready]').waitFor();
      const frame = page.frameLocator('iframe');
      await frame.locator('#mobile-menu').waitFor({ state: 'attached' });
      await frame.locator('html').evaluate(async node => {
        if (node.style.getPropertyValue('--p-on-dark')) return;
        await new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (node.style.getPropertyValue('--p-on-dark')) { observer.disconnect(); resolve(); } }); observer.observe(node, { attributes: true }); });
      });
      await frame.locator('html').evaluate(async (node, colors) => {
        const ready = () => node.dataset.contrastReady === 'true' && node.dataset.contrastPalette === ['text','background','primary','secondary','accent'].map(role => colors[role]).join('|');
        if (ready()) return;
        await new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); resolve(); } }); observer.observe(node, { attributes: true }); });
      }, palette);
      const nav = frame.locator('nav');
      const navBackground = hex(await nav.evaluate(node => getComputedStyle(node).backgroundColor));
      await readable(frame.locator('h1').first(), `${item.name} heading`);
      const headingColor = checks.at(-1).foreground;
      await readable(frame.locator('main > div:first-child > section p').first(), `${item.name} description`);
      const wordmark = await nav.locator('img[data-editor-wordmark]').evaluate(node => new DOMParser().parseFromString(decodeURIComponent((node as HTMLImageElement).src.split(',')[1]), 'image/svg+xml').querySelector('text').getAttribute('fill'));
      assert.ok(contrast(wordmark, navBackground) >= 4.5, 'The wordmark must use the header foreground');
      checks.push({ viewport, label: `${item.name} wordmark`, foreground: wordmark, background: navBackground, ratio: contrast(wordmark, navBackground) });
      if (viewport.width > 700) {
        await readable(nav.getByRole('button', { name: 'Resources', exact: true }), `${item.name} resources`);
        await readable(nav.getByRole('link', { name: /Book a demo/ }).first(), `${item.name} navigation action`);
        await nav.getByRole('button', { name: 'Resources', exact: true }).click();
        await frame.locator('#resources-menu').waitFor({ state: 'visible' });
        await readable(frame.locator('#resources-menu a').first(), `${item.name} resources menu`);
      } else {
        await readable(nav.getByRole('button', { name: 'Toggle menu', exact: true }), `${item.name} menu button`);
        await nav.getByRole('button', { name: 'Toggle menu', exact: true }).click();
        await frame.locator('#mobile-menu').waitFor({ state: 'visible' });
        await readable(frame.locator('#mobile-menu a').first(), `${item.name} mobile menu`);
      }
      await audit(`${item.name} navigation open`);
      await page.screenshot({ path: `${directory}/${viewport.width}-${item.name}.png` });
      await page.keyboard.press('Escape');
      await audit(`${item.name} content`);
      const source = page.frames().find(frame => frame.url().includes(':3002'));
      for (const scene of await frame.locator('[data-scene]').all()) {
        assert.equal(await scene.evaluate(node => getComputedStyle(node).backgroundImage), 'none');
        assert.equal(hex(await scene.evaluate(node => getComputedStyle(node).backgroundColor)), item.background);
      }
      const content = await measure(source);
      assert.ok(content.filter(node => node.selector.startsWith('H2.')).length >= 9);
      assert.ok(content.filter(node => node.selector.startsWith('H3.')).length >= 3);
      for (const node of content) {
        const ratio = contrast(node.foreground, node.background);
        assert.ok(ratio >= 4.5, `${item.name} ${node.label}: ${ratio.toFixed(2)}:1`);
        checks.push({ viewport, palette: item.name, ...node, ratio });
      }
      for (const [name, locator] of [
        ['features', frame.getByRole('heading', { level: 2 }).nth(1)],
        ['company', frame.getByRole('heading', { name: 'The bigger picture', exact: true })],
        ['security', frame.getByRole('heading', { level: 2 }).nth(4)],
        ['faq', frame.locator('#faq section')],
        ['footer', frame.locator('footer')],
      ] as const) {
        await locator.evaluate(node => node.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: `${directory}/${viewport.width}-${item.name}-${name}.png` });
      }
      const question = frame.locator('#faq button').nth(1);
      await question.click();
      assert.equal(await question.getAttribute('aria-expanded'), 'true');
      await audit(`${item.name} faq open`);
      await page.screenshot({ path: `${directory}/${viewport.width}-${item.name}-faq-open.png` });

      await page.goto(`http://127.0.0.1:3000/?${paletteQuery(palette)}`);
      await page.locator('[data-app-ready]').waitFor();
      assert.equal(await page.locator('[data-capture="orvian"] feFlood[result="text-color"]').getAttribute('flood-color'), headingColor);
      await audit(`${item.name} thumbnail`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  completed = true;
} finally {
  await browser.close();
  await writeFile(`${directory}/report.json`, JSON.stringify({ completed, reports, checks }, null, 2));
}
console.log(`Passed ${checks.length} surface contrast checks and ${reports.length} UI states.`);
