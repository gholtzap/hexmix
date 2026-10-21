import { registerSharedView, readField, stateScope, stateWindow, matchesShape } from './share-state.ts';

function selector(element: Element): string {
  if (element.id && !/^(?:_r_|radix-|base-ui-)/.test(element.id)) return `#${CSS.escape(element.id)}`;
  const label = element.getAttribute('aria-label');
  if (label) { const match = `[aria-label="${CSS.escape(label)}"]`; if (document.querySelectorAll(match).length === 1) return match; }
  const path: string[] = [];
  for (let item: Element | null = element; item && item !== document.body; item = item.parentElement) {
    const index = item.parentElement ? [...item.parentElement.children].indexOf(item) + 1 : 1;
    path.unshift(`${item.tagName.toLowerCase()}:nth-child(${index})`);
  }
  return `body > ${path.join(' > ')}`;
}
type Fields = Record<string, string | boolean>;
type Position = { top: number; left: number };
type View = { expanded: string[]; collapsed?: string[]; tabs: string[]; details: string[]; dialogs: string[]; current: string[]; classes: Record<string, string[]>; hidden: Record<string, boolean>; scroll: Record<string, Position> };
const viewClasses = ['is-open', 'active', 'is-active', 'is-visible', 'compact-view', 'alternate-display'];
const controlled = '.studio, .comparison-page, .infrastructure-app, .vc-modal, .vc-menu-popup, .palette-panel, .color-picker-content, .site-switcher-menu, .theme-transfer, [data-orvian-dialog]';
const workspaceMenu = '#sched-filter,#plug-add,[data-explore],.avatar,.add-button,[data-chat-options],[data-space-create],[data-space-filter],[data-space-actions]';

export function startViewCapture() {
  if (document.documentElement.dataset.sharedView === 'true') return () => {};
  document.documentElement.dataset.sharedView = 'true';
  const restored = new Set<string>();
  let pendingFields: unknown, pendingView: unknown, pendingContent: unknown;
  const scrollers = new Set<Element>();
  const authored = (node: Element) => !node.closest(controlled) && (node.id && !/^(?:_r_|radix-|base-ui-)/.test(node.id) || node.matches('.agent-card,[data-cookie-banner]'));
  const hiddenNodes = new Set<Element>([...document.querySelectorAll('[hidden], .agent-card, #open-agent, [data-cookie-banner]')].filter(authored));
  const classNodes = new Set<Element>([document.body, document.documentElement, ...document.querySelectorAll(viewClasses.map(name => `.${name}`).join(','))]);
  let restoring = false, timer: ReturnType<typeof setTimeout> | undefined;
  const fields = () => [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([type=password]):not([type=file]):not([type=hidden]):not([readonly]), select, textarea:not([readonly])')].filter(node => !node.closest(controlled));
  const validFields = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([key, item]) => key.length <= 1000 && (typeof item === 'string' || typeof item === 'boolean'));
  const validView = (value: unknown) => matchesShape(value, { expanded: [''], tabs: [''], details: [''], dialogs: [''], current: [''], classes: {}, hidden: {}, scroll: {} }) && ((value as View).collapsed === undefined || Array.isArray((value as View).collapsed) && (value as View).collapsed!.every(key => typeof key === 'string' && key.length <= 1000)) && Object.values((value as View).classes).every(names => Array.isArray(names) && names.every(name => viewClasses.includes(name))) && Object.values((value as View).hidden).every(item => typeof item === 'boolean') && Object.values((value as View).scroll).every(position => matchesShape(position, { top: 0, left: 0 }) && position.top >= 0 && position.top <= 1 && position.left >= 0 && position.left <= 1);
  const applyFields = (value: Fields) => {
    for (const [key, text] of Object.entries(value)) {
      if (restored.has(key)) continue;
      let node: Element | null; try { node = document.querySelector(key); } catch { continue; }
      if (!node || !fields().includes(node as HTMLInputElement)) continue;
      restored.add(key);
      if (typeof text === 'boolean' && node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type)) node.checked = text;
      else if (typeof text === 'string') {
        const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(node, text);
      }
      node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  const applyView = (value: View) => {
    for (const key of value.current) { try { const node = document.querySelector(key); if (node instanceof HTMLButtonElement && node.hasAttribute('data-plan') && node.getAttribute('aria-current') !== 'true' && !restored.has(`current:${key}`)) { restored.add(`current:${key}`); node.click(); } } catch { /* Invalid controls are ignored. */ } }
    for (const key of [...value.expanded, ...(value.collapsed ?? []), ...value.tabs]) {
      if (restored.has(`control:${key}`)) continue;
      let node: Element | null; try { node = document.querySelector(key); } catch { continue; }
      if (!(node instanceof HTMLElement) || !node.matches(`button[aria-expanded],button[role=tab],[role=tab][tabindex],${workspaceMenu}`)) continue;
      restored.add(`control:${key}`);
      const close = value.collapsed?.includes(key);
      if (close ? node.getAttribute('aria-expanded') === 'true' : node.getAttribute('aria-expanded') === 'false' || node.getAttribute('aria-selected') === 'false' || node.matches(workspaceMenu) && node.getAttribute('aria-expanded') !== 'true') node.click();
    }
    for (const key of value.details) { try { const node = document.querySelector(key); if (node instanceof HTMLDetailsElement) node.open = true; } catch { /* Invalid selectors are ignored. */ } }
    for (const key of value.dialogs) { try { const node = document.querySelector(key); if (node instanceof HTMLDialogElement && !restored.has(`dialog:${key}`)) { restored.add(`dialog:${key}`); if (!node.open) node.showModal(); } } catch { /* Detached dialogs cannot open. */ } }
    for (const [key, names] of Object.entries(value.classes)) { if (restored.has(`classes:${key}`)) continue; try { const node = document.querySelector(key); if (node) { restored.add(`classes:${key}`); viewClasses.forEach(name => node.classList.toggle(name, names.includes(name))); } } catch { /* Invalid selectors are ignored. */ } }
    for (const [key, hidden] of Object.entries(value.hidden)) { if (restored.has(`hidden:${key}`)) continue; try { const node = document.querySelector(key); if (node instanceof HTMLElement && hiddenNodes.has(node) && node !== document.body && node !== document.documentElement) { restored.add(`hidden:${key}`); node.hidden = hidden; if (node.hasAttribute('data-cookie-banner')) node.inert = hidden; } } catch { /* Invalid selectors are ignored. */ } }
    for (const [key, position] of Object.entries(value.scroll)) {
      const node = key === 'document' ? document.scrollingElement : (() => { try { return document.querySelector(key); } catch { return null; } })();
      if (!node || restored.has(`scroll:${key}`) || node.scrollHeight <= node.clientHeight) continue;
      node.scrollTop = position.top * Math.max(0, node.scrollHeight - node.clientHeight);
      node.scrollLeft = position.left * Math.max(0, node.scrollWidth - node.clientWidth);
      restored.add(`scroll:${key}`);
    }
  };
  registerSharedView('document.fields', {
    private: true,
    read: () => Object.fromEntries(fields().filter(node => node instanceof HTMLSelectElement ? [...node.options].some(option => option.selected !== option.defaultSelected) : node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type) ? node.checked !== node.defaultChecked : node.value !== node.defaultValue).map(node => [selector(node), node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type) ? node.checked : node.value])),
    restore: value => { pendingFields = value; restoring = true; applyFields(value as Fields); restoring = false; },
    validate: validFields,
  });
  registerSharedView('document.view', {
    read: () => {
      const scroll: Record<string, Position> = {};
      for (const node of [document.scrollingElement, ...scrollers]) {
        if (!node || !node.scrollTop && !node.scrollLeft) continue;
        scroll[node === document.scrollingElement ? 'document' : selector(node)] = { top: node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight), left: node.scrollLeft / Math.max(1, node.scrollWidth - node.clientWidth) };
      }
      document.querySelectorAll(viewClasses.map(name => `.${name}`).join(',')).forEach(node => { if (!node.closest(controlled)) classNodes.add(node); });
      document.querySelectorAll('[hidden]').forEach(node => { if (authored(node)) hiddenNodes.add(node); });
      const openControls = (query: string) => [...document.querySelectorAll(query)].filter(node => !node.closest(controlled)).map(selector);
      return { expanded: openControls('button[aria-expanded=true]'), collapsed: openControls('button[aria-expanded=false]'), tabs: openControls('[role=tab][aria-selected=true]'), details: openControls('details[open]'), dialogs: openControls('dialog[open]'), current: openControls('button[data-plan][aria-current=true]'), classes: Object.fromEntries([...classNodes].filter(node => node.isConnected && !node.closest(controlled)).map(node => [node === document.documentElement ? 'html' : node === document.body ? 'body' : selector(node), viewClasses.filter(name => node.classList.contains(name))])), hidden: Object.fromEntries([...hiddenNodes].filter(node => node.isConnected && authored(node)).map(node => [selector(node), (node as HTMLElement).hidden])), scroll };
    },
    restore: value => { pendingView = value; restoring = true; applyView(value as View); restoring = false; },
    validate: validView,
  });
  const contentNodes = 'dialog h2, dialog p, #form-status, .nuvexa-form-result, .agent-status, #demo-description, #interval';
  const validContent = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(item => typeof item === 'string');
  const applyContent = (value: Record<string, string>) => { for (const [key, text] of Object.entries(value)) { if (restored.has(`text:${key}`)) continue; try { const node = document.querySelector(key); if (node?.matches(contentNodes) && !node.closest(controlled)) { restored.add(`text:${key}`); node.textContent = text; } } catch { /* Invalid selectors are ignored. */ } } };
  registerSharedView('document.content', { private: true, read: () => Object.fromEntries([...document.querySelectorAll(contentNodes)].filter(node => !node.closest(controlled)).map(node => [selector(node), node.textContent ?? ''])), restore: value => { pendingContent = value; applyContent(value as Record<string, string>); }, validate: validContent });
  // Controls can mount after fonts, preview data, or a named dialog have loaded.
  const retry = () => {
    if (restoring) return;
    restoring = true;
    if (validFields(pendingFields)) applyFields(pendingFields as Fields);
    if (validView(pendingView)) applyView(pendingView as View);
    if (validContent(pendingContent)) applyContent(pendingContent as Record<string, string>);
    restoring = false;
  };
  const observer = new MutationObserver(retry); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
  const scroll = (event: Event) => { if (event.target instanceof Element) scrollers.add(event.target); if (!restoring && !timer) timer = setTimeout(() => { timer = undefined; window.dispatchEvent(new Event('hexmix:capture')); }, 200); };
  document.addEventListener('scroll', scroll, true);
  window.addEventListener('pageshow', retry);
  const restoreHistory = () => { restored.clear(); pendingFields = readField(stateScope(), 'document.fields'); pendingView = readField(stateScope(), 'document.view'); pendingContent = readField(stateScope(), 'document.content'); requestAnimationFrame(retry); };
  stateWindow().addEventListener('popstate', restoreHistory);
  return () => { observer.disconnect(); clearTimeout(timer); document.removeEventListener('scroll', scroll, true); window.removeEventListener('pageshow', retry); stateWindow().removeEventListener('popstate', restoreHistory); delete document.documentElement.dataset.sharedView; };
}
