"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { installSnapshot, publishSnapshotBase, snapshotId, emptyState } from '../../browser/public/share-state';
import { startViewCapture } from "../../browser/public/preview-view";
import { parseSnapshot } from '@/lib/shared-snapshot';

export default function SharedStateProvider({ children }: { children: ReactNode }) {
  const requestedId = useSearchParams()?.get('snapshot') ?? '';
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const restore = async () => {
      const id = new URL(window.location.href).searchParams.get('snapshot');
      if ((id ?? '') === snapshotId()) { publishSnapshotBase(); setReady(true); return; }
      setError(''); setReady(false);
      if (!id) { installSnapshot('', emptyState()); publishSnapshotBase(); setReady(true); return; }
      try {
        const response = await fetch(`/api/shares/${encodeURIComponent(id)}`);
        const value = response.ok ? parseSnapshot(await response.json()) : null;
        if (!value) throw new Error('This shared view could not be loaded.');
        if (active) { installSnapshot(id, value.state); publishSnapshotBase(); setReady(true); window.dispatchEvent(new Event('hexmix:restore')); }
      } catch { if (active) setError('This shared view could not be loaded.'); }
    };
    void restore(); window.addEventListener('popstate', restore);
    return () => { active = false; window.removeEventListener('popstate', restore); };
  }, [requestedId]);
  useEffect(() => { if (ready) return startViewCapture(); }, [ready]);
  if (error) return <main className="share-error" data-app-ready><h1>Shared view unavailable</h1><p role="alert">{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button><a href="/">All previews</a></main>;
  return ready ? children : null;
}
