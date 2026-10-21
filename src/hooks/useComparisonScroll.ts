"use client";

import { useEffect, useRef } from 'react';
import { comparisonHistory } from '@/lib/comparison-history';
import { comparisonInteractions } from '@/lib/comparison-interactions';

type Side = 'a' | 'b';
type Position = { top: number; left: number };
const sides: Side[] = ['a', 'b'];

function keyFor(element: Element, document: Document): string | null {
  if (element === document.scrollingElement) return 'root';
  const path: number[] = [];
  while (element !== document.documentElement) {
    const parent = element.parentElement;
    if (!parent) return null;
    path.unshift(Array.from(parent.children).indexOf(element));
    element = parent;
  }
  return path.join('.');
}
function elementFor(document: Document, key: string): Element | null {
  if (key === 'root') return document.scrollingElement;
  let element: Element = document.documentElement;
  for (const index of key.split('.').map(Number)) {
    element = element?.children[index];
    if (!element) return null;
  }
  return element;
}

export function useComparisonScroll(preview: string, sourceA: string, sourceB: string, linked = true) {
  const enabled = useRef(linked); enabled.current = linked;
  const interactions = useRef<ReturnType<typeof comparisonInteractions> | null>(null);
  interactions.current ??= comparisonInteractions();
  const frames = useRef<Record<Side, HTMLIFrameElement | null>>({ a: null, b: null });
  const navigation = useRef<ReturnType<typeof comparisonHistory> | null>(null);
  const documents = useRef<Partial<Record<Side, Document>>>({});
  const positions = useRef(new Map<string, Position>());
  const pending = useRef(new WeakMap<Element, Position>());
  useEffect(() => { positions.current.clear(); }, [preview]);
  useEffect(() => {
    if (!sourceA || !sourceB) return;
    const current = comparisonHistory(preview, { a: sourceA, b: sourceB }, frames.current, () => enabled.current);
    navigation.current = current;
    return () => { current.dispose(); if (navigation.current === current) navigation.current = null; };
  }, [preview, sourceA, sourceB]);
  useEffect(() => watch('a'), [sourceA]);
  useEffect(() => watch('b'), [sourceB]);

  function write(document: Document, key: string, position: Position) {
    const element = elementFor(document, key);
    if (!element) return;
    const point = { top: position.top * (element.scrollHeight - element.clientHeight), left: position.left * (element.scrollWidth - element.clientWidth) };
    pending.current.set(element, point);
    element.scrollTo({ ...point, behavior: 'instant' });
  }
  function watch(side: Side) {
    const outer = frames.current[side];
    if (!outer) return;
    let child: HTMLIFrameElement | null = null;
    let unbindHistory = () => {};
    let disconnect = () => {};
    let observer: MutationObserver | null = null;
    const connect = () => {
      disconnect();
      const document = child?.contentDocument;
      if (!document || document.URL === 'about:blank') return;
      const style = document.createElement('style');
      style.dataset.comparisonScrollbars = 'hidden';
      style.textContent = '* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }';
      document.head.append(style);
      documents.current[side] = document;
      const unlink = interactions.current!(document, () => documents.current[side === 'a' ? 'b' : 'a'], () => enabled.current);
      let live = true;
      const restore = () => { if (live && enabled.current) positions.current.forEach((position, key) => write(document, key, position)); };
      const scroll = (event: Event) => {
        if (!enabled.current) return;
        const target = event.target === document ? document.scrollingElement : event.target as Element;
        if (!target || target.nodeType !== 1) return;
        const expected = pending.current.get(target);
        pending.current.delete(target);
        if (expected && Math.abs(target.scrollTop - expected.top) <= 1 && Math.abs(target.scrollLeft - expected.left) <= 1) return;
        const key = keyFor(target, document);
        if (key === null) return;
        const position = {
          top: Math.max(0, Math.min(1, target.scrollTop / Math.max(1, target.scrollHeight - target.clientHeight))),
          left: Math.max(0, Math.min(1, target.scrollLeft / Math.max(1, target.scrollWidth - target.clientWidth))),
        };
        positions.current.set(key, position);
        sides.filter(other => other !== side).forEach(other => { if (documents.current[other]) write(documents.current[other], key, position); });
      };
      document.addEventListener('scroll', scroll, true);
      const observer = new ResizeObserver(restore);
      observer.observe(document.documentElement);
      if (document.body) observer.observe(document.body);
      restore();
      void document.fonts.ready.then(restore);
      disconnect = () => {
        live = false;
        unlink();
        document.removeEventListener('scroll', scroll, true);
        style.remove();
        observer.disconnect();
        if (documents.current[side] === document) delete documents.current[side];
      };
    };
    const find = () => {
      const next = outer.contentDocument?.querySelector('iframe');
      if (next === child) return;
      child?.removeEventListener('load', connect);
      disconnect();
      child = next ?? null;
      child?.addEventListener('load', connect);
      connect();
    };
    const load = () => {
      unbindHistory();
      observer?.disconnect();
      child?.removeEventListener('load', connect);
      disconnect(); child = null;
      const document = outer.contentDocument;
      if (!document?.defaultView || document.URL === 'about:blank') return;
      unbindHistory = navigation.current?.bind(side, document.defaultView) ?? (() => {});
      observer = new MutationObserver(find);
      observer.observe(document, { childList: true, subtree: true });
      find();
    };
    outer.addEventListener('load', load);
    load();
    return () => {
      outer.removeEventListener('load', load);
      unbindHistory();
      observer?.disconnect();
      child?.removeEventListener('load', connect);
      disconnect();
    };
  }
  return frames;
}
