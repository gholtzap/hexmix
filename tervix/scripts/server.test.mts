import type {AddressInfo} from 'node:net';
import type {CapturedAsset} from '../../scripts/lib/assets.mts';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createCloneServer } from './server.mts';
const server = createCloneServer();
let base;
before(async () => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
after(() => new Promise(resolve => server.close(resolve)));
const post = body => fetch(base + '/api/playground/generate', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
test('root serves captured HTML with local script and connection policy', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<!DOCTYPE html>/i);
  const injected = '<link rel="stylesheet" href="/home-media.css"><script src="/home-media.js" defer></script><script src="/color-bridge.js" defer></script>';
  assert(html.includes(injected));
  const source = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const normalize = (body: string) => body.replaceAll('http://127.0.0.1:3000', '').replaceAll('/render-assets/tervix/', '/');
  assert.equal(normalize(html.slice(html.indexOf('</head>'))), normalize(source.slice(source.indexOf('</head>'))));
  assert.match(html, /<title>Tervix \| A clearer way to run your work<\/title>/);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
});
test('optimized image uses its exact query mapping', async () => {
  const manifest: CapturedAsset[] = JSON.parse(await readFile(new URL('../assets.json', import.meta.url), 'utf8'));
  const asset = manifest.find(asset => asset.request.startsWith('/_next/image?'));
  const response = await fetch(base + asset.request);
  assert.equal(response.status, 200);
  const reordered = new URL(asset.request, base);
  reordered.searchParams.sort();
  assert.equal((await fetch(reordered)).status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, asset.bytes);
  assert.equal((await fetch(base + '/_next/image?url=unknown&w=1&q=75')).status, 404);
});
test('captured FAQ data keeps its React stream byte length', async () => {
  const html = await (await fetch(base)).text();
  const stream = [...html.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/gs)]
    .map(match => JSON.parse(match[1])).filter(row => row[0] === 1).map(row => row[1]).join('');
  const record = /\ne:T([0-9a-f]+),/.exec(stream);
  assert(record, 'The captured FAQ record must exist');
  const payload = Buffer.from(stream.slice(record.index + record[0].length));
  const length = parseInt(record[1], 16);
  assert.equal(JSON.parse(payload.subarray(0, length).toString())['@type'], 'FAQPage');
  assert.match(payload.subarray(length).toString(), /^[0-9a-f]+:/);
  const provider = /^2:I(.+)$/m.exec(stream);
  assert.equal(JSON.parse(provider[1])[2], 'PostHogProvider');
});
test('HEAD returns headers and no body', async () => {
  const response = await fetch(base, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert(Number(response.headers.get('content-length')) > 0);
  assert.equal(await response.text(), '');
});
test('encoded traversal cannot read outside public', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = request(base, { path: '/%2e%2e/package.json' }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 400);
});
test('missing assets and backend routes return 404', async () => {
  for (const path of ['/missing.png', '/_next/static/missing.js', '/api/private', '/unknown-page']) assert.equal((await fetch(base + path)).status, 404);
});
test('catalog and utility routes stay on local source-derived pages', async () => {
  const destinations = JSON.parse(await readFile(new URL('../../src/lib/site-destinations.json', import.meta.url), 'utf8')).tervix;
  const routes = [...Object.keys(destinations), 'demo', 'login', 'register', 'contact', 'status', 'developers', 'about', 'documentation/quickstart/workflows', 'documentation/workflows/cli', 'documentation/workflows/sdk', 'documentation/workflows/mcp', 'b/PjJi2uwE8C', 'b/3YHSAVUHf1', ...[1, 2, 3, 4, 5].map(number => `compare/approach-${number}`)];
  for (const route of routes) {
    const response = await fetch(base + '/' + route, { redirect: 'manual' });
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /data-static-source-page="true"/, route);
  }
});
test('linked source pages stay local', async () => {
  const manifest = (await readdir(new URL('../public/subpages/', import.meta.url), { recursive: true })).filter(file => file.endsWith('.html')).map(file => ({ path: '/' + file.slice(0, -5) }));
  for (const { path } of manifest) {
    const response = await fetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /data-static-source-page="true"/, path);
  }
  const guide = await fetch(base + '/llms.txt');
  assert.equal(guide.status, 200);
  assert.match(guide.headers.get('content-type'), /text\/plain/);
});
test('canonical links replace source route aliases', async () => {
  const aliases = JSON.parse(await readFile(new URL('../route-aliases.json', import.meta.url), 'utf8'));
  assert.deepEqual(aliases, {});
  for (const [alias, source] of [['/compare/approach-1','/compare/approach-1'],['/blog/topic-001','/blog/topic-001']]) {
    const response = await fetch(base + alias, { redirect: 'manual' });
    assert.equal(response.status, 200, alias);
    const sourceResponse = await fetch(base + source);
    assert.equal(await response.text(), await sourceResponse.text(), alias);
  }
});
test('every captured internal page link has a local destination', async () => {
  const dir = new URL('../public/subpages/', import.meta.url);
  const paths = new Set<string>();
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.html')) {
        const html = await readFile(path, 'utf8');
        for (const match of html.matchAll(/<a\b[^>]*href="(\/[^"#?]*)/gi)) if (match[1] !== '/') paths.add(match[1]);
      }
    }
  };
  await visit(dir);
  for (const path of paths) assert.equal((await fetch(base + path)).status, 200, path);
});
test('captured pages use local media and generic visible names', async () => {
  const dir = new URL('../public/subpages/', import.meta.url);
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.html')) {
        const html = await readFile(path, 'utf8');
        const text = html.replace(/<[^>]+>/g, ' ');
        assert.doesNotMatch(text, /\b(?:Rundeck|StackStorm|Backstage|GitHub|GitLab|LinkedIn|YouTube|Google|Slack|Kubernetes|Databricks|Cloudflare|Supabase|PagerDuty|Jira|Claude Code|Cursor|Codex|OpenClaw|Homebrew)\b/i, path.pathname);
        for (const match of html.matchAll(/<img\b[^>]*src="([^"]+)"/gi)) assert.equal(match[1], '/media-893f0f560686fc.png', path.pathname);
      }
    }
  };
  await visit(dir);
});
test('unsupported methods return 405', async () => {
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/api/playground/generate')).status, 405);
});
test('demo rejects invalid JSON and invalid prompts', async () => {
  for (const body of ['{', 'null', '{}', '{"prompt":123}', '{"prompt":"  "}', JSON.stringify({ prompt: 'a'.repeat(1001) })]) assert.equal((await post(body)).status, 400);
});
test('demo returns the same valid sample for different prompts', async () => {
  const response = await post(JSON.stringify({ prompt: 'Build a workflow' }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.success, true);
  assert.match(result.name, /^Demo workflow:/);
  assert.match(result.explanation, /not generated from your prompt/);
  assert(result.definition.nodes.length > 0);
  assert(result.trigger_config.source);
  const ids = new Set(result.definition.nodes.map(node => node.id));
  for (const node of result.definition.nodes) {
    assert.equal(typeof node.type, 'string');
    assert.equal(typeof node.data.label, 'string');
    assert(Number.isFinite(node.position.x) && Number.isFinite(node.position.y));
  }
  for (const edge of result.definition.edges) assert(ids.has(edge.source) && ids.has(edge.target));
  const boundary = await post(JSON.stringify({ prompt: 'a'.repeat(1000) }));
  assert.equal(boundary.status, 200);
  assert.deepEqual(await boundary.json(), result);
});
test('demo bounds request body size', async () => { assert.equal((await post(JSON.stringify({ prompt: 'a'.repeat(17000) }))).status, 413); });
