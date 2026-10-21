import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const sites = ['avenlo', 'tervix', 'orvian', 'nuvexa'];
const pairs = {
  light: [
    { text: '#19304c', background: '#f3f8ff', primary: '#2375c9', secondary: '#d2e4f8', accent: '#4b92de' },
    { text: '#391d29', background: '#fff4f1', primary: '#d44365', secondary: '#f4ccdc', accent: '#a94caa' },
  ],
  dark: [
    { text: '#e9f6ff', background: '#102336', primary: '#76addc', secondary: '#294b65', accent: '#b6d5eb' },
    { text: '#fff1f4', background: '#321522', primary: '#e69ab5', secondary: '#613548', accent: '#f2bfd0' },
  ],
};
const browser = await chromium.launch();
const output = [];
try {
  for (const width of [390, 1440]) for (const site of sites) for (const [mode, palettes] of Object.entries(pairs)) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:3000/${site}`);
    await page.locator('[data-app-ready]').waitFor();
    const frame = page.frameLocator('iframe');
    await frame.locator('html[data-editor-brand]').waitFor();
    type Snapshot={index:number;name:string;svg:boolean;borderWidth:number;corrected:boolean;text:string;values:Record<string,string>;image:string};
    const snapshots: Snapshot[][] = [];
    for (const palette of palettes) {
      await page.locator('iframe').evaluate((iframe, input) => (iframe as HTMLIFrameElement).contentWindow.postMessage({
        type: 'color-editor-theme', palette: input.palette,
        foregrounds: { background: input.palette.text, secondary: input.palette.text, primary: input.palette.background, dark: input.palette.background },
        heading: 'System', body: 'System', paletteActive: true, dark: input.mode === 'dark',
      }, new URL((iframe as HTMLImageElement).src).origin), { palette, mode });
      await frame.locator('html').evaluate((html, color) => new Promise<void>(resolve => {
        const done = () => html.style.getPropertyValue('--p-primary') === color && html.dataset.contrastReady === 'true' && html.dataset.contrastPalette?.split('|')[2] === color ? resolve() : setTimeout(done, 20);
        done();
      }), palette.primary);
      snapshots.push(await frame.locator('body').evaluate(body => {
        const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'fill', 'stroke', 'boxShadow'];
        return [...body.querySelectorAll('*')].map((element, index) => {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          if (box.width < 3 || box.height < 3 || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < .05) return null;
          const name = element.tagName.toLowerCase() + ((element as SVGElement).className?.baseVal ?? element.className ?? '').toString().trim().split(/\s+/).slice(0, 2).map(item => `.${item}`).join('');
          return {
            index, name, svg: element.namespaceURI === 'http://www.w3.org/2000/svg', borderWidth: parseFloat(style.borderTopWidth),
            corrected: element.hasAttribute('data-preview-foreground'),
            text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 38),
            values: Object.fromEntries(props.map(prop => [prop, style[prop]])),
            image: element.tagName === 'IMG' ? element.getAttribute('src') : null,
          };
        }).filter(Boolean);
      }));
    }
    const second = new Map(snapshots[1].map(item => [item.index, item]));
    const unchanged = [];
    for (const item of snapshots[0]) {
      const next = second.get(item.index);
      if (!next || next.name !== item.name) continue;
      for (const [prop, value] of Object.entries(item.values)) {
        if (value !== next.values[prop] || value === 'none' || value === 'transparent' || value === 'currentcolor') continue;
        if ((prop === 'fill' || prop === 'stroke') && (!item.svg || value.startsWith('url('))) continue;
        if (prop === 'borderTopColor' && !item.borderWidth) continue;
        if (/^(?:rgba\([^)]*, 0\)|color\(srgb [^)]* \/ 0\))$/.test(value)) continue;
        if (item.corrected && (value === 'rgb(255, 255, 255)' || value === 'rgb(0, 0, 0)')) continue;
        unchanged.push({ element: item.name, text: item.text, prop, value });
      }
      if (item.image && item.image === next.image && !item.image.startsWith('data:')) unchanged.push({ element: item.name, text: item.text, prop: 'image', value: item.image });
    }
    output.push({ site, width, mode, checked: snapshots[0].length, unchanged });
    console.log(`${site} ${width} ${mode}: ${snapshots[0].length} visible elements, ${unchanged.length} fixed colors or images`);
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile('artifacts/pages/palette-surface-audit.json', JSON.stringify(output, null, 2));
}
assert.deepEqual(output.flatMap(item => item.unchanged.map(value => ({ site: item.site, width: item.width, mode: item.mode, ...value }))), []);
