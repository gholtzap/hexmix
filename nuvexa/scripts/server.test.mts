import type {AddressInfo} from 'node:net';
import type {CapturedAsset} from '../../scripts/lib/assets.mts';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createCloneServer } from './server.mts';
const manifest: CapturedAsset[] = JSON.parse(await readFile(new URL('../assets.json', import.meta.url), 'utf8'));
const server = createCloneServer();
let base;
before(async () => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
after(() => new Promise(resolve => server.close(resolve)));
const rawStatus = path => new Promise((resolve, reject) => {
  const req = request(base, { path }, res => { res.resume(); resolve(res.statusCode); });
  req.on('error', reject); req.end();
});
test('root serves the captured HTML and local connection policy', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<!DOCTYPE html>/i);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.match(response.headers.get('content-security-policy'), /frame-src 'none'/);
});
test('asset query matches exactly and unknown sizes use a local variant', async () => {
  const asset = manifest.find(asset => asset.request.includes('?'));
  assert(asset, 'Expected a downloaded image variant');
  const url = new URL(asset.request, base);
  url.searchParams.sort();
  const exact = await fetch(url);
  assert.equal(exact.status, 200);
  assert.equal((await exact.arrayBuffer()).byteLength, asset.bytes);
  const fallback = await fetch(base + url.pathname + '?width=17&local-test=1');
  assert.equal(fallback.status, 200);
  const downloaded = manifest.filter(item => new URL(item.request, base).pathname === url.pathname);
  assert(downloaded.some(item => item.bytes === Number(fallback.headers.get('content-length'))));
  await fallback.body.cancel();
});
test('HEAD serves length without a body', async () => {
  const response = await fetch(base, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert(Number(response.headers.get('content-length')) > 0);
  assert.equal(await response.text(), '');
});
test('video supports bounded, open, suffix and HEAD ranges', async () => {
  const video = manifest.find(asset => asset.type.startsWith('video/'));
  for (const [range, start, end] of [['bytes=0-15', 0, 15], ['bytes=-16', video.bytes - 16, video.bytes - 1], [`bytes=${video.bytes - 16}-`, video.bytes - 16, video.bytes - 1]]) {
    const response = await fetch(base + video.request, { headers: { Range: String(range) } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${video.bytes}`);
    assert.equal((await response.arrayBuffer()).byteLength, 16);
  }
  const head = await fetch(base + video.request, { method: 'HEAD', headers: { Range: 'bytes=0-15' } });
  assert.equal(head.status, 206);
  assert.equal(head.headers.get('content-length'), '16');
  assert.equal(await head.text(), '');
});
test('invalid and multiple video ranges return 416', async () => {
  const video = manifest.find(asset => asset.type.startsWith('video/'));
  for (const range of ['bytes=8-2', 'bytes=-0', `bytes=${video.bytes}-`, 'bytes=0-1,4-5', 'items=0-1', 'bytes=-', 'bytes=999999999999999999999999999-']) {
    const response = await fetch(base + video.request, { headers: { Range: String(range) } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), `bytes */${video.bytes}`);
  }
});
test('traversal and malformed paths are rejected', async () => {
  for (const path of ['/%2e%2e/package.json', '/%zz', '/assets/%00', '/assets/..%5cpackage.json']) assert.equal(await rawStatus(path), 400);
});
test('missing asset and API return 404', async () => {
  for (const path of ['/assets/missing', '/api/private', '/missing.png']) assert.equal((await fetch(base + path)).status, 404);
});
test('unsupported methods return 405', async () => {
  const response = await fetch(base, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});
test('captured subpages serve local HTML', async () => {
  for (const route of ['products/quotes-and-tenders', 'products/order-processing', 'integrations', 'solutions/distributors', 'solutions/manufacturers', 'success-stories', 'success-stories/story-a', 'success-stories/story-b', 'success-stories/story-c', 'privacy', 'imprint', 'terms', 'about', 'careers', 'contact']) {
    const response = await fetch(base + '/' + route, { redirect: 'manual' });
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /subpages\.js/, route);
  }
});
test('unknown page links return 404', async () => {
  const response = await fetch(base + '/not-captured?ref=clone', { redirect: 'manual' });
  assert.equal(response.status, 404);
});
