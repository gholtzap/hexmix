"use client";

import { useCallback, useRef, useState, type ComponentType } from "react";

export function useDeferredComponent<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const [Component, setComponent] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const request = useCallback(() => {
    if (Component || pending.current) return;
    setLoading(true);
    const work = load().then(module => { setComponent(() => module.default); setError(false); }, () => setError(true));
    pending.current = work;
    void work.finally(() => { pending.current = null; setLoading(false); });
  }, [Component, load]);
  return { Component, error, loading, request };
}
