import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from './shared-snapshot.ts';
import { validShareHref } from './shared-link.ts';

test('snapshots allow local preview routes and reject external or server routes', () => {
  for (const href of ['/', '/editor?colors=ffffff-000000-ff0000-00ff00-0000ff', '/orvian/features', '/dashboards/infra-dashboard/logs', '/compare']) assert(validShareHref(href));
  for (const href of ['https://outside.test', '//outside.test', '/\\outside.test', '/api/shares', '/dashboards/../../api/shares', '/s/other', '/editor\r\nLocation: outside']) assert(!validShareHref(href));
});
test('snapshot validation rejects missing fields, unsupported versions, and unsafe data', () => {
  const value = { v: 1, href: '/editor', state: { v: 1, views: { '/editor': { panel: 'fonts' } } } };
  assert.deepEqual(parseSnapshot(value), value);
  for (const invalid of [null, {}, { v: 1, href: '/editor' }, { ...value, v: 2 }, { ...value, state: { v: 2, views: {} } }, { ...value, state: { v: 1, views: [] } }]) assert.equal(parseSnapshot(invalid), null);
});
