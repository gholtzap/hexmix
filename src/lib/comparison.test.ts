import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonHref, readComparison } from './comparison.ts';
import { defaultDarkPalette, initialPalette, paletteQuery, paletteForMode } from './palette.ts';

test('comparison links keep both palettes, preview, and fonts', () => {
  const value = { a: initialPalette, b: defaultDarkPalette, preview: 'infrastructure', heading: 'Arial' as const, body: 'Verdana' as const, nameA: 'Warm launch', nameB: 'Night / review', mode: 'dark' as const };
  const link = comparisonHref(value);
  assert.ok(link.startsWith('/compare?'));
  assert.deepEqual(readComparison(new URL(link, 'https://example.com').search), value);
});

test('comparison links reject invalid palettes, unknown previews, and font names', () => {
  const value = readComparison('?a=bad&b=000000-ffffff-ffffff-ffffff-ffffff-extra&preview=https://example.com&heading=unknown&body=unknown');
  assert.deepEqual(value.a, defaultDarkPalette);
  assert.deepEqual(value.b, initialPalette);
  assert.equal(value.preview, 'avenlo');
  assert.equal(value.heading, 'System');
  assert.equal(value.body, 'System');
});

test('normal palette links can start a comparison without browser storage', () => {
  const value = readComparison(`?${paletteQuery(initialPalette)}&preview=workspace`);
  assert.deepEqual(value.a, initialPalette);
  assert.deepEqual(value.b, defaultDarkPalette);
  assert.equal(value.preview, 'workspace');
});

test('comparison names and mode have safe defaults for older and invalid links', () => {
  const old = readComparison(`?${paletteQuery(initialPalette, 'a')}`);
  assert.equal(old.mode, 'light');
  assert.equal(old.nameA, 'Palette A');
  assert.equal(old.nameB, 'Palette B');
  const bad = readComparison('?mode=unknown&nameA=%20%20&nameB=' + 'x'.repeat(81));
  assert.equal(bad.mode, 'dark');
  assert.equal(bad.nameA, 'Palette A');
  assert.equal(bad.nameB, 'Palette B');
});

test('comparison modes preserve accents and never change the source palette', () => {
  const source = Object.freeze({ ...initialPalette });
  const light = paletteForMode(source, 'light');
  const dark = paletteForMode(source, 'dark');
  assert.deepEqual(light, { ...source, text: '#171717', background: '#ffffff' });
  assert.deepEqual(dark, { ...source, text: '#ededed', background: '#171717' });
  for (const role of ['primary', 'secondary', 'accent'] as const) {
    assert.equal(light[role], source[role]);
    assert.equal(dark[role], source[role]);
  }
  assert.deepEqual(paletteForMode(source, 'light'), light);
  assert.deepEqual(paletteForMode(source, 'dark'), dark);
  assert.deepEqual(source, initialPalette);
});

test('comparison links preserve manual color edits in the selected mode', () => {
  const value = { ...readComparison(''), customA: true as const };
  assert.deepEqual(readComparison(new URL(comparisonHref(value), 'https://example.com').search), value);
});
