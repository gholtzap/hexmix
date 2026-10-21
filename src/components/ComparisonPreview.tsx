"use client";

import { useEffect, useRef, useState } from 'react';
import { previewHref } from '@/lib/preview-catalog';
import type { Palette } from '@/lib/palette';
import type { FontName } from '@/lib/fonts';

type Props = { path: string; palette: Palette; heading: FontName; body: FontName; side: 'a' | 'b'; onFrame: (frame: HTMLIFrameElement | null) => void };
export default function ComparisonPreview({ path, palette, heading, body, side, onFrame }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Keep the document mounted while its palette changes.
  const [source] = useState(() => `${previewHref(path, palette, heading, body)}&embed=toolbar`);
  useEffect(() => {
    const update = () => frame.current?.contentWindow?.postMessage({ type: 'hexmix-comparison-colors', palette, heading, body }, window.location.origin);
    const ready = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'hexmix-comparison-ready') update();
    };
    const element = frame.current;
    element?.addEventListener('load', update);
    window.addEventListener('message', ready);
    update();
    return () => { element?.removeEventListener('load', update); window.removeEventListener('message', ready); };
  }, [palette, heading, body]);
  return <iframe ref={node => { frame.current = node; onFrame(node); }} title={`Palette ${side.toUpperCase()} preview`} src={source} />;
}
