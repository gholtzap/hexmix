import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class Element {
  attributes = new Map();
  listeners = new Map();
  style: Record<string,string> = {};
  focused = false;
  selectors: Record<string, Element> = {};
  parentElement?: Element;
  firstElementChild?: Element;
  inert = false;
  scrollY = 0;
  createElement?: () => {content: {firstElementChild:Element}};
  dispatchEvent?: (event:{type:string}) => void;
  matchMedia?: () => {matches?:boolean;addEventListener?:()=>void};
  children = [];
  classes = new Set();
  classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  fire(name, event = {}) { this.listeners.get(name)?.(event); }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  append(child) { this.children.push(child); }
  focus() { this.focused = true; }
  querySelector(selector) { return this.selectors?.[selector]; }
}

test('navigation closes menus and tracks scroll position', () => {
  const nav = new Element();
  const band = new Element();
  const resources = new Element();
  const dropdown = new Element();
  const menu = new Element();
  const arrow = new Element();
  const toggle = new Element();
  const path = new Element();
  const mobile = new Element();
  const document = new Element();
  resources.parentElement = dropdown;
  resources.selectors = { svg: arrow };
  toggle.selectors = { path };
  dropdown.children.push(resources, menu);
  nav.children.push(dropdown, toggle, mobile);
  nav.firstElementChild = band;
  nav.selectors = { '[aria-controls="resources-menu"]': resources, '#resources-menu': menu, '[aria-label="Toggle menu"]': toggle };
  document.selectors = { 'nav.sticky': nav };
  document.createElement = () => ({ content: { firstElementChild: mobile } });
  let demo;
  document.dispatchEvent = event => { demo = event.type; };
  const window = new Element();
  window.scrollY = 0;
  window.matchMedia = () => ({ addEventListener() {} });
  vm.runInNewContext(readFileSync(new URL('../public/navigation.js', import.meta.url), 'utf8'), { document, window, CustomEvent: class { type: string; constructor(type: string) { this.type = type; } } });

  dropdown.fire('mouseenter');
  dropdown.fire('focusin', { target: resources });
  resources.fire('click');
  assert.equal(resources.getAttribute('aria-expanded'), 'true');
  assert.equal(menu.classes.has('visible'), true);
  assert.equal(menu.inert, false);
  dropdown.fire('focusout', { relatedTarget: null });
  assert.equal(resources.getAttribute('aria-expanded'), 'false');
  dropdown.fire('mouseenter');
  document.fire('pointerdown', { target: new Element() });
  assert.equal(menu.inert, true);

  toggle.fire('click');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(mobile.inert, false);
  document.fire('keydown', { key: 'Escape' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(mobile.style.maxHeight, '0px');
  assert.equal(toggle.focused, true);

  let prevented = false;
  nav.fire('click', { target: { closest: () => ({ href: '#demo' }) }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false, 'The shared demo dialog owns the local demo action');
  assert.equal(menu.inert, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  window.scrollY = 5;
  window.fire('scroll');
  assert.equal(band.classes.has('backdrop-blur-md'), true);
  window.scrollY = 4;
  window.fire('scroll');
  assert.equal(band.classes.has('backdrop-blur-md'), false);
});
