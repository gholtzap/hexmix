"use client";

import { useEffect, useRef, useState } from 'react';
import { useLinkState } from "@/hooks/useLinkState";
import { createSharedLink } from "@/lib/shared-link";
import { oneOf } from "@/lib/link-state";
import Link from 'next/link';
import { comparisonHref, readComparison, type Comparison } from '@/lib/comparison';
import { copyText, readThemePaste } from '@/lib/clipboard';
import {paletteHistoryShortcut} from '@/lib/input-events';
import { previewCatalog, previewHref } from '@/lib/preview-catalog';
import { isDarkPalette, isPalette, samePalette, paletteForMode, type Palette } from '@/lib/palette';
import { useSavedPalettes } from '@/hooks/useSavedPalettes';
import { useComparisonScroll } from "@/hooks/useComparisonScroll";
import { useVisibleViewport } from "@/hooks/useVisibleViewport";
import {isElementRole,maxElementRoles,maxElementRolesLength} from '@/lib/element-roles';
import { fonts } from '@/lib/fonts';
import ComparisonPreview from './ComparisonPreview';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover';

export default function ComparisonPage() {
  useVisibleViewport();
  const [value, setValue] = useState<Comparison>(() => readComparison(''));
  const [origin, setOrigin] = useState('');
  const ready = Boolean(origin);
  const initialized = useRef(false);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useLinkState<'a' | 'b'>("ComparisonPage.ComparisonPage.active", 'a', { validate: oneOf("a", "b") });
  const [optionsSide, setOptionsSide] = useLinkState<'a' | 'b' | null>("ComparisonPage.ComparisonPage.optionsSide", null, { validate: oneOf(null, "a", "b") });
  const [notice, setNotice] = useState('');
  const [sharedLink, setSharedLink] = useState('');
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const text = readThemePaste(event);
      if (text === null) return;
      event.preventDefault();
      document.querySelector<HTMLIFrameElement>(`iframe[title="Palette ${active.toUpperCase()} preview"]`)?.contentWindow?.postMessage({ type: 'hexmix-paste-theme', text }, window.location.origin);
    };
    document.addEventListener('paste', paste);
    const keydown = (event: KeyboardEvent) => {
      const action = paletteHistoryShortcut(event);
      if (!action) return;
      const target = document.querySelector<HTMLIFrameElement>(`iframe[title="Palette ${active.toUpperCase()} preview"]`);
      if (target?.contentWindow) { event.preventDefault(); target.contentWindow.postMessage({type:'hexmix-palette-history',action},window.location.origin); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('paste', paste); document.removeEventListener('keydown', keydown); };
  }, [active]);
  const [panels, setPanels] = useLinkState("ComparisonPage.ComparisonPage.panels", { a: false, b: false });
  const input = useRef<HTMLInputElement>(null);
  const { saved, storageReady } = useSavedPalettes(setNotice);
  useEffect(() => {
    if (!storageReady || initialized.current) return;
    initialized.current = true;
    const next = readComparison(window.location.search);
    const query = new URLSearchParams(window.location.search);
    if (!query.has('a') && !query.has('b') && !query.has('colors') && saved.length) {
      next.a = saved[0].colors; next.nameA = saved[0].name;
      if (saved[1]) { next.b = saved[1].colors; next.nameB = saved[1].name; }
      next.mode = isDarkPalette(next.a) ? 'dark' : 'light';
    }
    setValue(next); setOrigin(window.location.origin);
  }, [storageReady, saved]);
  useEffect(() => {
    const restore = () => setValue(readComparison(window.location.search));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const update = () => setMobile(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const href = new URL(comparisonHref(value), window.location.origin);
    const current = new URL(window.location.href);
    if (current.hash.startsWith('#state=')) href.hash = current.hash;
    for (const key of ['state', 'snapshot']) if (current.searchParams.has(key)) href.searchParams.set(key, current.searchParams.get(key)!);
    window.history.replaceState(window.history.state, '', href);
  }, [value, ready]);
  useEffect(() => {
    const toggle = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const side = (['a', 'b'] as const).find(side => document.querySelector<HTMLIFrameElement>(`iframe[title="Palette ${side.toUpperCase()} preview"]`)?.contentWindow === event.source);
      if (!side) return;
      const data = event.data;
      if (data?.type === 'hexmix-comparison-toggle-theme') setValue(({ customA, customB, ...current }) => ({ ...current, mode: current.mode === 'light' ? 'dark' : 'light' }));
      if (data?.type === 'hexmix-comparison-panel' && typeof data.open === 'boolean') setPanels(current => ({ ...current, [side]: data.open }));
      if (data?.type === 'hexmix-comparison-options') setOptionsSide(side);
      if (data?.type === 'hexmix-comparison-name' && typeof data.name === 'string' && data.name.trim() && data.name.length <= 80) setValue(current => ({ ...current, [side === 'a' ? 'nameA' : 'nameB']: data.name.trim() }));
      if (data?.type === 'hexmix-comparison-preview') {
        if (data.preview === 'gallery') window.location.assign(previewHref('/', value[side === 'a' ? 'customA' : 'customB'] ? value[side] : paletteForMode(value[side], value.mode), value.heading, value.body, value.elements));
        else if (previewCatalog.some(item => item.id === data.preview)) setValue(current => ({ ...current, preview: data.preview }));
      }
      if (data?.type === 'hexmix-comparison-change' && isPalette(data.palette) && typeof data.heading === 'string' && Object.hasOwn(fonts, data.heading) && typeof data.body === 'string' && Object.hasOwn(fonts, data.body)) {
        setValue(current => {
          const display = current[side === 'a' ? 'customA' : 'customB'] ? current[side] : paletteForMode(current[side], current.mode);
          return { ...current, ...(!samePalette(display, data.palette) ? { [side]: data.palette, [side === 'a' ? 'customA' : 'customB']: true } : {}), heading: data.heading, body: data.body, ...(Array.isArray(data.elements) && data.elements.length <= maxElementRoles && data.elements.every(isElementRole) && JSON.stringify(data.elements).length <= maxElementRolesLength ? { elements: data.elements } : {}) };
        });
      }
    };
    window.addEventListener('message', toggle);
    return () => window.removeEventListener('message', toggle);
  }, [value]);
  const link = ready ? new URL(comparisonHref(value), origin).href : '';
  useEffect(() => { setSharedLink(''); }, [value, active, optionsSide, panels]);
  const preview = previewCatalog.find(item => item.id === value.preview)!;
  const rendered = { a: value.customA ? value.a : paletteForMode(value.a, value.mode), b: value.customB ? value.b : paletteForMode(value.b, value.mode) };
  const href = (palette: Palette) => previewHref(preview.path, palette, value.heading, value.body, value.elements);
  const frames = useComparisonScroll(value.preview, ready ? preview.path : '', ready ? preview.path : '', !value.unlinked);
  async function share() {
    try {
      const shared = await createSharedLink(new URL(link));
      setSharedLink(shared);
      if (await copyText(shared, input.current?.parentElement ?? document.body)) setNotice('Comparison link copied.');
      else { setNotice('Select and copy the comparison link.'); requestAnimationFrame(() => { input.current?.focus(); input.current?.select(); }); }
    } catch { setNotice('The share link could not be saved. Try again.'); }
  }
  return <main className="comparison-page" data-app-ready={ready || undefined}>
    <div className="comparison-grid">
      {(['a', 'b'] as const).map(side => <section className="comparison-option" key={side} data-active={active === side} data-panel-open={panels[side]} aria-hidden={mobile && active !== side || undefined} inert={mobile && active !== side} aria-labelledby={`palette-${side}`}>
        <header className="comparison-toolbar" aria-label={`Palette ${side.toUpperCase()} toolbar`}>
          <h2 id={`palette-${side}`} hidden>Palette {side.toUpperCase()}</h2>
          <div className="comparison-mobile-tabs" role="group" aria-label="Visible palette">{(['a', 'b'] as const).map(target => <Button key={target} variant="ghost" aria-label={`Show palette ${target.toUpperCase()}`} aria-pressed={active === target} onClick={() => { setActive(target); setOptionsSide(null); }}>Palette {target.toUpperCase()}</Button>)}</div>
          <Popover open={optionsSide === side} onOpenChange={open => setOptionsSide(open ? side : null)}>
            <PopoverAnchor asChild><span aria-hidden="true" /></PopoverAnchor>
            <PopoverContent aria-label={`Comparison options for palette ${side.toUpperCase()}`} className="comparison-menu" side="bottom" align="end" sideOffset={12}>
              <p className="comparison-name">{side === 'a' ? value.nameA : value.nameB}</p>
              <div className="comparison-select"><label htmlFor={`comparison-preview-${side}`}>Preview</label><select id={`comparison-preview-${side}`} value={value.preview} onChange={event => setValue({ ...value, preview: event.target.value })}>
                {['Homepages', 'Dashboards'].map(category => <optgroup key={category} label={category}>{previewCatalog.filter(item => item.category === category).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
              </select></div>
              <label className="comparison-link-toggle"><input type="checkbox" checked={!value.unlinked} onChange={() => setValue(({ unlinked, ...current }) => unlinked ? current : { ...current, unlinked: true })} />Link interactions</label>
              <div className="comparison-controls" role="group" aria-label="Preview appearance">{(['light', 'dark'] as const).map(mode => <Button key={mode} variant="outline" aria-pressed={value.mode === mode} onClick={() => setValue(({ customA, customB, ...current }) => ({ ...current, mode }))}>{mode === 'light' ? 'Light' : 'Dark'}</Button>)}</div>
              <Link href={href(rendered[side])}>Use palette {side.toUpperCase()}</Link>
              <div className="comparison-share"><label htmlFor={`comparison-link-${side}`}>Comparison link</label><Input ref={input} id={`comparison-link-${side}`} value={sharedLink || link} readOnly onFocus={event => event.target.select()} /><Button variant="outline" disabled={!ready} onClick={share}>Copy comparison link</Button></div>
              {notice && <p role="status">{notice}</p>}
              <Link href={previewHref('/', rendered[side], value.heading, value.body, value.elements)}>All previews</Link>
            </PopoverContent>
          </Popover>
        </header>
        {ready && <ComparisonPreview key={`${preview.id}-${side}`} path={preview.path} palette={rendered[side]} heading={value.heading} body={value.body} side={side} elements={value.elements} onFrame={node => { frames.current[side] = node; }} />}
      </section>)}
    </div>
  </main>;
}
