import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

interface TestElement {
  attrs: Map<string,string>; classes: Set<string>;
  setAttribute(name:string,value:string):void; getAttribute(name:string):string;
  classList:{toggle(name:string,open:boolean):void};
  nextElementSibling?: TestElement; querySelector?:()=>TestElement; icon?:TestElement;
  addEventListener?:(event:string,handler:()=>void)=>void; click?:()=>void; id?:string;hidden?:boolean;
}
function element(): TestElement {
  const attrs = new Map<string,string>();
  const classes = new Set<string>();
  return {
    attrs, classes,
    setAttribute(name, value) { attrs.set(name, value); },
    getAttribute(name) { return attrs.get(name); },
    classList: {
      toggle(name, open) { if (open) classes.add(name); else classes.delete(name); },
    },
  };
}

test('FAQ starts with the first answer open and permits one open answer', () => {
  const buttons = Array.from({ length: 4 }, () => {
    const button = element();
    const icon = element();
    button.nextElementSibling = element();
    button.querySelector = () => icon;
    button.icon = icon;
    button.addEventListener = (event, handler) => {
      assert.equal(event, 'click');
      button.click = handler;
    };
    return button;
  });
  vm.runInNewContext(readFileSync(new URL('../public/faq.js', import.meta.url), 'utf8'), {
    document: { querySelectorAll: (selector) => {
      assert.equal(selector, '#faq button');
      return buttons;
    } },
  });
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'true');
  assert(buttons.slice(1).every(button => button.getAttribute('aria-expanded') === 'false'));
  buttons[0].click();
  assert(buttons.every(button => button.getAttribute('aria-expanded') === 'false'));
  for (const [index, button] of buttons.entries()) {
    const answer = button.nextElementSibling;
    assert.equal(button.getAttribute('aria-controls'), answer.id);
    assert.equal(answer.getAttribute('aria-labelledby'), button.id);
    assert.equal(answer.id, `faq-answer-${index}`);
    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(answer.getAttribute('aria-hidden'), 'false');
    assert(answer.classes.has('max-h-[2000px]'));
    assert(answer.classes.has('pb-6'));
    assert(button.classes.has('text-peach'));
    assert(button.icon.classes.has('rotate-180'));
    assert.equal(buttons.filter(other => other.getAttribute('aria-expanded') === 'true').length, 1);
  }
  buttons[3].click();
  for (const button of buttons) {
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(button.nextElementSibling.getAttribute('aria-hidden'), 'true');
    assert(button.nextElementSibling.classes.has('max-h-0'));
    assert(!button.icon.classes.has('rotate-180'));
    assert(!button.nextElementSibling.classes.has('pb-6'));
  }
});
