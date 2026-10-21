export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ViewState = { v: 1; views: Record<string, Record<string, Json>> };
export const maxStateBytes = 4_000_000;
export const emptyState = (): ViewState => ({ v: 1, views: {} });
export const oneOf = (...values: readonly unknown[]) => (value: unknown) => values.includes(value);
export const nullable = (validate: (value: unknown) => boolean) => (value: unknown) => value === null || validate(value);
export const stringRecord = (value: unknown): value is Record<string, string> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(item => typeof item === 'string');
export function redactFields(value: unknown, fields: readonly string[]): Json {
  if (Array.isArray(value)) return value.map(item => redactFields(item, fields));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fields.includes(key) ? '' : redactFields(item, fields)]));
  return isJson(value) ? value : null;
}

export function isJson(value: unknown, depth = 0): value is Json {
  if (depth > 16) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 10_000 && value.every(item => isJson(item, depth + 1));
  return typeof value === 'object' && Object.getPrototypeOf(value) !== null && Object.getPrototypeOf(Object.getPrototypeOf(value)) === null && Object.entries(value).every(([key, item]) =>
    !['__proto__', 'prototype', 'constructor'].includes(key) && key.length <= 1000 && isJson(item, depth + 1));
}

export function parseState(raw: string | null): ViewState {
  if (!raw || raw.length > maxStateBytes * 2) return emptyState();
  try {
    const json = raw.startsWith('{') ? raw : new TextDecoder().decode(Uint8Array.from(atob(raw.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)));
    if (new TextEncoder().encode(json).length > maxStateBytes) return emptyState();
    const value: unknown = JSON.parse(json);
    if (!isJson(value) || !value || Array.isArray(value) || typeof value !== 'object' || value.v !== 1 || !value.views || Array.isArray(value.views) || typeof value.views !== 'object') return emptyState();
    if (Object.values(value.views).some(item => !item || Array.isArray(item) || typeof item !== 'object')) return emptyState();
    return value as ViewState;
  } catch { return emptyState(); }
}

export function encodeState(state: ViewState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  if (bytes.length > maxStateBytes) throw new Error('This view is too large to share.');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function stateParameter(url: URL): string | null {
  return url.hash.startsWith('#state=') ? url.hash.slice(7) : url.searchParams.get('state');
}

export function matchesShape(value: unknown, sample: unknown): boolean {
  if (sample === null) return value === null;
  if (Array.isArray(sample)) return Array.isArray(value) && value.every(item => sample.length ? sample.some(shape => matchesShape(item, shape)) : typeof item === 'string');
  if (sample && typeof sample === 'object') return !!value && !Array.isArray(value) && typeof value === 'object' &&
    Object.entries(sample).every(([key, shape]) => shape === undefined || matchesShape((value as Record<string, unknown>)[key], shape));
  return typeof value === typeof sample && (typeof value !== 'number' || Number.isFinite(value));
}

let baseline = emptyState();
let baselineId = '';

export function stateWindow(): Window {
  let host: Window = window;
  try { while (host.parent !== host && host.parent.location.origin === window.location.origin) host = host.parent; } catch { /* Separate origins use the preview message channel. */ }
  return host;
}
export function stateScope() {
  let child: Window = window;
  const parts: string[] = [];
  try { while (child !== stateWindow()) { parts.unshift(child.frameElement?.getAttribute('title') ?? 'Preview'); child = child.parent; } } catch { /* Use the local page scope. */ }
  return [stateWindow().location.pathname, ...parts].join('|');
}
export function installSnapshot(id: string, state: ViewState) { if (id !== baselineId) window.hexmixPrivateViews = {}; baselineId = id; baseline = state; }
export function readViewState(): ViewState {
  const host = stateWindow();
  // Each iframe has its own module instance. The host supplies the snapshot base.
  const base = host.hexmixSharedBase ?? baseline;
  const patch = parseState(stateParameter(new URL(host.location.href)));
  const views = { ...base.views };
  for (const [scope, fields] of Object.entries(patch.views)) views[scope] = { ...views[scope], ...fields };
  return { v: 1, views };
}
export function publishSnapshotBase() { window.hexmixSharedBase = baseline; }
export function readField(scope: string, key: string): Json | undefined {
  const fields = stateWindow().hexmixPrivateViews?.[scope];
  return fields && Object.hasOwn(fields, key) ? fields[key] : readViewState().views[scope]?.[key];
}
export function privateField(scope: string, key: string) { return Object.hasOwn(stateWindow().hexmixPrivateViews?.[scope] ?? {}, key); }
export function registerRedactor(scope: string, key: string, redact: (value: unknown) => unknown) {
  const rules = stateWindow().hexmixShareRedactors ??= new Map();
  const id = JSON.stringify([scope, key]);
  // Private drafts outlive their controls, so keep their redaction rules for this session.
  rules.set(id, { scope, key, redact });
}
export function writeField(scope: string, key: string, value: Json, privateValue = false) {
  if (!isJson(value)) return;
  if (JSON.stringify(readField(scope, key)) === JSON.stringify(value)) return;
  const host = stateWindow();
  if (privateValue) { const views = host.hexmixPrivateViews ??= {}; (views[scope] ??= {})[key] = value; host.dispatchEvent(new Event('hexmix:state')); return; }
  const url = new URL(host.location.href);
  const patch = parseState(stateParameter(url));
  (patch.views[scope] ??= {})[key] = value;
  const encoded = encodeState(patch);
  if (encoded.length <= 1500 && !url.hash.startsWith('#state=')) url.searchParams.set('state', encoded);
  else { url.searchParams.delete('state'); url.hash = `state=${encoded}`; }
  host.history.replaceState(host.history.state, '', url);
  host.dispatchEvent(new Event('hexmix:state'));
}
export function sharedState(): ViewState {
  const state = readViewState();
  const path = stateWindow().location.pathname;
  const current = (scope: string) => scope === path || scope.startsWith(path + '|') || scope.startsWith(path + ':');
  state.views = Object.fromEntries(Object.entries(state.views).filter(([scope]) => current(scope)));
  for (const [scope, fields] of Object.entries(stateWindow().hexmixPrivateViews ?? {})) if (current(scope)) state.views[scope] = { ...state.views[scope], ...fields };
  for (const { scope, key, redact } of stateWindow().hexmixShareRedactors?.values() ?? []) {
    if (state.views[scope]?.[key] !== undefined) {
      const value = redact(state.views[scope][key]);
      if (isJson(value)) state.views[scope] = { ...state.views[scope], [key]: value };
    }
  }
  return state;
}
export function snapshotId() { return baselineId; }

type PreviewView = { read: () => unknown; restore: (value: unknown) => void; validate: (value: unknown) => boolean; private?: boolean; active?: () => boolean };
const previewViews = new Map<string, PreviewView>();
let captureInstalled = false;
export function registerSharedView(name: string, view: PreviewView) {
  const value = readField(stateScope(), name);
  if (value !== undefined && view.validate(value)) view.restore(value);
  previewViews.set(name, view);
  if (captureInstalled) return;
  captureInstalled = true;
  const capture = () => {
    for (const [key, item] of previewViews) {
      if (item.active && !item.active()) continue;
      const state: unknown = JSON.parse(JSON.stringify(item.read()));
      if (item.private && state && typeof state === 'object' && !Object.keys(state).length && readField(stateScope(), key) === undefined) continue;
      if (isJson(state) && JSON.stringify(state) !== JSON.stringify(readField(stateScope(), key))) writeField(stateScope(), key, state, item.private);
    }
  };
  document.addEventListener('input', () => queueMicrotask(capture));
  document.addEventListener('change', () => queueMicrotask(capture));
  document.addEventListener('click', () => queueMicrotask(capture));
  window.addEventListener('hexmix:capture', capture);
  stateWindow().addEventListener('popstate', () => {
    for (const [key, item] of previewViews) { const state = readField(stateScope(), key); if (state !== undefined && item.validate(state)) item.restore(state); }
  });
}

declare global { interface Window { hexmixSharedBase?: ViewState; hexmixPrivateViews?: ViewState['views']; hexmixSharedPalettes?: Json[]; hexmixShareRedactors?: Map<string, { scope: string; key: string; redact: (value: unknown) => unknown }> } }
