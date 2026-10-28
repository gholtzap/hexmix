import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const root = process.env.PERF_REPORT_DIR || 'artifacts/performance';
const baseline = JSON.parse(await readFile(`${root}/baseline/measurements.json`, 'utf8'));
const candidate = JSON.parse(await readFile(`${root}/candidate/measurements.json`, 'utf8'));
assert.deepEqual(candidate.conditions, baseline.conditions);
assert.equal(candidate.results.length, baseline.results.length);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const metric = (result, key: string): number => key === 'contentPaint'
  ? Math.max(...result.frames.filter(frame => frame.lcp > 0).map(frame => frame.start - result.frames[0].start + frame.lcp))
  : result[key];
const rows = [];
for (const width of [390, 1440]) for (const route of [...new Set<string>(baseline.results.map(result => result.route))]) {
  const before = baseline.results.filter(result => result.width === width && result.route === route);
  const after = candidate.results.filter(result => result.width === width && result.route === route);
  assert.equal(before.length, baseline.conditions.repeats);
  assert.equal(after.length, before.length);
  const metrics = Object.fromEntries(['fcp', 'lcp', 'contentPaint', 'ready', 'jsBytes', 'jsDecodedBytes', 'bytes', 'networkBytes', 'longTasks'].map(key => {
    const a = median(before.map(result => metric(result, key))), b = median(after.map(result => metric(result, key)));
    return [key, { before: a, after: b, reductionPercent: a ? (a - b) / a * 100 : null }];
  }));
  if (route === '/') {
    assert(metrics.lcp.reductionPercent >= 50, `${width}px home LCP must improve by at least 50%`);
    assert(metrics.bytes.reductionPercent >= 50, `${width}px home transfer must fall by at least 50%`);
    assert(metrics.jsBytes.reductionPercent > 0, `${width}px home JavaScript must shrink`);
  }
  rows.push({ width, route, metrics });
}
const stateBefore = JSON.parse(await readFile(`${root}/baseline/state-reads.json`, 'utf8'));
const stateAfter = JSON.parse(await readFile(`${root}/candidate/state-reads.json`, 'utf8'));
assert(stateAfter.medianMs <= stateBefore.medianMs / 2, 'Repeated shared-state reads must improve by at least 50%');
const summary = { conditions: baseline.conditions, rows, stateReads: { beforeMs: stateBefore.medianMs, afterMs: stateAfter.medianMs, reductionPercent: (1 - stateAfter.medianMs / stateBefore.medianMs) * 100 }, limit: 'Home LCP and transfer have a 50% target. Content paint includes frame paint times relative to the top navigation; it is not a field Core Web Vitals score. Local production server; no hosted latency measurement.' };
await writeFile(`${root}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
