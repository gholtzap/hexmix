import { sharedState, stateWindow, encodeState, type ViewState } from '../../browser/public/share-state.ts';

export type SharedSnapshot = { v: 1; href: string; state: ViewState };

export function validShareHref(href: unknown): href is string {
  if (typeof href !== 'string' || href.length > 16_000 || !href.startsWith('/') || href.startsWith('//') || /[\\\r\n]/.test(href)) return false;
  const url = new URL(href, 'https://hexmix.invalid');
  return url.origin === 'https://hexmix.invalid' && /^\/(?:$|editor$|compare$|dashboards(?:\/|$)|(?:avenlo|tervix|orvian|nuvexa)(?:\/|$))/.test(url.pathname);
}

export function captureSharedViews(): void {
  const capture = (host: Window) => {
    host.dispatchEvent(new Event('hexmix:capture'));
    for (let i = 0; i < host.frames.length; i++) { try { if (host.frames[i].location.origin === window.location.origin) capture(host.frames[i]); } catch { /* An external frame cannot expose its data. */ } }
  };
  capture(stateWindow());
}

export async function createSharedLink(url: URL, extra?: (state: ViewState) => void): Promise<string> {
  const host = stateWindow(); delete host.hexmixSharedPalettes;
  captureSharedViews();
  const state = sharedState(); extra?.(state);
  if (host.hexmixSharedPalettes) state.views.shared = { palettes: host.hexmixSharedPalettes };
  const fromSnapshot = url.searchParams.has('snapshot');
  url.searchParams.delete('state'); url.searchParams.delete('snapshot');
  if (url.hash.startsWith('#state=')) url.hash = '';
  const encoded = encodeState(state);
  const direct = new URL(url); direct.searchParams.set('state', encoded);
  const hasPrivateData = fromSnapshot || Object.entries(host.hexmixPrivateViews ?? {}).some(([scope, fields]) => !!state.views[scope] && Object.values(fields).some(value => value !== null && value !== '' && (typeof value !== 'object' || Object.keys(value).length > 0))) || !!state.views.shared;
  if (direct.href.length <= 2000 && !hasPrivateData) return direct.href;
  const response = await fetch('/api/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, href: url.pathname + url.search + url.hash, state } satisfies SharedSnapshot) });
  if (response.status === 413) throw new Error('This view is too large to share.');
  if (!response.ok) throw new Error('The share link could not be saved. Try again.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !/^[a-f0-9]{32}$/.test(result.id)) throw new Error('The share link could not be saved.');
  return new URL(`/s/${result.id}`, url.origin).href;
}
