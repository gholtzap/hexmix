import {clickToolbarAction} from './lib/studio-toolbar.mts';
import {sitePreviews} from '../src/lib/previews.ts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expectUI } from 'lintapple/playwright';

const requestedSites = process.argv.slice(2);
const sites = requestedSites.length ? requestedSites : ['avenlo', 'tervix', 'orvian', 'nuvexa'];
assert(sites.every(site => Object.hasOwn(sitePreviews, site)), 'Unknown preview');
const ports = { avenlo: 3001, tervix: 3012, orvian: 3002, nuvexa: 3014 };
const brands = { avenlo: 'Avenlo', tervix: 'Tervix', orvian: 'Orvian', nuvexa: 'Nuvexa' };
const modeSurfaces = {
  avenlo: ['header.nav', 'backgroundColor'],
  tervix: ['main > section:first-child .rounded-2xl.mt-4 > .absolute.inset-0 > .bg-gradient-to-b', 'backgroundColor'],
  orvian: ['main > div:first-child > section', 'backgroundColor'],
  nuvexa: ['#customers', 'backgroundColor'],
};
const results = [];
const browser = await chromium.launch();
await mkdir('artifacts/pages', { recursive: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    for (const site of sites) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const audit = async state => {
        let report = { findings: [] };
        try {
          await expectUI(page, { attach: async (_, attachment) => {
            report = JSON.parse(String(attachment.body));
          } });
        } finally {
          results.push({ site, viewport, state, report });
        }
      };
      await page.goto(`http://127.0.0.1:3000/${sitePreviews[site].slug}`);
      await page.locator('[data-app-ready]').waitFor();
      const frame = page.frameLocator('iframe');
      await frame.locator('h1').first().waitFor();
      await frame.locator(`html[data-editor-brand="${brands[site]}"]`).waitFor();
      const waitForPalette = () => frame.locator('html').evaluate(element => new Promise<void>(resolve => {
        const check = () => element.dataset.contrastReady === 'true' && element.dataset.contrastPalette === ['text', 'background', 'primary', 'secondary', 'accent'].map(role => element.style.getPropertyValue(`--p-${role}`)).join('|') ? resolve() : setTimeout(check, 20);
        check();
      }));
      assert.equal(await page.title(), `${brands[site]} — Color preview | Hexmix`);
      assert(await frame.locator('body').innerText().then(text => text.includes(brands[site])), `${site} must show only its new name`);
      if (site !== 'tervix') {
        const wordmark = frame.locator('img[data-editor-wordmark]').first();
        await wordmark.waitFor();
        assert.equal(await wordmark.getAttribute('alt'), brands[site]);
      }
      assert.equal(await page.locator('iframe').getAttribute('src'), `http://127.0.0.1:${ports[site]}/`);
      await frame.locator(`html[data-editor-site="${site}"]`).waitFor();
      await waitForPalette();
      assert.equal(await frame.locator('html').getAttribute('data-editor-site'), site);
      if (site === 'orvian') {
        await frame.getByRole('button', { name: 'Book a demo', exact: true }).first().click();
        await frame.getByRole('dialog', { name: 'Book a demo' }).waitFor();
        await audit('demo dialog open');
        await frame.getByRole('button', { name: 'Close', exact: true }).click();
      }
      const graphic = frame.locator('img[data-editor-gradient]:not([data-editor-wordmark]):visible').first();
      await graphic.waitFor();
      const originalGraphic = await graphic.getAttribute('src');
      assert.match(originalGraphic, /^data:image\/svg\+xml,/);
      assert(await frame.locator('img[data-editor-gradient]').count() > 2, `${site} must have color-driven media`);
      const repeatedWrites = await graphic.evaluate(async image => {
        let writes = 0;
        const observer = new MutationObserver(records => { writes += records.filter(record => record.attributeName === 'src').length; });
        observer.observe(image, { attributes: true, attributeFilter: ['src'] });
        const marker = document.createElement('span');
        document.body.append(marker);
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        marker.remove();
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        observer.disconnect();
        return writes;
      });
      assert.equal(repeatedWrites, 0, `${site} must not reload unchanged media after page updates`);
      let proofBackground;
      let titleGradient;
      let editedTitleGradient;
      let paletteStyles;
      let originalPaletteStyles;
      if (site === 'avenlo') {
        const proof = frame.locator('.hero__yc[data-editor-proof]');
        await proof.waitFor();
        proofBackground = await proof.evaluate(element => getComputedStyle(element).backgroundImage);
        assert.match(proofBackground, /data:image\/svg\+xml/);
        assert.equal(await frame.locator('.stats .stat[data-editor-proof]').count(), 3);
        assert.equal(await frame.locator('.editor-proof-gallery [data-editor-proof]').count(), 3);
        assert.equal(await frame.locator('.footer__badges img').evaluateAll(images => images.every(image => !(image as HTMLImageElement).alt && (image as HTMLImageElement).src.startsWith('data:image/svg+xml,'))), true);
        assert.doesNotMatch(await frame.locator('body').innerText(), /Y Combinator|G2|102,023|Guido Ramirez|Dulan Perera|Frank Sondors|Ihsan Mohamed|Workday|ExampleTeam|Re-Leased|Agorapulse/i);
        assert.equal(await frame.locator('[data-logo-wall] img').first().getAttribute('alt'), '');
        assert((await frame.locator('.hero__typed').textContent()).trim().length > 0);
        titleGradient = await frame.locator('.hero__typed').evaluate(element => getComputedStyle(element).backgroundImage);
        assert.equal(await frame.locator('.g2 .g2__star, .quote__mark').count(), 0);
        assert.equal(await frame.locator('.job__art[data-editor-proof]').count(), 3);
        assert.equal(await frame.locator('.vcall .step__art[data-editor-proof]').count(), 4);
        assert.equal(await frame.locator('.job__art, .vcall .step__art').evaluateAll(elements => elements.every(element => element.childElementCount === 0)), true);
        assert.equal(await frame.locator('.job__check svg path, .link-arrow svg path').evaluateAll(paths => paths.length === 12 && paths.every(path => path.getAttribute('stroke') === 'currentColor')), true);
        paletteStyles = () => frame.locator('html').evaluate(() => {
          const css = selector => getComputedStyle(document.querySelector(selector));
          return {
            review: css('.g2').backgroundImage,
            quote: css('.quote__cell').backgroundImage,
            year: css('#jobs-title strong').backgroundImage,
            call: css('#vcall-title strong').backgroundImage,
            cards: css('.job__art').backgroundImage,
            steps: css('.vcall .step__art').backgroundImage,
            checks: css('.job__check').backgroundColor,
            arrow: css('.link-arrow').color,
          };
        });
        originalPaletteStyles = await paletteStyles();
      }
      const motionGraphic = frame.locator('video[data-editor-gradient], canvas[data-editor-gradient]').first();
      const motionBackground = async () => motionGraphic.evaluate(element => getComputedStyle(element.closest('[data-editor-media-container]')).backgroundImage);
      const originalMotionBackground = await motionGraphic.count() ? await motionBackground() : null;
      if (originalMotionBackground) assert.match(originalMotionBackground, /data:image\/svg\+xml/);
      await audit('default');
      await page.getByRole('button', { name: 'Primary color' }).click();
      await audit('color picker open');
      await page.getByRole('textbox', { name: 'Hex' }).fill('123456');
      await page.getByRole('textbox', { name: 'Hex' }).press('Enter');
      await frame.locator('html[data-editor-palette="true"]').waitFor();
      assert.equal(await frame.locator('html').evaluate(element => element.style.getPropertyValue('--p-primary')), '#123456');
      await waitForPalette();
      const editedGraphic = await graphic.getAttribute('src');
      assert.notEqual(editedGraphic, originalGraphic, `${site} graphics must follow the color picker`);
      assert(editedGraphic.includes('%23123456'), `${site} graphic must contain the selected color`);
      if (proofBackground) assert.notEqual(await frame.locator('.hero__yc').evaluate(element => getComputedStyle(element).backgroundImage), proofBackground);
      if (titleGradient) {
        editedTitleGradient = await frame.locator('.hero__typed').evaluate(element => getComputedStyle(element).backgroundImage);
        assert.notEqual(editedTitleGradient, titleGradient, 'Avenlo hero word must follow the palette');
      }
      if (paletteStyles) {
        const editedStyles = await paletteStyles();
        for (const key of Object.keys(originalPaletteStyles)) assert.notEqual(editedStyles[key], originalPaletteStyles[key], `Avenlo ${key} must follow the palette`);
        assert.match(editedStyles.cards, /%23123456/);
        assert.match(editedStyles.steps, /%23123456/);
      }
      if (originalMotionBackground) assert.notEqual(await motionBackground(), originalMotionBackground, `${site} video or canvas placeholder must follow the color picker`);
      await page.getByRole('button', { name: 'Close color picker' }).click();
      await clickToolbarAction(page, 'Fonts');
      await page.getByLabel('Headings').selectOption('Arial');
      await frame.locator('html').evaluate(element => new Promise<void>(resolve => { const check = () => element.style.getPropertyValue('--p-heading-font').startsWith('Arial') ? resolve() : setTimeout(check, 20); check(); }));
      assert.match(await frame.locator('html').evaluate(element => element.style.getPropertyValue('--p-heading-font')), /^Arial/);
      await audit('fonts open');
      await page.getByRole('button', { name: 'Close fonts' }).click();
      const [surface, property] = modeSurfaces[site];
      const surfaceStyle = () => frame.locator(surface).first().evaluate((element, property) => getComputedStyle(element)[property], property);
      const beforeMode = await surfaceStyle();
      const switchTheme = page.getByRole('button', { name: /Use (dark|light) palette/ });
      const theme = await switchTheme.getAttribute('aria-label');
      await switchTheme.click();
      await frame.locator(`html[data-editor-light="${theme === 'Use light palette'}"]`).waitFor();
      await waitForPalette();
      assert.notEqual(await surfaceStyle(), beforeMode, `${site} must change its page surface when the mode changes`);
      assert.notEqual(await graphic.getAttribute('src'), editedGraphic, `${site} graphics must follow the mode`);
      if (editedTitleGradient) assert.notEqual(await frame.locator('.hero__typed').evaluate(element => getComputedStyle(element).backgroundImage), editedTitleGradient, 'Avenlo hero word must stay visible in dark mode');
      await audit(theme);
      await page.screenshot({ path: `artifacts/pages/${site}-${viewport.width}-theme.png` });
      await switchTheme.click();
      await frame.locator(`html[data-editor-light="${theme !== 'Use light palette'}"]`).waitFor();
      await waitForPalette();
      assert.equal(await surfaceStyle(), beforeMode, `${site} must restore its page surface when the mode changes back`);
      await clickToolbarAction(page, 'Palettes');
      await audit('palettes open');
      await page.getByRole('button', { name: 'Close palettes' }).click();
      await clickToolbarAction(page, 'Export palette');
      await audit('export open');
      await page.getByRole('button', { name: 'Close export' }).click();
      await clickToolbarAction(page, 'Share palette');
      assert.equal(new URL(await page.evaluate(() => navigator.clipboard.readText())).pathname, `/${sitePreviews[site].slug}`);
      await clickToolbarAction(page, 'Hide color toolbar');
      await audit('toolbar hidden');
      await page.getByRole('button', { name: 'Open color toolbar' }).click();
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  const stillContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const stillPage = await stillContext.newPage();
  await stillPage.goto('http://127.0.0.1:3000/avenlo');
  const illustration = stillPage.frameLocator('iframe').locator('[data-hero-ill]');
  await illustration.waitFor();
  const motionState = () => illustration.evaluate(element => ({
    scene: element.querySelector('[data-v]')?.getAttribute('data-v'),
    runningAnimations: element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    playingVideos: [...element.querySelectorAll('video')].filter(video => !video.paused).length,
  }));
  const initialMotionState = await motionState();
  await stillPage.waitForTimeout(4000);
  assert.deepEqual(await motionState(), initialMotionState, 'Avenlo hero illustration must stay still');
  assert.equal(initialMotionState.runningAnimations, 0);
  assert.equal(initialMotionState.playingVideos, 0);
  await stillContext.close();
  const perfContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const perfPage = await perfContext.newPage();
  await perfPage.route('**/preview-contrast.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes('function correctText() {'));
    await route.fulfill({ response, body: source.replace('function correctText() {', 'function correctText() { window.__contrastRuns = (window.__contrastRuns || 0) + 1;') });
  });
  await perfPage.goto('http://127.0.0.1:3000/tervix');
  const perfFrame = perfPage.frames().find(frame => frame.parentFrame());
  await perfFrame.waitForFunction(() => window.__contrastRuns > 0);
  const initialPasses = await perfFrame.evaluate(() => window.__contrastRuns);
  for (let step = 0; step < 12; step++) {
    await perfFrame.evaluate(y => scrollTo(0, y), step * 600);
    await perfPage.waitForTimeout(120);
  }
  await perfPage.waitForTimeout(900);
  const contrastPasses = await perfFrame.evaluate(start => window.__contrastRuns - start, initialPasses);
  assert.ok(contrastPasses <= 10, `Tervix scroll must group contrast checks; got ${contrastPasses}`);
  await writeFile('artifacts/pages/tervix-scroll.json', JSON.stringify({ scrollSteps: 12, contrastPasses }, null, 2));
  await perfContext.close();
} finally {
  await browser.close();
  await writeFile('artifacts/pages/actions.json', JSON.stringify(results, null, 2));
}
console.log(`Checked ${sites.length} pages at 2 sizes and ${results.length} UI states. Report: artifacts/pages/actions.json`);
