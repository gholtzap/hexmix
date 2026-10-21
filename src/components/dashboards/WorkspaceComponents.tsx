"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { TextResponse } from "@aicss/react/text-response";
import { Orb } from "@aicss/react/orbs";
import { CardDialog, DropdownMenu, IconButton, SegmentedControl, Slider, Toast } from "./vendor/halaska";
import { clearSharedDialog } from '../../../browser/public/dashboard-previews/workspace/shared';

import type { DashboardDialog, MenuItem, DashboardComponents } from "../../../browser/types/workspace";
export type { DashboardDialog } from "../../../browser/types/workspace";


function Effort({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [current, setCurrent] = useState(value);
  return <Slider value={current} min={0} max={4} aria-label="Thinking effort" onChange={next => { setCurrent(next); onChange(next); }} />;
}

function createComponents() {
  const roots = new Map<HTMLElement, Root>();
  let closeDialog: (() => void) | undefined;
  let closeMenu: (() => void) | undefined;
  let noticeTimer: ReturnType<typeof setTimeout>;
  const mount = (host: HTMLElement, node: ReactNode) => {
    const root = roots.get(host) ?? createRoot(host);
    roots.set(host, root);
    flushSync(() => root.render(node));
  };
  const unmountWithin = (container: HTMLElement) => {
    for (const [host, root] of roots) if (host === container || container.contains(host)) {
      root.unmount(); roots.delete(host);
    }
  };
  const disposeView = () => {
    closeMenu?.(); closeDialog?.();
    const app = document.querySelector<HTMLElement>("#app");
    if (app) unmountWithin(app);
    document.querySelectorAll<HTMLElement>("[data-effort-control]").forEach(unmountWithin);
  };
  const dialog = (title: string, body: string, onOpen?: (panel: DashboardDialog) => void) => {
    closeMenu?.(); closeDialog?.();
    const host = document.createElement("div");
    host.className = "library-dialog"; host.dataset.component = "halaska-card-dialog";
    document.body.append(host);
    const app = document.querySelector<HTMLElement>("#app");
    const previousInert = app?.inert;
    if (app) app.inert = true;
    const close = () => {
      if (!host.isConnected) return;
      clearSharedDialog();
      if (app) app.inert = previousInert ?? false;
      unmountWithin(host); host.remove();
      if (closeDialog === close) closeDialog = undefined;
    };
    closeDialog = close;
    mount(host, <CardDialog open onClose={close} title={title} theme="dark">
      <div className="library-dialog-close"><IconButton label="Close dialog" onClick={close} icon={<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M5 15 15 5" fill="none" stroke="currentColor" strokeWidth="1.25" /></svg>} /></div>
      <div data-dialog-body dangerouslySetInnerHTML={{ __html: body }} />
    </CardDialog>);
    const panel = host.querySelector<DashboardDialog>('[role="dialog"]')!;
    panel.classList.add("modal"); panel.close = close;
    onOpen?.(panel);
    const orb = panel.querySelector<HTMLElement>("[data-voice-orb]");
    if (orb) { orb.dataset.component = "aicss-orb"; mount(orb, <Orb variant="B1" size={120} label="Voice preview" />); }
    return panel;
  };
  const menu = (anchor: HTMLElement, items: MenuItem[]) => {
    closeMenu?.();
    const host = document.createElement("div");
    host.className = "library-menu"; host.dataset.component = "halaska-dropdown-menu";
    document.body.append(host);
    const app = document.querySelector<HTMLElement>("#app");
    const previousInert = app?.inert;
    if (app) app.inert = true;
    anchor.setAttribute("aria-expanded", "true"); anchor.setAttribute("aria-haspopup", "menu");
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      if (app) app.inert = previousInert ?? false;
      anchor.setAttribute("aria-expanded", "false");
      if (anchor.isConnected) anchor.focus({ preventScroll: true });
      if (closeMenu === close) closeMenu = undefined;
      // The kit closes from its React event handler. Release its root after that event.
      queueMicrotask(() => { unmountWithin(host); host.remove(); });
    };
    closeMenu = close;
    mount(host, <DropdownMenu externalAnchor={anchor} onClose={close} theme="dark" items={items.map(item => ({ label: item.label, onClick: () => { close(); item.action?.(); } }))} />);
    const panel = host.querySelector<HTMLElement>('[role="menu"]')!;
    panel.classList.add("menu");
    const rect = anchor.getBoundingClientRect();
    Object.assign(panel.style, { position: "fixed", left: `${Math.max(8,Math.min(rect.left,innerWidth-260))}px`, right: "auto", width: "248px", marginTop: "0px" });
    panel.style.top = `${rect.bottom+6+panel.offsetHeight>innerHeight?Math.max(8,rect.top-panel.offsetHeight-6):rect.bottom+6}px`;
    panel.querySelector<HTMLButtonElement>("button")?.focus();
  };
  const toast = (message: string) => {
    const host = document.querySelector<HTMLElement>("#notice")!;
    host.hidden = false; host.dataset.component = "halaska-toast";
    mount(host, <Toast message={message} theme="dark" />);
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { host.hidden = true; }, 3500);
  };
  return {
    dialog, menu, toast, disposeView, unmountWithin,
    mode(host: HTMLElement, work: boolean, onChange: (view: string) => void) {
      host.dataset.component = "halaska-segmented-control";
      mount(host, <SegmentedControl options={["Chat", "Work"]} value={work?"Work":"Chat"} onChange={value => onChange(value.toLowerCase())} theme="dark" />);
    },
    effort(host: HTMLElement, value: number, onChange: (value: number) => void) {
      host.dataset.component = "halaska-slider";
      mount(host, <Effort value={value} onChange={onChange} />);
    },
    response(host: HTMLElement, text: string) {
      host.dataset.component = "aicss-text-response"; host.classList.add("library-response");
      mount(host, <TextResponse>{text.split(/\n+/).map((line,index)=><p key={index}>{line}</p>)}</TextResponse>);
    },
    destroy() { disposeView(); clearTimeout(noticeTimer); for (const root of roots.values()) root.unmount(); roots.clear(); },
  };
}

export default function WorkspaceComponents() {
  useEffect(() => {
    const components: DashboardComponents = createComponents(); window.dashboardComponents = components;
    const updateTheme = () => {
      const rgb = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.slice(0,3).map(Number) ?? [15,15,15];
      document.documentElement.dataset.theme = rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>128?"light":"dark";
    };
    updateTheme();
    document.documentElement.dataset.editorReady = "true";
    window.parent.postMessage({ type: "color-editor-ready" }, window.location.origin);
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["style"]});
    const recolorMedia = () => document.querySelectorAll<HTMLImageElement>(".space-template-art img, img.plug-logo").forEach((image, index) => {
      if (image.dataset.paletteMedia) return;
      image.dataset.paletteMedia = "true";
      image.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"/>')}`;
      image.style.backgroundImage = `radial-gradient(circle at ${index % 2 ? 75 : 25}% 25%, var(--p-primary), transparent 65%), linear-gradient(135deg, var(--p-secondary), var(--p-accent))`;
      image.style.backgroundSize = "cover";
    });
    const mediaObserver = new MutationObserver(recolorMedia);
    mediaObserver.observe(document.body, { childList: true, subtree: true });
    recolorMedia();
    const script = document.createElement("script"); script.type="module"; script.src="/dashboard-previews/workspace/app.js";
    document.body.append(script);
    return () => { script.remove(); observer.disconnect(); mediaObserver.disconnect(); components.destroy(); delete window.dashboardComponents; };
  }, []);
  return <><div id="app" /><div id="notice" className="notice" hidden /></>;
}
