const controls = 'a[href],button,input,textarea,select,summary,form,canvas,dialog,[role="dialog"],.scrim,.vc-modal,[data-orvian-dialog],[role="button"],[role="tab"],[role="menuitem"],[role="switch"],[role="checkbox"],[role="radio"],[contenteditable="true"]';
const openMenus = (document: Document) => [...document.querySelectorAll('[role="menu"]')].filter(menu => {
  const style = document.defaultView!.getComputedStyle(menu);
  return menu.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden';
});
const text = (value: string | null) => value?.replace(/\s+/g, ' ').trim() ?? '';

function label(element: Element) {
  const ids = element.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
  return text(element.getAttribute('aria-label')) || text(ids.map(id => element.ownerDocument.getElementById(id)?.textContent ?? '').join(' ')) || text([...(element as HTMLInputElement).labels ?? []].map(item => item.textContent).join(' ')) || text(element.getAttribute('title'));
}

function counterpart(element: Element, other: Document): () => Element | null {
  const source = element.ownerDocument;
  const tag = element.tagName.toLowerCase();
  const selectors: string[] = [];
  for (const selector of ['.scrim', '.vc-modal', '[data-orvian-dialog]']) if (element.matches(selector)) selectors.push(selector);
  for (const key of ['id', 'data-nav', 'data-action', 'data-tab', 'data-view', 'data-page', 'data-preview-path', 'name', 'placeholder']) {
    const value = element.getAttribute(key);
    if (key === 'id' && value && /^(?:_r_|radix-|:r|base-ui)/.test(value)) continue;
    if (value) selectors.push(`${tag}[${key}="${CSS.escape(value)}"]`);
  }
  const href = (item: Element) => {
    if (!item.hasAttribute('href')) return '';
    try {
      const url = new URL(item.getAttribute('href')!, item.ownerDocument.URL);
      for (const key of ['colors', 'heading', 'body', 'embed', 'state', 'snapshot']) url.searchParams.delete(key);
      return url.origin + url.pathname + url.search + url.hash;
    } catch { return ''; }
  };
  const destination = href(element);
  const accessible = label(element);
  const content = text(element.textContent);
  const candidates = (document: Document, selector: string) => [...document.querySelectorAll(selector)];
  const radio = element.matches('input[type="radio"]') ? element.getAttribute('value') : undefined;
  const queries = selectors.map(selector => (document: Document) => candidates(document, selector).filter(item => radio === undefined || item.getAttribute('value') === radio));
  for (const match of [
    (item: Element) => Boolean(destination) && href(item) === destination,
    (item: Element) => Boolean(accessible) && label(item) === accessible,
    (item: Element) => Boolean(content) && text(item.textContent) === content,
    (item: Element) => element.matches('input,textarea,select,form') && item.getAttribute('type') === element.getAttribute('type'),
  ]) queries.push(document => candidates(document, tag).filter(match));
  const choices = queries.map(select => {
    const from = select(source);
    return { select, count: from.length, index: from.indexOf(element) };
  }).filter(choice => choice.index >= 0);
  return () => {
    for (const { select, count, index } of choices) {
      const to = select(other);
      if (to.length === count && to.length) return to[index] ?? null;
    }
    return null;
  };
}

export function comparisonInteractions() {
  let replaying = false;
  const submitted = new WeakSet<Element>();
  const toggled = new WeakSet<Element>();
  return (document: Document, otherDocument: () => Document | undefined, enabled: () => boolean) => {
    const mirror = (event: Event) => {
      if (replaying || !enabled()) return;
      if (!event.isTrusted && !['input', 'change', 'submit'].includes(event.type)) return;
      const source = event.target as Element | null;
      if (source?.nodeType !== 1) return;
      const element = source?.nodeType === 1 ? source.closest(controls) : null;
      const other = otherDocument();
      if (!other?.defaultView) return;
      if (!element) {
        if (['pointerdown', 'mousedown', 'click'].includes(event.type) && !source?.closest('dialog,[role="dialog"],[role="menu"]')) {
          setTimeout(() => {
            if (!enabled() || otherDocument() !== other) return;
            replaying = true;
            try {
              other.body.dispatchEvent(event.type === 'pointerdown' ? new other.defaultView!.PointerEvent(event.type, { bubbles: true }) : new other.defaultView!.MouseEvent(event.type, { bubbles: true }));
              if (!openMenus(document).length) for (const menu of openMenus(other)) {
                (menu.querySelector('[role="menuitem"]') ?? menu).dispatchEvent(new other.defaultView!.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              }
            }
            finally { replaying = false; }
          }, 0);
        }
        return;
      }
      if (element.matches('dialog,[role="dialog"]') && element !== source && event.type !== 'cancel') return;
      if (['pointermove', 'pointercancel'].includes(event.type) && !element.matches('canvas')) return;
      const matching = counterpart(element, other);
      const view = other.defaultView;
      const mouse = event as MouseEvent;
      if (['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup'].includes(event.type) && (mouse.button !== 0 || mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.altKey)) return;
      if (event.type === 'click' && element.matches('input,textarea,select') && !element.matches('input[type="checkbox"],input[type="radio"],input[type="submit"],input[type="button"]')) return;
      if (event.type === 'keydown') {
        const key = (event as KeyboardEvent).key;
        if (key === 'Escape') return;
        if (!(key === 'Enter' && element.tagName === 'TEXTAREA') && !element.matches('[role="tab"],[role="menuitem"]')) return;
      }
      if (['input', 'change'].includes(event.type) && toggled.has(element)) return;
      if (event.type === 'click' && element.matches('input[type="checkbox"],input[type="radio"]')) { toggled.add(element); setTimeout(() => toggled.delete(element), 0); }
      if (event.type === 'submit' && submitted.has(element)) return;
      if (event.type === 'click' && element.matches('button:not([type]),button[type="submit"],input[type="submit"]')) {
        const form = (element as HTMLButtonElement).form;
        if (form) { submitted.add(form); setTimeout(() => submitted.delete(form), 0); }
      }
      const expanded = element.getAttribute('aria-expanded');
      const detailsOpen = element.closest('details')?.open;
      const checked = (element as HTMLInputElement).checked;
      const value = (element as HTMLInputElement).value;
      const bounds = element.matches('canvas') ? element.getBoundingClientRect() : null;
      const point = bounds ? { x: (mouse.clientX - bounds.left) / (bounds.width || (element as HTMLCanvasElement).width), y: (mouse.clientY - bounds.top) / (bounds.height || (element as HTMLCanvasElement).height) } : null;
      const files = element.matches('input[type="file"]') ? Array.from((element as HTMLInputElement).files ?? []) : null;
      // Let the original handler finish before running another app's handler.
      setTimeout(() => {
        if (!enabled() || otherDocument() !== other) return;
        const target = matching() as HTMLElement | null;
        if (!target?.isConnected) return;
        replaying = true;
        // Native handlers use this marker for actions that affect the shared host.
        other.documentElement.setAttribute('data-comparison-replay', '');
        try {
          if (event.type === 'click') {
            if (element.matches('input[type="checkbox"]') && (target as HTMLInputElement).checked === checked) (target as HTMLInputElement).checked = !checked;
            if (element.hasAttribute('aria-expanded') && !element.hasAttribute('aria-haspopup') && target.getAttribute('aria-expanded') !== expanded) return;
            if (element.tagName === 'SUMMARY' && target.closest('details')?.open !== detailsOpen) return;
            target.click();
          } else if (event.type === 'input' || event.type === 'change') {
            if (files) {
              const transfer = new view.DataTransfer();
              files.forEach(file => transfer.items.add(file));
              (target as HTMLInputElement).files = transfer.files;
            } else if (element.matches('[contenteditable="true"]')) target.textContent = element.textContent;
            else {
              const property = element.matches('input[type="checkbox"],input[type="radio"]') ? 'checked' : 'value';
              const prototype = element.tagName === 'TEXTAREA' ? view.HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? view.HTMLSelectElement.prototype : view.HTMLInputElement.prototype;
              // Use the native setter so React receives the change as well.
              Object.getOwnPropertyDescriptor(prototype, property)?.set?.call(target, property === 'checked' ? checked : value);
              if (element.matches('select[multiple]')) [...(target as HTMLSelectElement).options].forEach((option, index) => { option.selected = (element as HTMLSelectElement).options[index]?.selected ?? false; });
            }
            target.dispatchEvent(new view.Event(event.type, { bubbles: true }));
          } else if (event.type === 'submit') {
            (target as HTMLFormElement).requestSubmit();
          } else if (event.type === 'cancel') {
            if (target.dispatchEvent(new view.Event('cancel', { cancelable: true })) && (target as HTMLDialogElement).open) (target as HTMLDialogElement).close();
          } else if (event.type === 'keydown') {
            const key = event as KeyboardEvent;
            target.dispatchEvent(new view.KeyboardEvent('keydown', { key: key.key, code: key.code, shiftKey: key.shiftKey, ctrlKey: key.ctrlKey, altKey: key.altKey, metaKey: key.metaKey, bubbles: true, cancelable: true }));
          } else if (event.type.startsWith('pointer')) {
            const pointer = event as PointerEvent;
            const rect = point ? target.getBoundingClientRect() : null;
            target.dispatchEvent(new view.PointerEvent(event.type, { bubbles: true, cancelable: true, button: pointer.button, buttons: pointer.buttons, ...(point && rect ? { clientX: rect.left + point.x * (rect.width || (target as HTMLCanvasElement).width), clientY: rect.top + point.y * (rect.height || (target as HTMLCanvasElement).height) } : {}), pointerType: pointer.pointerType, pointerId: pointer.pointerId, isPrimary: pointer.isPrimary }));
          } else target.dispatchEvent(new view.MouseEvent(event.type, { bubbles: true, cancelable: true, button: mouse.button }));
        } finally { other.documentElement.removeAttribute('data-comparison-replay'); replaying = false; }
      }, 0);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || replaying || !enabled()) return;
      const other = otherDocument();
      if (!other?.defaultView) return;
      const source = event.target as Element | null;
      const control = source?.nodeType === 1 ? source.closest(controls) : null;
      const matching = control ? counterpart(control, other) : () => other.body;
      setTimeout(() => {
        if (!enabled() || otherDocument() !== other) return;
        replaying = true;
        try { (matching() ?? other.body).dispatchEvent(new other.defaultView!.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); }
        finally { replaying = false; }
      }, 0);
    };
    const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'click', 'input', 'change', 'submit', 'cancel'];
    const host = document.defaultView!;
    types.forEach(type => host.addEventListener(type, mirror, true));
    host.addEventListener('keydown', escape, true);
    host.addEventListener('keydown', mirror, true);
    return () => { types.forEach(type => host.removeEventListener(type, mirror, true)); host.removeEventListener('keydown', escape, true); host.removeEventListener('keydown', mirror, true); };
  };
}
