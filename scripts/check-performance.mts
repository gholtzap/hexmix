import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://127.0.0.1:3335';
const label = process.env.PERF_LABEL || 'candidate';
const repeats = Number(process.env.PERF_RUNS || 3);
const widths = (process.env.PERF_WIDTHS || '390,1440').split(',').map(Number);
const routes = (process.env.PERF_ROUTES || '/,/avenlo,/dashboards/infra-dashboard,/compare?preview=workspace').split(',');
const directory = `artifacts/performance/${label}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of widths) for (const route of routes) for (let run = 0; run < repeats; run++) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const session = await context.newCDPSession(page);
    let networkBytes = 0;
    session.on('Network.loadingFinished', event => { networkBytes += event.encodedDataLength; });
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 75_000 });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      const metrics = { lcp: 0, ready: 0, longTasks: 0 };
      Object.assign(window, { hexmixPerformance: metrics });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) metrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) metrics.longTasks += Math.max(0, entry.duration - 50); }).observe({ type: 'longtask', buffered: true });
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-app-ready]') && !metrics.ready) metrics.ready = performance.now();
      });
      observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-app-ready'] });
    });
    try {
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.locator('[data-app-ready]').first().waitFor();
      await page.waitForTimeout(1000);
      const result = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const js = resources.filter(entry => new URL(entry.name).pathname.endsWith('.js'));
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          ...(window as unknown as { hexmixPerformance: { lcp: number; ready: number; longTasks: number } }).hexmixPerformance,
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          bytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, nav.encodedBodySize),
          jsBytes: js.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          jsDecodedBytes: js.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
          resources: resources.map(entry => ({ url: new URL(entry.name).pathname, bytes: entry.encodedBodySize, decoded: entry.decodedBodySize, duration: entry.duration })),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(result.overflow, false, `${route} must fit ${width}px`);
      assert.deepEqual(errors, [], `${route} must have no script errors`);
      const frames = [];
      for (const frame of page.frames()) {
        frames.push(await frame.evaluate(() => ({
          url: new URL(location.href).pathname,
          start: performance.timeOrigin,
          ...(window as unknown as { hexmixPerformance: { lcp: number; ready: number; longTasks: number } }).hexmixPerformance,
          bytes: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        })));
      }
      assert(result.ready > 0 && result.jsBytes > 0);
      results.push({ width, route, run, ...result, networkBytes, frames, errors });
      if (!run) await page.screenshot({ path: `${directory}/${width}-${routes.indexOf(route)}.png` });
      console.log(JSON.stringify({ width, route, run, ready: Math.round(result.ready), lcp: Math.round(result.lcp), jsBytes: result.jsBytes, bytes: result.bytes }));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(`${directory}/measurements.json`, JSON.stringify({ conditions: { latencyMs: 150, downloadBytesPerSecond: 200_000, cpuRate: 4, cache: 'disabled', repeats }, results }, null, 2));
}
