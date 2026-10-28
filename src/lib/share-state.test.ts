import test from 'node:test';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { gzipSync } from 'fflate';
import { encodeState, parseState, matchesShape, redactFields, isJson, maxStateBytes, stateParameter, writeField, readField, readViewState, sharedState, type ViewState } from '../../browser/public/share-state.ts';

const legacyEncode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const compressedEncode = (value: Uint8Array) => 'gz1.' + Buffer.from(value).toString('base64url');

test('editing a returned field cannot change cached state or prevent its next write', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    const state: ViewState = { v: 1, views: { '/': { items: [{ name: 'original' }] } } };
    const host = Object.assign(new EventTarget(), { location: new URL(`https://hexmix.test/?state=${encodeState(state)}`), parent: undefined as unknown, history: { state: null, replaceState(_state: unknown, _title: string, next: URL) { host.location = next; } } });
    host.parent = host;
    Object.defineProperty(globalThis, 'window', { value: host, configurable: true });
    const items = readField('/', 'items') as { name: string }[];
    items[0].name = 'edited';
    assert.deepEqual(readField('/', 'items'), [{ name: 'original' }]);
    writeField('/', 'items', items);
    assert.deepEqual(parseState(stateParameter(host.location)).views['/'].items, items);
    const copy = readViewState();
    (copy.views['/'].items as { name: string }[])[0].name = 'outside';
    assert.deepEqual(readField('/', 'items'), [{ name: 'edited' }]);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('state readers decode once per URL and retain other scopes after a share', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const decode = globalThis.atob;
  let decodes = 0;
  try {
    const state: ViewState = { v: 1, views: { '/': { value: 'first' }, '/avenlo': { value: 'other page' } } };
    const host = { location: new URL(`https://hexmix.test/?state=${encodeState(state)}`), parent: undefined as unknown };
    host.parent = host;
    Object.defineProperty(globalThis, 'window', { value: host, configurable: true });
    globalThis.atob = value => { decodes++; return decode(value); };
    for (let i = 0; i < 100; i++) assert.equal(readField('/', 'value'), 'first');
    assert.equal(decodes, 1);
    assert.deepEqual(sharedState().views, { '/': { value: 'first' } });
    assert.equal(readField('/avenlo', 'value'), 'other page');
    host.location.searchParams.set('state', encodeState({ v: 1, views: { '/': { value: 'second' } } }));
    assert.equal(readField('/', 'value'), 'second');
    assert.equal(decodes, 2);
    host.location.search = '';
    assert.equal(readField('/', 'value'), undefined);
  } finally {
    globalThis.atob = decode;
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('compressed links keep every view and field and reduce repeated selector data', () => {
  const state: ViewState = { v: 1, views: Object.fromEntries(['/avenlo', '/nuvexa', '/nuvexa|Page preview'].map(scope => [scope, {
    history: [{ text: '#1d0b20', background: '#fff8f7' }],
    open: false, selected: null, query: '青 🎨',
    expanded: Array.from({ length: 30 }, (_, i) => `body > main:nth-child(2) > section:nth-child(${i + 1}) > div:nth-child(1) > button:nth-child(1)`),
  }])) };
  const encoded = encodeState(state);
  assert.match(encoded, /^gz1\./);
  assert(encoded.length < legacyEncode(state).length / 4);
  assert.deepEqual(parseState(encoded), state);
  assert.deepEqual(parseState(legacyEncode(state)), state);
  assert.deepEqual(parseState(JSON.stringify(state)), state);
  assert.equal(encodeState(state), encoded);
});

test('small links do not grow and compressed input keeps validation and size limits', () => {
  const state: ViewState = { v: 1, views: {} };
  assert.equal(encodeState(state), legacyEncode(state));
  const gzip = (text: string) => gzipSync(new TextEncoder().encode(text), { mtime: 0 });
  const forged = gzip(JSON.stringify({ v: 1, views: {} }) + ' '.repeat(100));
  new DataView(forged.buffer).setUint32(forged.length - 4, 2, true);
  for (const raw of ['gz1.', 'gz1.bad', compressedEncode(gzip('{"v":2,"views":{}}')), compressedEncode(gzip('x'.repeat(maxStateBytes + 1))), compressedEncode(forged)]) {
    assert.deepEqual(parseState(raw), state);
  }
  assert.throws(() => encodeState({ v: 1, views: { '/': { value: 'x'.repeat(maxStateBytes) } } }), /too large/);
});

test('editing a legacy URL compresses it without removing other page states', () => {
  const state: ViewState = { v: 1, views: { '/avenlo': { history: ['#ffffff', '#000000'] }, '/nuvexa|Page preview': { expanded: Array.from({ length: 20 }, (_, i) => `body > main > section:nth-child(${i}) > button`) } } };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    for (const hash of [false, true]) {
      const url = new URL('https://hexmix.test/nuvexa?colors=ffffff-000000-ff0000-00ff00-0000ff');
      if (hash) url.hash = `state=${legacyEncode(state)}`;
      else url.searchParams.set('state', legacyEncode(state));
      const host = Object.assign(new EventTarget(), { location: url, history: { state: null, replaceState(_state: unknown, _title: string, next: URL) { host.location = next; } } });
      Object.defineProperty(globalThis, 'window', { value: host, configurable: true });
      Object.assign(host, { parent: host });
      writeField('/nuvexa', 'open', true);
      assert.match(stateParameter(host.location)!, /^gz1\./);
      assert.deepEqual(parseState(stateParameter(host.location)), { v: 1, views: { ...state.views, '/nuvexa': { open: true } } });
      assert.equal(host.location.searchParams.get('colors'), url.searchParams.get('colors'));
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('links round trip Unicode, views, arrays, and errors without executable data', () => {
  const state: ViewState = { v: 1, views: { '/': { category: 'Dashboards', query: '青 🎨', limit: 48, open: true } } };
  assert.deepEqual(parseState(encodeState(state)), state);
  for (const raw of ['bad', '{"v":2,"views":{}}', '{"v":1,"views":{"__proto__":{}}}', '{"v":1,"views":[]}']) assert.deepEqual(parseState(raw), { v: 1, views: {} });
});
test('protected fields are removed from copied data without changing the source', () => {
  const source = [{ id: 'sample', name: 'API_TOKEN', value: 'private-test-value' }];
  assert.deepEqual(redactFields(source, ['value']), [{ id: 'sample', name: 'API_TOKEN', value: '' }]);
  assert.equal(source[0].value, 'private-test-value');
});
test('state fields reject values that do not match their expected shape', () => {
  assert(matchesShape([{ name: 'Shared', active: true }], [{ name: '', active: false }]));
  assert(!matchesShape([{ name: { html: 'bad' }, active: true }], [{ name: '', active: false }]));
  assert(!matchesShape([{}], []));
  assert(!matchesShape('open', null));
});

test('plain state objects from a same-origin frame pass validation', () => {
  assert(isJson(runInNewContext('({ value: [{ name: \"shared\" }] })')));
  assert(!isJson(new Date()));
});
