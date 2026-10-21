import { registerSharedView, matchesShape, readField, stateScope, stateWindow, writeField, type Json } from '../../share-state.ts';

export function linkPreviewData<T>(name: string, read: () => T, restore: (value: T) => void, options: { private?: boolean; validate?: (value: unknown) => boolean } = {}) {
  const sample = JSON.parse(JSON.stringify(read())) as Json;
  registerSharedView(`workspace.${name}`, {
    read, restore: value => restore(value as T),
    validate: options.validate ?? (value => matchesShape(value, sample)),
    private: options.private ?? true,
    active: () => {
      const view = stateWindow().location.pathname.split('/')[3] ?? 'chat';
      if (name === 'chat') return ['chat', 'work'].includes(view);
      if (name === 'tasks' || name === 'taskFilter') return view === 'scheduled';
      if (name.startsWith('space') || name === 'siteView') return ['space', 'sites'].includes(view);
      if (name === 'plugins' || name.startsWith('pluginView.')) return ['plugins', 'skills'].includes(view);
      return true;
    },
  });
}

const dialogs = new Map<string, { open: (value: Json) => void; valid: (value: unknown) => boolean }>();
let restoredDialog = false;
let historyBound = false;
export function registerSharedDialog(name: string, open: (value: Json) => void, valid: (value: unknown) => boolean) {
  dialogs.set(name, { open, valid });
  if (!historyBound) { historyBound = true; stateWindow().addEventListener('popstate', () => { restoredDialog = false; requestAnimationFrame(restoreSharedDialog); }); }
}
export function rememberSharedDialog(name: string, value: Json = null) {
  queueMicrotask(() => writeField(stateScope(), 'workspace.dialog', { name, value }));
}
export function clearSharedDialog() { writeField(stateScope(), 'workspace.dialog', null); }
export function restoreSharedDialog() {
  if (restoredDialog) return;
  const value = readField(stateScope(), 'workspace.dialog');
  if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.name !== 'string') return;
  const dialog = dialogs.get(value.name);
  if (!dialog || !dialog.valid(value.value)) return;
  restoredDialog = true; dialog.open(value.value);
}
