"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { isJson, matchesShape, readField, stateScope, stateWindow, writeField } from '../../browser/public/share-state';

type Options = { validate?: (value: unknown) => boolean; sample?: unknown; private?: boolean; scope?: string };

// The key is a stable URL field name. Keep it when a component moves or is renamed.
export function useLinkState<T>(key: string, initial: T | (() => T), options: Options = {}): [T, Dispatch<SetStateAction<T>>] {
  const defaults = useRef<{ value: T } | null>(null);
  if (!defaults.current) defaults.current = { value: typeof initial === 'function' ? (initial as () => T)() : initial };
  const [value, setValue] = useState(defaults.current.value);
  const latest = useRef(value); latest.current = value;
  const config = useRef(options); config.current = options;
  const pageScope = typeof window === 'undefined' ? '' : stateScope();
  const scope = options.scope === 'shared' ? 'shared' : options.scope ? `${pageScope}:${options.scope}` : pageScope;
  const restore = useCallback(() => {
    const candidate = readField(scope, key);
    const valid = config.current.validate ?? ((item: unknown) => matchesShape(item, config.current.sample ?? defaults.current!.value));
    const next = candidate !== undefined && valid(candidate) ? candidate as T : defaults.current!.value;
    if (Object.is(next, latest.current) || JSON.stringify(next) === JSON.stringify(latest.current)) return;
    latest.current = next;
    setValue(latest.current);
  }, [scope, key]);
  useEffect(() => {
    restore();
    const host = stateWindow();
    host.addEventListener('popstate', restore); host.addEventListener('hexmix:restore', restore); host.addEventListener('hexmix:state', restore);
    return () => { host.removeEventListener('popstate', restore); host.removeEventListener('hexmix:restore', restore); host.removeEventListener('hexmix:state', restore); };
  }, [restore]);
  const update = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const result = typeof next === 'function' ? (next as (previous: T) => T)(latest.current) : next;
    latest.current = result; setValue(result);
    const json: unknown = JSON.parse(JSON.stringify(result) ?? 'null');
    if (isJson(json)) writeField(scope, key, json, config.current.private);
  }, [scope, key]);
  return [value, update];
}
