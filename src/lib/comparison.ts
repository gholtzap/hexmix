import { fonts, type FontName } from './fonts.ts';
import { defaultDarkPalette, initialPalette, paletteQuery, readPalette, samePalette, isDarkPalette, type Palette, type PaletteMode } from './palette.ts';
import { previewCatalog } from './preview-catalog.ts';

export type Comparison = { a: Palette; b: Palette; preview: string; heading: FontName; body: FontName; nameA: string; nameB: string; mode: PaletteMode; customA?: true; customB?: true; unlinked?: true };

export function readComparison(search: string): Comparison {
  const query = new URLSearchParams(search);
  const a = readPalette(search, 'a') ?? readPalette(search) ?? defaultDarkPalette;
  const font = (key: string): FontName => {
    const name = query.get(key);
    return name && Object.hasOwn(fonts, name) ? name as FontName : 'System';
  };
  const name = (key: string, fallback: string) => {
    const value = query.get(key)?.trim();
    return value && value.length <= 80 ? value : fallback;
  };
  return {
    a,
    ...(query.get('linked') === '0' ? { unlinked: true as const } : {}),
    ...(query.get('customA') === '1' ? { customA: true as const } : {}),
    ...(query.get('customB') === '1' ? { customB: true as const } : {}),
    b: readPalette(search, 'b') ?? (samePalette(a, initialPalette) ? defaultDarkPalette : initialPalette),
    preview: previewCatalog.find(item => item.id === query.get('preview'))?.id ?? 'avenlo',
    heading: font('heading'),
    body: font('body'),
    nameA: name('nameA', 'Palette A'),
    nameB: name('nameB', 'Palette B'),
    mode: query.get('mode') === 'light' || query.get('mode') === 'dark' ? query.get('mode') as PaletteMode : isDarkPalette(a) ? 'dark' : 'light',
  };
}

export function comparisonHref(value: Comparison): string {
  const query = new URLSearchParams(`${paletteQuery(value.a, 'a')}&${paletteQuery(value.b, 'b')}`);
  query.set('preview', value.preview);
  query.set('heading', value.heading);
  query.set('body', value.body);
  query.set('nameA', value.nameA);
  query.set('nameB', value.nameB);
  query.set('mode', value.mode);
  if (value.unlinked) query.set('linked', '0');
  for (const key of ['customA', 'customB'] as const) if (value[key]) query.set(key, '1');
  return `/compare?${query}`;
}
