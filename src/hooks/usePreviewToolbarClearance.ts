"use client";

import { useEffect, type RefObject } from 'react';

export function usePreviewToolbarClearance(frame: RefObject<HTMLIFrameElement | null>, toolbar: HTMLElement | null, source: string) {
  useEffect(() => {
    const child = frame.current;
    const anchor = toolbar?.closest<HTMLElement>('.toolbar-anchor');
    if (!child || !toolbar || !anchor) return;
    const studio = anchor.closest<HTMLElement>('.studio');
    let disconnect = () => {};
    const clear = () => { anchor.style.removeProperty('bottom'); anchor.removeAttribute('data-preview-toolbar-hidden'); studio?.style.removeProperty('--toolbar-clearance'); };
    const connect = () => {
      disconnect();
      const document = child.contentDocument, view = document?.defaultView;
      if (!document?.body || !view || document.URL === 'about:blank') return;
      const update = () => {
        clear();
        const base = anchor.getBoundingClientRect(), bounds = child.getBoundingClientRect();
        if (!base.width || !bounds.width) return;
        if (document.body.classList.contains('drawer-open') || document.querySelector('.vc-sidebar.is-open')) {
          anchor.setAttribute('data-preview-toolbar-hidden', ''); return;
        }
        const scale = bounds.width / view.innerWidth;
        const baseline = innerHeight - base.bottom;
        let bottom = baseline;
        const boxes: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>[] = [];
        for (const popup of document.querySelectorAll('[role="menu"], [role="dialog"], dialog[open], .chat-input-area, .vc-agent-form, .vc-mobile-tools')) {
          const style = view.getComputedStyle(popup), box = popup.getBoundingClientRect();
          if (popup.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || !box.width || !box.height) continue;
          const top = bounds.top + box.top * scale, lower = bounds.top + box.bottom * scale;
          const left = bounds.left + box.left * scale, right = bounds.left + box.right * scale;
          boxes.push({ top, bottom: lower, left, right });
        }
        for (const box of boxes.sort((a, b) => b.top - a.top)) {
          if (box.left < base.right && box.right > base.left && box.top < innerHeight - bottom && box.bottom > innerHeight - bottom - base.height) bottom = Math.max(bottom, innerHeight - box.top + 8);
        }
        studio?.style.setProperty('--toolbar-clearance', `${bottom + base.height + 8}px`);
        if (bottom + base.height > innerHeight - 8) anchor.setAttribute('data-preview-toolbar-hidden', '');
        else if (bottom > baseline + 1) anchor.style.setProperty('bottom', `${bottom}px`, 'important');
      };
      const observer = new MutationObserver(update);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden', 'open'] });
      const resize = new ResizeObserver(update); resize.observe(toolbar); resize.observe(child);
      document.addEventListener('scroll', update, true); document.fonts.addEventListener('loadingdone', update);
      update();
      disconnect = () => { observer.disconnect(); resize.disconnect(); document.removeEventListener('scroll', update, true); document.fonts.removeEventListener('loadingdone', update); clear(); };
    };
    child.addEventListener('load', connect); connect();
    return () => { child.removeEventListener('load', connect); disconnect(); clear(); };
  }, [frame, toolbar, source]);
}
