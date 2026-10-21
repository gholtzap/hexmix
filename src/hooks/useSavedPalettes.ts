"use client";

import { useEffect, useState } from "react";
import { restorePalettes, samePalette, isPalette, type Palette, type SavedPalette } from "@/lib/palette";
import { useLinkState } from './useLinkState';

const storageKey = "hue-palettes-v1";
const readSaved = () => restorePalettes(JSON.parse(localStorage.getItem(storageKey) || "[]"));

export function useSavedPalettes(setNotice: (message: string) => void) {
  const [shared, setShared] = useLinkState<SavedPalette[] | null>('palettes', null, {
    scope: 'shared', private: true,
    validate: value => value === null || Array.isArray(value) && value.length <= 10_000 && value.every(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.name.length <= 80 && isPalette(item.colors)),
  });
  const [saved, setSaved] = useState<SavedPalette[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [removed, setRemoved] = useState<{palette: SavedPalette; index: number; shared: boolean} | null>(null);
  useEffect(() => {
    const load = () => {
      try { setSaved(readSaved()); }
      catch { setNotice("Saved palettes could not be loaded."); }
    };
    const sync = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) load();
    };
    load();
    setStorageReady(true);
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [setNotice]);
  function change(update: (current: SavedPalette[]) => SavedPalette[] | null, message: string, onSuccess?: (before: SavedPalette[], after: SavedPalette[]) => void) {
    if (shared) {
      const next = update(shared);
      if (next) { setShared(next); setNotice('Shared palettes updated.'); onSuccess?.(shared, next); }
      return;
    }
    const write = () => {
      try {
        const current = readSaved();
        const next = update(current);
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        setSaved(next ?? current);
        if (next) setNotice(message);
        if (next) onSuccess?.(current, next);
      } catch { setNotice("Your browser could not save this palette."); }
    };
    if (navigator.locks) void navigator.locks.request(storageKey, write).catch(() => setNotice("Your browser could not save this palette."));
    // shortcut: older browsers without Web Locks cannot serialize simultaneous writes; use IndexedDB if they must support concurrent edits.
    else write();
  }
  function save(palette: Palette, name: string) {
    if (!name.trim() || name.trim().length > 80) return;
    change((current) => {
      if (current.some(item => samePalette(item.colors, palette))) {
        setNotice("This palette is already saved.");
        return null;
      }
      return [{ id: crypto.randomUUID(), name: name.trim(), colors: { ...palette } }, ...current];
    }, "Palette saved on this device.");
  }
  function rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) return;
    change(items => items.map(item => item.id === id ? { ...item, name: trimmed } : item), "Palette renamed.");
  }
  function remove(id: string) {
    change(items => items.some(item => item.id === id) ? items.filter(item => item.id !== id) : null, "Palette removed.", before => {
      const index = before.findIndex(item => item.id === id);
      setRemoved({palette: before[index], index, shared: Boolean(shared)});
      setNotice("Palette removed.");
    });
  }
  function restoreRemoved() {
    if (!removed || removed.shared !== Boolean(shared)) return;
    change(items => {
      if (items.some(item => item.id === removed.palette.id || samePalette(item.colors, removed.palette.colors))) {
        setRemoved(null); setNotice("This palette is already saved."); return null;
      }
      const next = [...items]; next.splice(Math.min(removed.index, next.length), 0, removed.palette); return next;
    }, "Palette restored.", () => { setRemoved(null); setNotice("Palette restored."); });
  }
  return { saved: shared ?? saved, storageReady, save, rename, remove, undoRemove: removed && removed.shared === Boolean(shared) ? restoreRemoved : undefined };
}
