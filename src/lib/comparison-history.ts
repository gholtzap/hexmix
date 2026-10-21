type Side = 'a' | 'b';
type Position = { preview: string; a: string; b: string };
const sides: Side[] = ['a', 'b'];
const field = 'hexmixComparisonNavigation';

export function comparisonHistory(preview: string, paths: Record<Side, string>, frames: Record<Side, HTMLIFrameElement | null>, enabled: () => boolean) {
  const valid = (side: Side, path: unknown): path is string => typeof path === 'string' && (path === paths[side] || path.startsWith(paths[side] + '/'));
  const read = (): Position | null => {
    const value: Partial<Position> | undefined = window.history.state?.[field];
    return value?.preview === preview && valid('a', value.a) && valid('b', value.b) ? value as Position : null;
  };
  const initial: Position = { preview, ...paths };
  if (!read()) window.history.replaceState({ ...window.history.state, [field]: initial }, '', window.location.href);
  const visit = (child: Window, path: string) => {
    const url = new URL(child.location.href); url.pathname = path;
    child.location.replace(url.href);
  };
  const restore = () => {
    if (!enabled()) return;
    const position = read();
    if (!position) return;
    for (const side of sides) {
      const child = frames[side]?.contentWindow;
      if (child && child.location.origin === window.location.origin) visit(child, position[side]);
    }
  };
  window.addEventListener('popstate', restore);
  const bindings = new Set<() => void>();
  const bind = (side: Side, child: Window) => {
    const history = child.history, originalPush = history.pushState, replace = history.replaceState;
    const push: History['pushState'] = (data, unused, url) => {
      const target = new URL(url ?? child.location.href, child.location.href);
      if (!enabled() || target.origin !== window.location.origin || !valid(side, target.pathname)) return originalPush.call(history, data, unused, url);
      const position = read() ?? initial;
      const moved = target.pathname !== child.location.pathname;
      // Let the native API validate the child entry before adding the shared entry.
      replace.call(history, data, unused, url);
      if (moved && (position.a !== target.pathname || position.b !== target.pathname)) {
        const next: Position = { preview, a: target.pathname, b: target.pathname };
        window.history.pushState({ ...window.history.state, [field]: next }, '', window.location.href);
      }
      // The mirrored route now replaces its child entry without another parent push.
    };
    history.pushState = push;
    const expected = read()?.[side];
    if (enabled() && expected && child.location.pathname !== expected) visit(child, expected);
    const unbind = () => { if (history.pushState === push) history.pushState = originalPush; bindings.delete(unbind); };
    bindings.add(unbind);
    return unbind;
  };
  return { bind, dispose: () => { window.removeEventListener('popstate', restore); bindings.forEach(unbind => unbind()); } };
}
