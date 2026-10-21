import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, parseState, matchesShape, type ViewState } from '../../browser/public/share-state.ts';

test('links round trip Unicode, views, arrays, and errors without executable data', () => {
  const state: ViewState = { v: 1, views: { '/': { category: 'Dashboards', query: '青 🎨', limit: 48, open: true } } };
  assert.deepEqual(parseState(encodeState(state)), state);
  for (const raw of ['bad', '{"v":2,"views":{}}', '{"v":1,"views":{"__proto__":{}}}', '{"v":1,"views":[]}']) assert.deepEqual(parseState(raw), { v: 1, views: {} });
});
test('state fields reject values that do not match their expected shape', () => {
  assert(matchesShape([{ name: 'Shared', active: true }], [{ name: '', active: false }]));
  assert(!matchesShape([{ name: { html: 'bad' }, active: true }], [{ name: '', active: false }]));
  assert(!matchesShape([{}], []));
  assert(!matchesShape('open', null));
});
