import { parseState, maxStateBytes } from '../../browser/public/share-state.ts';
import { validShareHref, type SharedSnapshot } from './shared-link.ts';

export function parseSnapshot(value: unknown): SharedSnapshot | null {
  if (!value || typeof value !== 'object' || !('v' in value) || value.v !== 1 || !('href' in value) || !validShareHref(value.href) || !('state' in value)) return null;
  const raw = JSON.stringify(value.state);
  if (typeof raw !== 'string') return null;
  const state = parseState(raw);
  if (raw.length > maxStateBytes || JSON.stringify(state) !== raw) return null;
  return { v: 1, href: value.href, state };
}
