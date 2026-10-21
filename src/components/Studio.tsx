"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePreviewToolbarClearance } from '@/hooks/usePreviewToolbarClearance';
import { useLinkState } from "@/hooks/useLinkState";
import { readField, sharedState, stateScope, stateWindow, type ViewState } from "../../browser/public/share-state";
import { createSharedLink } from "@/lib/shared-link";
import { oneOf } from "@/lib/link-state";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Copy,
  ClipboardPaste,
  FileJson,
  Sparkles,
  Undo2,
  Columns2,
  LockKeyhole,
  LoaderCircle,
  Moon,
  MousePointer2,
  MoreHorizontal,
  RotateCcw,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sun,
  Type,
  UnlockKeyhole,
  X,
} from "lucide-react";
import Link from "next/link";
import { useVisibleViewport } from "@/hooks/useVisibleViewport";
import IconButton from "./IconButton";
import { comparisonHref } from "@/lib/comparison";
import { copyText, readThemePaste } from "@/lib/clipboard";
import {paletteHistoryShortcut} from '@/lib/input-events';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "./ui/dropdown-menu";
import PalettePanel, { preloadPalettePanel } from "./PalettePanel";
import {copyPalette,copyTheme,readTheme,themePrompt,type Theme,type ThemeImport} from "@/lib/theme-transfer";
import { useSavedPalettes } from "@/hooks/useSavedPalettes";
import PreviewThumbnail from "./PreviewThumbnail";
import SiteSwitcher from "./SiteSwitcher";
import {previewCatalog,previewHref} from "@/lib/preview-catalog";
import { PopoverAnchor } from "./ui/popover";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerCopy,
  ColorPickerEyeDropper,
  ColorPickerFields,
  ColorPickerPanel,
  ColorPickerSlider,
  ColorPickerSwatches,
  ColorPickerTrigger,
} from "./reui/color-picker";
import {
  contrast,
  surfaceForegrounds,
  isPalette,
  isDarkPalette,
  defaultDarkPalette,
  initialPalette,
  paletteExport,
  paletteExportFormats,
  paletteForMode,
  paletteQuery,
  quickPickPresets,
  randomPalette,
  readPalette,
  roles,
  samePalette,
  type Palette,
  type PaletteExportFormat,
  type Role,
} from "@/lib/palette";
import { fonts, type FontName } from "@/lib/fonts";
import { isElementSelection, isElementRole, maxElementRoles, maxElementRolesLength, readElementRoles, setElementRoles, type ElementRole, type ElementSelection } from "@/lib/element-roles";

type StudioProps = { children?: (state: { palette: Palette; heading: FontName; body: FontName }) => ReactNode; preview?: string; defaultPalette?: Palette; waitForPreview?: boolean; capture?: { id: string; name: string } };
const siteLogoSelectors: Record<string, string> = {
  avenlo: '.nav__logo img',
  tervix: 'nav a[data-preview-path="/"]',
  orvian: 'img[alt="Orvian"]',
  nuvexa: 'nav img[alt="Nuvexa"]',
  workspace: '.side-title, .mobile-toggle',
  infrastructure: '[data-site-switcher-slot], .vc-topbar-team',
};
// Generated wordmark images have transparent space after the visible letters.
const wordmarkWidths: Record<string, number> = { avenlo: 0.66, orvian: 0.63, nuvexa: 0.72 };

function elementPanelPosition(selection: ElementSelection, frame: HTMLIFrameElement): CSSProperties {
  const frameBox = frame.getBoundingClientRect();
  const scale = frameBox.width / frame.clientWidth;
  const target = {
    left: frameBox.left + selection.bounds.left * scale,
    right: frameBox.left + selection.bounds.right * scale,
    top: frameBox.top + selection.bounds.top * scale,
    bottom: frameBox.top + selection.bounds.bottom * scale,
  };
  const width = 148, height = 94, gap = 10, edge = 8;
  const right = target.right + gap;
  const left = target.left - width - gap;
  const x = right + width <= innerWidth - edge ? right : left >= edge ? left : Math.max(edge, Math.min(target.left, innerWidth - width - edge));
  let y = target.top;
  if (right + width > innerWidth - edge && left < edge) {
    y = target.bottom + gap;
    if (y + height > innerHeight - edge) y = target.top - height - gap;
  }
  return { left: Math.max(edge, Math.min(x, innerWidth - width - edge)), top: Math.max(edge, Math.min(y, innerHeight - height - edge)) };
}

function elementSwatchStyle(selection: ElementSelection, color: string, recolor = false): CSSProperties {
  return selection.oldImage
    ? { backgroundColor: color, backgroundImage: selection.oldImage, backgroundBlendMode: recolor ? "luminosity" : "normal", backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: color };
}

export default function Studio({ children, preview = "/preview/index.html", defaultPalette = defaultDarkPalette, waitForPreview = false, capture }: StudioProps) {
  useVisibleViewport();
  const toolsTrigger = useRef<HTMLButtonElement>(null);
  const [toolsOpen, setToolsOpen] = useLinkState("Studio.toolsOpen", false);
  const [previewsOpen, setPreviewsOpen] = useLinkState("Studio.previewsOpen", false);
  const router = useRouter();
  const shareView = useRef<ViewState | null>(null);
  useEffect(() => {
    const capture = (event: Event) => {
      if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
      if (event.target instanceof Element && event.target.closest('[aria-label="Share palette"], [aria-label="Share view"], .toolbar-more')) shareView.current = sharedState();
    };
    window.addEventListener('pointerdown', capture, true); window.addEventListener('keydown', capture, true);
    return () => { window.removeEventListener('pointerdown', capture, true); window.removeEventListener('keydown', capture, true); };
  }, []);
  const [history, setHistory] = useLinkState<Palette[]>("Studio.Studio.history", [defaultPalette], { validate: value => Array.isArray(value) && value.length > 0 && value.every(isPalette) });
  const [index, setIndex] = useLinkState("Studio.Studio.index", 0, { validate: value => Number.isSafeInteger(value) && Number(value) >= 0 });
  const [previewPalette, setPreviewPalette] = useState<Palette | null>(null);
  const [activeColor, setActiveColor] = useLinkState<Role | null>("Studio.Studio.activeColor", null, { validate: oneOf(null, ...roles) });
  const palette = previewPalette ?? history[Math.min(index, history.length - 1)];
  const [locked, setLocked] = useLinkState<Role[]>("Studio.Studio.locked", [], { validate: value => Array.isArray(value) && value.every(role => roles.includes(role)) });
  const [heading, setHeading] = useState<FontName>("System");
  const [body, setBody] = useState<FontName>("System");
  const [panel, setPanel] = useLinkState<"fonts" | "saved" | null>("Studio.Studio.panel", null, { validate: oneOf(null, "fonts", "saved") });
  const [embedded, setEmbedded] = useState(false);
  const [comparisonToolbar, setComparisonToolbar] = useState(false);
  const comparisonState = useRef('');
  const [collapsed, setCollapsed] = useLinkState("Studio.Studio.collapsed", false);
  const [notice, setNotice] = useState("");
  const swatchTooltip = useId();
  const [exportOpen, setExportOpen] = useLinkState("Studio.Studio.exportOpen", false);
  const [pasteUndo, setPasteUndo] = useLinkState<Theme | null>("Studio.pasteUndo", null, { validate: value => {
    if (value === null) return true;
    if (!value || typeof value !== "object" || !("colors" in value) || !isPalette(value.colors) || !("fonts" in value) || !value.fonts || typeof value.fonts !== "object") return false;
    const pair = value.fonts as Record<string, unknown>;
    return typeof pair.heading === "string" && Object.hasOwn(fonts, pair.heading) && typeof pair.body === "string" && Object.hasOwn(fonts, pair.body) && "elements" in value && Array.isArray(value.elements) && value.elements.length <= maxElementRoles && value.elements.every(isElementRole);
  } });
  const [manualCopy, setManualCopy] = useLinkState<string | null>("Studio.manualCopy", null, { private: true, validate: value => value === null || typeof value === "string" });
  const [exportFormat, setExportFormat] = useLinkState<PaletteExportFormat>("Studio.Studio.exportFormat", "css", { validate: value => typeof value === "string" && Object.hasOwn(paletteExportFormats, value) });
  const [inspecting, setInspecting] = useLinkState("Studio.inspecting", false);
  const [selection, setSelection] = useLinkState<ElementSelection | null>("Studio.selection", null, { private: true, validate: value => value === null || isElementSelection(value) && value.path === window.location.pathname });
  const [elementRoles, setElementRolesState] = useLinkState<ElementRole[]>("Studio.elements", [], { validate: value => Array.isArray(value) && value.length <= maxElementRoles && value.every(isElementRole) });
  const [rolesReadyPath, setRolesReadyPath] = useState("");
  const { saved, remove, undoRemove, storageReady, save, rename } = useSavedPalettes(setNotice);
  useEffect(() => {
    const capture = () => {
      if (panel === "saved" && readField(stateScope(), "PalettePanel.PalettePanel.tab") === "saved") stateWindow().hexmixSharedPalettes = saved;
    };
    window.addEventListener('hexmix:capture', capture);
    return () => window.removeEventListener('hexmix:capture', capture);
  }, [panel, saved]);
  const frame = useRef<HTMLIFrameElement>(null);
  const newColorButton = useRef<HTMLButtonElement>(null);
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [showCapture, setShowCapture] = useState(false);
  const [readyPreview, setReadyPreview] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [slowPreview, setSlowPreview] = useState(false);
  const loadingPreview = !children && !showCapture && readyPreview !== preview;
  useEffect(() => {
    setSlowPreview(false);
    if (!loadingPreview) return;
    const timer = setTimeout(() => setSlowPreview(true), 15000);
    return () => clearTimeout(timer);
  }, [loadingPreview, preview, previewAttempt]);
  const [frameLoaded, setFrameLoaded] = useState(0);
  const [siteSwitcherPosition, setSiteSwitcherPosition] = useState<CSSProperties | null>(null);
  const previewId = capture?.id ?? (preview.startsWith("/dashboard-previews/infrastructure") ? "infrastructure" : preview.startsWith("/dashboard-previews/workspace") ? "workspace" : null);
  usePreviewToolbarClearance(frame, showCapture ? null : toolbarElement, preview);
  const attachFrame = useCallback((element: HTMLIFrameElement | null) => {
    frame.current = element;
    setReadyPreview(null);
    setSiteSwitcherPosition(null);
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setShowCapture(Boolean(capture && new URL(preview, window.location.origin).hostname === "127.0.0.1" && !["127.0.0.1", "localhost"].includes(window.location.hostname)));
  }, [capture?.id, preview]);
  useEffect(() => {
    const restore = () => {
    const query = new URLSearchParams(window.location.search);
    setEmbedded(['1', 'toolbar'].includes(query.get("embed") ?? ''));
    setComparisonToolbar(query.get("embed") === "toolbar");
    comparisonState.current = JSON.stringify([readPalette(window.location.search) ?? defaultPalette, query.get('heading') ?? 'System', query.get('body') ?? 'System', readElementRoles(window.location.search)]);
    const sharedHistory = readField(stateScope(), "Studio.Studio.history");
    if (!Array.isArray(sharedHistory) || !sharedHistory.length || !sharedHistory.every(isPalette)) setHistory([readPalette(window.location.search) ?? defaultPalette]);
    const h = query.get("heading"),
      b = query.get("body");
    setHeading(h && Object.hasOwn(fonts, h) ? h as FontName : "System");
    setBody(b && Object.hasOwn(fonts, b) ? b as FontName : "System");
    if (readField(stateScope(), "Studio.elements") === undefined) setElementRolesState(readElementRoles(window.location.search));
    setRolesReadyPath(window.location.pathname);
    if (readField(stateScope(), "Studio.selection") === undefined) setSelection(null);

    };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [capture?.id, defaultPalette]);
  useEffect(() => {
    if (!storageReady || rolesReadyPath !== window.location.pathname) return;
    const url = new URL(window.location.href);
    url.searchParams.set("colors", new URLSearchParams(paletteQuery(palette)).get("colors")!);
    url.searchParams.set("heading", heading); url.searchParams.set("body", body);
    setElementRoles(url.searchParams, elementRoles);
    window.history.replaceState(window.history.state, "", url);
  }, [children, storageReady, palette, heading, body, elementRoles, rolesReadyPath]);
  function updateInspector() {
    frame.current?.contentWindow?.postMessage({
      type: "hexmix-inspector-state", page: window.location.pathname, inspecting, assignments: elementRoles,
      selectedSelector: selection?.path === window.location.pathname ? selection.selector : null,
    }, new URL(preview, window.location.origin).origin);
  }
  useEffect(updateInspector, [inspecting, elementRoles, preview, selection?.path, selection?.selector]);
  useEffect(() => {
    if (selection) newColorButton.current?.focus();
  }, [selection?.path, selection?.selector]);
  useEffect(() => {
    if (!selection) return;
    const close = () => setSelection(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".element-panel, .element-role-menu")) close();
    };
    const frameDocument = frame.current?.contentDocument;
    const updatePosition = () => {
      const target = frame.current?.contentDocument?.querySelector(selection.selector);
      if (!target) return;
      const box = target.getBoundingClientRect();
      setSelection(current => current?.selector === selection.selector ? { ...current, bounds: { left: box.left, right: box.right, top: box.top, bottom: box.bottom } } : current);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    const onReady = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data?.type === "hexmix-inspector-ready") updatePosition(); };
    window.addEventListener("message", onReady);
    window.addEventListener("resize", updatePosition);
    frameDocument?.addEventListener("pointerdown", close, true);
    frameDocument?.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("message", onReady);
      window.removeEventListener("resize", updatePosition);
      frameDocument?.removeEventListener("pointerdown", close, true);
      frameDocument?.removeEventListener("scroll", updatePosition, true);
    };
  }, [selection]);
  function updateFrame() {
    const target = frame.current?.contentWindow;
    if (!target) return;
    if (capture || new URL(preview, window.location.origin).origin !== window.location.origin) {
      target.postMessage({
        type: "color-editor-theme",
        palette,
        foregrounds: surfaceForegrounds(palette),
        heading,
        body,
        paletteActive: !samePalette(palette, defaultPalette),
        dark: isDarkPalette(palette),
      }, new URL(preview, window.location.origin).origin);
      return;
    }
    const root = frame.current?.contentDocument?.documentElement;
    if (!root || (waitForPreview && root.dataset.editorReady !== "true")) return;
    if (!root.ownerDocument.querySelector('script[data-preview-contrast]')) {
      const script = root.ownerDocument.createElement("script");
      script.type = "module";
      script.src = "/preview-contrast.js";
      script.dataset.previewContrast = "true";
      root.ownerDocument.head.append(script);
    }
    if (!root.ownerDocument.querySelector('link[data-mobile-preview]')) {
      const link = root.ownerDocument.createElement("link");
      link.rel = "stylesheet";
      link.href = "/mobile-preview.css";
      link.dataset.mobilePreview = "true";
      root.ownerDocument.head.append(link);
    }
    if (!root.ownerDocument.querySelector('link[data-preview-fonts]')) {
      const link = root.ownerDocument.createElement("link");
      link.rel = "stylesheet";
      link.href = "/fonts/fonts.css";
      link.dataset.previewFonts = "true";
      root.ownerDocument.head.append(link);
    }
    if (!root.ownerDocument.querySelector('script[data-element-inspector]')) {
      const script = root.ownerDocument.createElement("script");
      script.src = "/element-inspector.js";
      script.dataset.elementInspector = "true";
      root.ownerDocument.head.append(script);
    }
    root.dataset.editorHeading = String(heading !== "System");
    root.dataset.editorBody = String(body !== "System");
    const style = root.style;
    root.dataset.recolored = String(
      !samePalette(palette, defaultPalette),
    );
    roles.forEach((role) => style.setProperty(`--p-${role}`, palette[role]));
    Object.entries(surfaceForegrounds(palette)).forEach(([surface,color])=>style.setProperty(`--p-on-${surface}`,color));
    style.setProperty("--p-bg", palette.background);
    style.setProperty("--p-heading-font", fonts[heading]);
    style.setProperty("--p-body-font", fonts[body]);
  }
  useEffect(updateFrame, [palette, heading, body, preview, defaultPalette, waitForPreview]);
  const updateSiteSwitcherPosition = useCallback(() => {
    const iframe = frame.current;
    const document = iframe?.contentDocument;
    const selector = previewId && siteLogoSelectors[previewId];
    const logo = selector && [...(document?.querySelectorAll(selector) ?? [])].find(element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top >= 0 && box.top < 100;
    });
    if (!iframe || !document || !logo) { setSiteSwitcherPosition(null); return; }
    const frameBox = iframe.getBoundingClientRect();
    const box = logo.getBoundingClientRect();
    const scale = frameBox.width / iframe.clientWidth;
    const slot = logo.hasAttribute('data-site-switcher-slot');
    const next = {
      width: slot ? box.width * scale : undefined,
      height: slot ? box.height * scale : undefined,
      left: slot ? frameBox.left + box.left * scale : frameBox.left + (box.left + box.width * (wordmarkWidths[previewId ?? ""] ?? 1) + 4) * scale,
      top: slot ? frameBox.top + box.top * scale : frameBox.top + (box.top + box.height / 2) * scale - 14,
      color: previewId === "nuvexa" ? palette.text : document.defaultView?.getComputedStyle(logo).color,
    };
    setSiteSwitcherPosition(previous => previous?.left === next.left && previous?.top === next.top && previous?.color === next.color && previous?.width === next.width && previous?.height === next.height ? previous : next);
  }, [previewId, palette.text]);
  useEffect(() => {
    updateSiteSwitcherPosition();
    const document = frame.current?.contentDocument;
    let frameId = 0;
    const schedule = () => { if (!frameId) frameId = requestAnimationFrame(() => { frameId = 0; updateSiteSwitcherPosition(); }); };
    const observer = !siteSwitcherPosition && document?.documentElement ? new MutationObserver(schedule) : null;
    if (observer && document?.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    const resizeObserver = new ResizeObserver(schedule);
    if (document && previewId) document.querySelectorAll(siteLogoSelectors[previewId]).forEach(logo => resizeObserver.observe(logo));
    document?.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => { observer?.disconnect(); resizeObserver.disconnect(); document?.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); cancelAnimationFrame(frameId); };
  }, [updateSiteSwitcherPosition, previewId, preview, readyPreview, frameLoaded, siteSwitcherPosition]);
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (embedded && event.source === window.parent && event.origin === window.location.origin && event.data?.type === "hexmix-comparison-colors" && isPalette(event.data.palette)) {
        const assignments = event.data.elements === undefined ? elementRoles : event.data.elements;
        if (!Array.isArray(assignments) || assignments.length > maxElementRoles || !assignments.every(isElementRole) || JSON.stringify(assignments).length > maxElementRolesLength) return;
        comparisonState.current = JSON.stringify([event.data.palette, event.data.heading, event.data.body, assignments]);
        if (JSON.stringify(assignments) !== JSON.stringify(elementRoles)) setElementRolesState(assignments);
        if (!samePalette(event.data.palette, history[index])) { setHistory([event.data.palette]); setIndex(0); }
        setPreviewPalette(null);
        const url = new URL(window.location.href);
        url.searchParams.set("colors", new URLSearchParams(paletteQuery(event.data.palette)).get("colors")!);
        for (const key of ["heading", "body"] as const) if (typeof event.data[key] === "string" && Object.hasOwn(fonts, event.data[key])) {
          if (key === "heading") setHeading(event.data[key] as FontName); else setBody(event.data[key] as FontName);
          url.searchParams.set(key, event.data[key]);
        }
        window.history.replaceState(null, "", url);
        return;
      }
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(preview, window.location.origin).origin) return;
      if (event.data?.type === "color-editor-ready") updateFrame();
      if (event.data?.type === "hexmix-inspector-ready") updateInspector();
      if (event.data?.type === "hexmix-inspect-exit") { setInspecting(false); setSelection(null); }
      if (event.data?.type === "hexmix-element-selected" && isElementSelection(event.data.selection)) {
        setSelection(event.data.selection);
        setPanel(null);
        setActiveColor(null);
      }
      if (event.data?.type === "color-editor-painted" && event.data.url === new URL(preview, window.location.origin).href && event.data.palette === roles.map(role => palette[role]).join("|")) setReadyPreview(preview);
      if (event.data?.type === "preview-toggle-theme") {
        if (embedded) window.parent.postMessage({ type: "hexmix-comparison-toggle-theme" }, window.location.origin);
        else apply(randomPalette(!isDarkPalette(palette)));
      }
      if (event.data?.type === "preview-navigate" && capture && typeof event.data.path === "string" && /^\/(?!\/)[a-zA-Z0-9%/_-]*$/.test(event.data.path)) {
        const query = new URLSearchParams(paletteQuery(palette));
        query.set("heading", heading); query.set("body", body);
        setElementRoles(query, elementRoles);
        const site=previewCatalog.find(preview=>preview.id===capture.id);
        if (embedded) query.set('embed', comparisonToolbar ? 'toolbar' : '1');
        if(site)router.push(`${site.path}${event.data.path === "/" ? "" : event.data.path.replaceAll(capture.id,site.path.slice(1))}?${query}`, { scroll: false });
      }
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [palette, heading, body, preview, defaultPalette, waitForPreview, capture?.id, router, inspecting, elementRoles, embedded, selection?.path, selection?.selector]);
  useEffect(() => {
    if (embedded) window.parent.postMessage({ type: "hexmix-comparison-ready" }, window.location.origin);
  }, [embedded]);
  useEffect(() => {
    if (!comparisonToolbar || !rolesReadyPath) return;
    const signature = JSON.stringify([history[index], heading, body, elementRoles]);
    if (signature === comparisonState.current) return;
    comparisonState.current = signature;
    window.parent.postMessage({ type: 'hexmix-comparison-change', palette: history[index], heading, body, elements: elementRoles }, window.location.origin);
  }, [comparisonToolbar, history, index, heading, body, elementRoles, rolesReadyPath]);
  useEffect(() => {
    if (!comparisonToolbar) return;
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('.site-switcher-menu a, .mobile-preview-menu a');
      if (!link) return;
      const path = new URL(link.href).pathname;
      const selected = previewCatalog.find(item => item.path === path);
      if (selected || path === '/') {
        event.preventDefault(); event.stopPropagation();
        window.parent.postMessage({ type: 'hexmix-comparison-preview', preview: selected?.id ?? 'gallery' }, window.location.origin);
      }
    };
    document.addEventListener('click', navigate, true);
    return () => document.removeEventListener('click', navigate, true);
  }, [comparisonToolbar]);
  useEffect(() => {
    if (comparisonToolbar) window.parent.postMessage({ type: 'hexmix-comparison-panel', open: Boolean(panel || activeColor || exportOpen) }, window.location.origin);
  }, [comparisonToolbar, panel, activeColor, exportOpen]);
  function toggleTheme() {
    if (comparisonToolbar) window.parent.postMessage({ type: 'hexmix-comparison-toggle-theme' }, window.location.origin);
    else apply({ ...palette, text: palette.background, background: palette.text });
  }
  useEffect(() => {
    if (exportOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [exportOpen]);
  useEffect(() => {
    if (!toolbarElement) return;
    const observer = new ResizeObserver(() => setToolbarHeight(toolbarElement.getBoundingClientRect().height));
    observer.observe(toolbarElement);
    return () => observer.disconnect();
  }, [toolbarElement]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), notice === "Palette removed." ? 10000 : 4000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!panel && !activeColor) return;
    const close = () => {
      setPanel(null);
      setActiveColor(null);
      setPreviewPalette(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel === "fonts") { close(); focusFontsTrigger(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (panel === "fonts" && !toolbarElement?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    const frameDocument = frame.current?.contentDocument;
    frameDocument?.addEventListener("pointerdown", close);
    const onFrameKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    frameDocument?.addEventListener("keydown", onFrameKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      frameDocument?.removeEventListener("pointerdown", close);
      frameDocument?.removeEventListener("keydown", onFrameKey);
    };
  }, [panel, activeColor, toolbarElement]);
  function apply(next: Palette) {
    setPreviewPalette(null);
    if (JSON.stringify(next) === JSON.stringify(history[index])) return;
    setHistory([...history.slice(0, index + 1), next]);
    setIndex(index + 1);
  }
  function undoPalette() { if (index <= 0) return false; setPreviewPalette(null); setIndex(index - 1); return true; }
  function redoPalette() { if (index >= history.length - 1) return false; setPreviewPalette(null); setIndex(index + 1); return true; }
  function randomize() {
    const next = randomPalette(isDarkPalette(palette));
    locked.forEach((role) => (next[role] = palette[role]));
    apply(next);
  }
  async function copy(text: string, message: string) {
    if (await copyText(text, dialog.current?.open ? dialog.current : document.body)) setNotice(message);
    else { setManualCopy(text); setPanel(null); setExportOpen(true); }
  }
  const pasteHandler = useRef(pasteText);
  const historyHandler = useRef((action: 'undo' | 'redo') => action === 'undo' ? undoPalette() : redoPalette());
  useEffect(() => { historyHandler.current = action => action === 'undo' ? undoPalette() : redoPalette(); });
  useEffect(() => { pasteHandler.current = pasteText; });
  useEffect(() => {
    const documents = new Set<Document>();
    const paste = (event: ClipboardEvent) => {
      const text = readThemePaste(event);
      if (text !== null) { event.preventDefault(); pasteHandler.current(text); }
    };
    const keydown = (event: KeyboardEvent) => {
      const action = paletteHistoryShortcut(event);
      if (action && historyHandler.current(action)) event.preventDefault();
    };
    const load = (event: Event) => {
      const node = event.target as HTMLIFrameElement;
      if (node?.tagName === 'IFRAME') { try { if (node.contentDocument) attach(node.contentDocument); } catch { /* Separate origins keep their native paste behavior. */ } }
    };
    function attach(doc: Document) {
      if (documents.has(doc)) return;
      documents.add(doc); doc.addEventListener('paste', paste); doc.addEventListener('load', load, true);
      doc.addEventListener('keydown', keydown);
      doc.querySelectorAll('iframe').forEach(node => { try { if (node.contentDocument) attach(node.contentDocument); } catch { /* Separate origins keep their native paste behavior. */ } });
    }
    attach(document);
    const message = (event: MessageEvent) => {
      if (comparisonToolbar && event.origin === window.location.origin && event.source === window.parent && event.data?.type === 'hexmix-paste-theme' && typeof event.data.text === 'string') pasteHandler.current(event.data.text);
      if (comparisonToolbar && event.origin === window.location.origin && event.source === window.parent && event.data?.type === 'hexmix-palette-history' && ['undo', 'redo'].includes(event.data.action)) historyHandler.current(event.data.action);
    };
    window.addEventListener('message', message);
    return () => { documents.forEach(doc => { doc.removeEventListener('paste', paste); doc.removeEventListener('keydown', keydown); doc.removeEventListener('load', load, true); }); window.removeEventListener('message', message); };
  }, [preview, comparisonToolbar, readyPreview]);
  function currentTheme(): Theme { return { colors: palette, fonts: { heading, body }, elements: elementRoles }; }
  async function pasteClipboard() {
    let text: string;
    try { text = await navigator.clipboard.readText(); }
    catch { setNotice("Use Command+V or Ctrl+V to paste a theme."); return; }
    await pasteText(text);
  }
  async function pasteText(text: string) {
    try { applyImport(await readTheme(text, window.location.origin)); }
    catch { setNotice("Clipboard has no valid palette or theme."); }
  }
  useEffect(() => {
    if (!exportOpen || manualCopy === null) return;
    const focus = requestAnimationFrame(() => { const input = dialog.current?.querySelector<HTMLTextAreaElement>('textarea'); input?.focus(); input?.select(); });
    return () => cancelAnimationFrame(focus);
  }, [exportOpen, manualCopy]);
  function startComparison() {
    if (comparisonToolbar) { window.parent.postMessage({ type: 'hexmix-comparison-options' }, window.location.origin); return; }
    const selected = previewCatalog.find(item => window.location.pathname === item.path || window.location.pathname.startsWith(item.path + '/'));
    const first = saved.find(item => samePalette(item.colors, palette));
    const second = saved.find(item => !samePalette(item.colors, palette));
    router.push(comparisonHref({ a: palette, b: second?.colors ?? (samePalette(palette, initialPalette) ? defaultDarkPalette : initialPalette), preview: selected?.id ?? 'avenlo', heading, body, nameA: first?.name ?? 'Palette A', nameB: second?.name ?? 'Palette B', elements: elementRoles, mode: isDarkPalette(palette) ? 'dark' : 'light' }));
  }
  async function share() {
    const host = stateWindow();
    const url = new URL(host.location.href);
    if (host === window) {
      url.searchParams.set("colors", new URLSearchParams(paletteQuery(palette)).get("colors")!);
      url.searchParams.set("heading", heading); url.searchParams.set("body", body);
      setElementRoles(url.searchParams, elementRoles);
    }
    try {
      const href = await createSharedLink(url, state => {
        if (shareView.current) state.views = { ...state.views, ...shareView.current.views };
        const own = state.views[stateScope()];
        if (saved.length && own?.["Studio.Studio.panel"] === "saved" && own?.["PalettePanel.PalettePanel.tab"] === "saved") state.views.shared = { palettes: saved };
      });
      shareView.current = null;
      await copy(href, "View link copied.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The share link could not be saved."); }
  }
  function download() {
    const format = paletteExportFormats[exportFormat];
    const url = URL.createObjectURL(
      new Blob([paletteExport(exportFormat, palette, fonts[heading], fonts[body])], {
        type: format.mime,
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = format.filename;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`${format.label} file downloaded.`);
  }
  function focusFontsTrigger() {
    const direct = toolbarElement?.querySelector<HTMLButtonElement>('button[aria-label="Fonts"]');
    const trigger = direct?.getClientRects().length ? direct : toolsTrigger.current;
    trigger?.focus();
  }
  function closeFonts() { setPanel(null); focusFontsTrigger(); }
  function toggleInspector() { setInspecting(!inspecting); setSelection(null); setPanel(null); setActiveColor(null); }
  useEffect(() => { if (panel === "fonts") document.getElementById("heading-font")?.focus(); }, [panel]);
  function togglePanel(next: "fonts" | "saved") {
    setActiveColor(null);
    setPreviewPalette(null);
    setPanel(panel === next ? null : next);
  }
  function applyImport(value: ThemeImport) {
    if (samePalette(palette,value.colors) && (!value.fonts?.heading || value.fonts.heading === heading) && (!value.fonts?.body || value.fonts.body === body) && (!value.elements || JSON.stringify(value.elements) === JSON.stringify(elementRoles))) {
      setNotice("Theme already applied."); return;
    }
    setPasteUndo({colors:palette,fonts:{heading,body},elements:elementRoles});
    apply(value.colors);
    if (value.fonts?.heading) setHeading(value.fonts.heading);
    if (value.fonts?.body) setBody(value.fonts.body);
    if (value.elements) setElementRolesState(value.elements);
    setNotice("Theme pasted.");
  }
  function undoPaste() {
    if (!pasteUndo) return;
    apply(pasteUndo.colors); setHeading(pasteUndo.fonts.heading); setBody(pasteUndo.fonts.body); setElementRolesState(pasteUndo.elements); setPasteUndo(null); setNotice("Previous theme restored.");
  }
  function openExport() { setManualCopy(null); setPanel(null); setExportOpen(true); }
  function reset() { apply(defaultPalette); setHeading("System"); setBody("System"); }
  function hideToolbar() {
    setPanel(null); setCollapsed(true);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[aria-label="Open color toolbar"]')?.focus());
  }
  const dark = isDarkPalette(palette);
  const capturePreview = previewCatalog.find(item=>item.id===capture?.id);
  const selectedRole = selection && elementRoles.find(item => item.path === selection.path && item.selector === selection.selector && item.property === selection.property)?.role;
  function assignElement(role: Role) {
    if (!selection) return;
    const remaining = elementRoles.filter(item => !(item.path === selection.path && item.selector === selection.selector && item.property === selection.property));
    if (remaining.length >= maxElementRoles) { setNotice("Remove an element choice before you add another."); return; }
    const next = [...remaining, { path: selection.path, selector: selection.selector, property: selection.property, role }];
    if (JSON.stringify(next).length > maxElementRolesLength) { setNotice("Remove an element choice before you add another."); return; }
    setElementRolesState(next);
  }
  function restoreElement() {
    if (!selection) return;
    setElementRolesState(current => current.filter(item => !(item.path === selection.path && item.selector === selection.selector && item.property === selection.property)));
    setSelection(null);
  }
  return (
    <main className={collapsed || embedded ? "studio studio-collapsed" : "studio"} data-app-ready={storageReady || undefined} data-comparison-toolbar={comparisonToolbar || undefined} style={{ visibility: storageReady ? "visible" : "hidden", background: children ? "var(--color-background)" : palette.background, "--toolbar-height": `${toolbarHeight}px` } as CSSProperties}>
      {children ? children({ palette, heading, body }) : showCapture && capture && capturePreview ? <div className="website-frame remote-preview" data-preview-capture={capture.id}>
        <a className="remote-preview-image" href={previewHref(`${capturePreview.path}/overview`,palette,heading,body,elementRoles)} aria-label={`Explore ${capture.name} pages`}><PreviewThumbnail id={capture.id} palette={palette} /></a>
        <div className="remote-preview-copy"><h1>{capture.name}</h1><nav className="remote-preview-links" aria-label={`${capture.name} pages`}>{[["overview","Explore pages"],["demo","Try the product"],["contact","Plan a session"]].map(([path,label])=><a key={path} href={previewHref(`${capturePreview.path}/${path}`,palette,heading,body,elementRoles)}>{label}</a>)}</nav></div>
      </div> : <iframe
        key={`${preview}:${previewAttempt}`}
        ref={attachFrame}
        className={preview.startsWith("/dashboard-previews/") ? "website-frame dashboard-frame" : "website-frame"}
        src={preview}
        title="Page preview"
        data-preview-ready={readyPreview === preview}
        aria-busy={loadingPreview}
        style={{ visibility: capture && readyPreview !== preview ? "hidden" : "visible" }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        onLoad={() => { updateFrame(); updateSiteSwitcherPosition(); setFrameLoaded(count => count + 1); if (!capture) setReadyPreview(preview); }}
      />}
      {loadingPreview && <div className="preview-loading" role="status" aria-label="Page preview loading" style={{background:palette.background,color:surfaceForegrounds(palette).background}}>
        <LoaderCircle className="preview-loading-spinner" size={24} aria-hidden="true"/>
        <span>{slowPreview ? "The preview is taking longer to load." : "Loading preview"}</span>
        {slowPreview && <IconButton className="icon-button" aria-label="Reload preview" onClick={() => { setSlowPreview(false); setPreviewAttempt(attempt => attempt + 1); }}><RotateCcw size={18}/></IconButton>}
      </div>}
      {!children && !embedded && <div className="preview-site-switcher" data-slot={Boolean(siteSwitcherPosition?.width) || undefined} data-integrated={Boolean(siteSwitcherPosition) || undefined} style={siteSwitcherPosition && (!capture || readyPreview === preview) ? siteSwitcherPosition : previewId && !showCapture ? { visibility: "hidden" } : { left: 8, top: 8 }}>
        <SiteSwitcher palette={palette} heading={heading} body={body} elementRoles={elementRoles} onOpen={()=>{setPanel(null);setActiveColor(null);setPreviewPalette(null);setSelection(null);setInspecting(false);}}/>
      </div>}
      {selection && frame.current && (
        <div className="element-panel" role="dialog" aria-label={`Colors for ${selection.label}`} style={elementPanelPosition(selection, frame.current)}>
          <button type="button" className="element-swatch-field" aria-label="Use old color" disabled={!selectedRole} onClick={restoreElement}>
            <span>Old</span>
            <span className="element-swatch"><span className="element-swatch-fill" style={elementSwatchStyle(selection, selection.oldColor)} /></span>
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><button ref={newColorButton} type="button" className="element-swatch-field" aria-label="Change new color"><span>New</span><span className="element-swatch"><span className="element-swatch-fill" style={elementSwatchStyle(selection, selectedRole ? palette[selectedRole] : selection.oldColor, Boolean(selectedRole))} /></span></button></DropdownMenuTrigger>
              <DropdownMenuContent className="palette-menu element-role-menu" side="right" sideOffset={8} align="start" aria-label="Choose new color">
                <DropdownMenuItem onSelect={restoreElement}><span className="element-role-chip element-role-chip-original"><span style={elementSwatchStyle(selection, selection.oldColor)} /></span>Original</DropdownMenuItem>
                {roles.map(role => <DropdownMenuItem key={role} onSelect={() => assignElement(role)}><span className="element-role-chip" style={{ backgroundColor: palette[role] }} />{role[0].toUpperCase() + role.slice(1)}</DropdownMenuItem>)}
              </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {(!embedded || comparisonToolbar) && (collapsed ? (
        <IconButton
          className="toolbar-reopen icon-button"
          aria-label="Open color toolbar"
          onClick={() => setCollapsed(false)}
        >
          <SlidersHorizontal size={19} />
        </IconButton>
      ) : (
        <div className="toolbar-anchor" ref={setToolbarElement}>
          {panel === "fonts" && (
            <section className="toolbar-panel font-panel" aria-label="Fonts">
              <div className="panel-title">
                <h2>Fonts</h2>
                <IconButton
                  className="icon-button"
                  aria-label="Close fonts"
                  onClick={closeFonts}
                >
                  <X size={17} />
                </IconButton>
              </div>
              <label htmlFor="heading-font">Headings</label>
              <select
                id="heading-font"
                value={heading}
                onChange={(event) => setHeading(event.target.value as FontName)}
              >
                {Object.keys(fonts).map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
              <label htmlFor="body-font">Body</label>
              <select
                id="body-font"
                value={body}
                onChange={(event) => setBody(event.target.value as FontName)}
              >
                {Object.keys(fonts).map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </section>
          )}
          <div
            className="color-toolbar"
            role="region"
            aria-label="Color toolbar"
          >
            <div className="toolbar-colors">
              {roles.map((role) => (
                <div className="toolbar-color" key={role}>
                  <ColorPicker
                    value={palette[role]}
                    format="hex"
                    open={activeColor === role}
                    onOpenChange={(open) => {
                      setActiveColor((current) => open ? role : current === role ? null : current);
                      setPreviewPalette(null);
                      if (open) setPanel(null);
                    }}
                    onValueChange={(value) => {
                      const next = { ...history[index], [role]: value };
                      if (isPalette(next)) setPreviewPalette(next);
                    }}
                    onValueCommit={(value) => {
                      const next = { ...history[index], [role]: value };
                      if (isPalette(next)) apply(next);
                    }}
                    aria-label={`${role[0].toUpperCase() + role.slice(1)} color`}
                  >
                    <PopoverAnchor virtualRef={{ current: toolbarElement }} />
                    <ColorPickerTrigger
                      className="color-trigger"
                      aria-describedby={`${swatchTooltip}-${role}`}
                      style={{
                        background: palette[role],
                        color:
                          contrast(palette[role], "#ffffff") >=
                          contrast(palette[role], "#000000")
                            ? "#ffffff"
                            : "#000000",
                      }}
                    >
                      <span className="color-trigger-name">{role === "background" ? <>Backg<wbr />round</> : role === "secondary" ? <>Secon<wbr />dary</> : role === "primary" ? <>Pri<wbr />mary</> : role === "accent" ? <>Acc<wbr />ent</> : role[0].toUpperCase() + role.slice(1)}</span>
                      {locked.includes(role) && <LockKeyhole size={12} aria-hidden="true" />}
                      <span className="control-tooltip swatch-tooltip" role="tooltip" id={`${swatchTooltip}-${role}`}>
                        {role[0].toUpperCase() + role.slice(1)} color
                      </span>
                    </ColorPickerTrigger>
                    <ColorPickerContent
                      className="color-picker-content"
                      side="top"
                      sideOffset={16}
                      align="center"
                      onCloseAutoFocus={(event) => {
                        if (panel || (activeColor && activeColor !== role)) event.preventDefault();
                      }}
                    >
                      <div className="color-picker-heading">
                        <h2>{role[0].toUpperCase() + role.slice(1)}</h2>
                        <IconButton
                          className="icon-button"
                          aria-pressed={locked.includes(role)}
                          title={`${locked.includes(role) ? "Unlock" : "Lock"} ${role}`}
                          aria-label={`${locked.includes(role) ? "Unlock" : "Lock"} ${role}`}
                          onClick={() =>
                            setLocked(
                              locked.includes(role)
                                ? locked.filter((item) => item !== role)
                                : [...locked, role],
                            )
                          }
                        >
                          {locked.includes(role) ? (
                            <LockKeyhole size={11} />
                          ) : (
                            <UnlockKeyhole size={11} />
                          )}
                        </IconButton>
                        <IconButton
                          className="icon-button"
                          aria-label="Close color picker"
                          onClick={() => {
                            setActiveColor(null);
                            setPreviewPalette(null);
                          }}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                      <ColorPickerPanel>
                        <ColorPickerArea />
                        <div className="flex items-center gap-3">
                          <ColorPickerEyeDropper className="icon-button" />
                          <ColorPickerSlider channel="hue" className="flex-1" />
                          <ColorPickerCopy className="icon-button" />
                        </div>
                        <ColorPickerFields formats={["hex", "rgb", "hsl"]} />
                        <ColorPickerSwatches
                          colors={quickPickPresets.map((preset) => ({
                            value: preset.colors[role],
                            label: preset.name,
                          }))}
                        />
                      </ColorPickerPanel>
                    </ColorPickerContent>
                  </ColorPicker>
                </div>
              ))}
            </div>
            <div className="toolbar-transfer" role="group" aria-label="Palette clipboard">
              <IconButton className="icon-button" aria-label="Copy palette" onClick={()=>void copy(copyPalette(palette), "Palette copied.")}><Copy size={17}/></IconButton>
              <IconButton className="icon-button" aria-label="Paste palette or theme" onClick={()=>void pasteClipboard()}><ClipboardPaste size={17}/></IconButton>
              <IconButton className="icon-button" aria-label="Copy theme and settings" onClick={()=>void copy(copyTheme(currentTheme()), "Theme copied.")}><FileJson size={17}/></IconButton>
              <IconButton className="icon-button" aria-label="Copy for AI" onClick={()=>void copy(themePrompt(currentTheme()), "AI prompt copied.")}><Sparkles size={17}/></IconButton>
              <IconButton className="icon-button" aria-label="Undo paste" disabled={!pasteUndo} onClick={undoPaste}><Undo2 size={17}/></IconButton>
            </div>
            <div className="toolbar-actions">
              <IconButton className="icon-button toolbar-secondary" aria-label="Compare palettes" onClick={startComparison}><Columns2 size={17}/></IconButton>
              <IconButton
                className="icon-button"
                aria-label="Shuffle palette"
                data-quick-action=""
                onClick={randomize}
              >
                <Shuffle size={17} />
              </IconButton>
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Undo palette"
                aria-keyshortcuts="Control+z Meta+z"
                data-quick-action=""
                disabled={index === 0}
                onClick={undoPalette}
              >
                <ArrowLeft size={17} />
              </IconButton>
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Redo palette"
                aria-keyshortcuts="Control+Shift+z Meta+Shift+z"
                disabled={index === history.length - 1}
                onClick={redoPalette}
              >
                <ArrowRight size={17} />
              </IconButton>
              <IconButton
                className="icon-button"
                aria-label={dark ? "Use light palette" : "Use dark palette"}
                onClick={toggleTheme}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </IconButton>
              <span className="toolbar-divider" />
              <IconButton
                className="icon-button"
                aria-label="Fonts"
                aria-expanded={panel === "fonts"}
                onClick={() => togglePanel("fonts")}
              >
                <Type size={17} />
              </IconButton>
              <IconButton className="icon-button" aria-label={inspecting ? "Stop selecting elements" : "Select an element"} title="Alt+click an element to change its color" aria-pressed={inspecting} disabled={showCapture || Boolean(children)} onClick={toggleInspector}><MousePointer2 size={17} /></IconButton>
              <PalettePanel
                key={comparisonToolbar ? 'comparison' : 'single'}
                initialTab={comparisonToolbar ? "saved" : "presets"}
                initialBrowse={comparisonToolbar}
                open={panel === "saved"}
                anchor={toolbarElement}
                palette={palette}
                saved={saved}
                previewId={capture?.id ?? (preview.startsWith("/dashboard-previews/infrastructure") ? "infrastructure" : "workspace")}
                onOpenChange={(open) => {
                  setPanel((current) => open ? "saved" : current === "saved" ? null : current);
                  if (open) {
                    setActiveColor(null);
                    setPreviewPalette(null);
                  }
                }}
                onApply={(next, item) => {
                  apply(comparisonToolbar ? paletteForMode(next, dark ? 'dark' : 'light') : next);
                  if (comparisonToolbar && item) window.parent.postMessage({ type: 'hexmix-comparison-name', name: item.name }, window.location.origin);
                }}
                onSave={(name) => save(palette, name)} onRename={rename}
                onRemove={remove}
                onShare={share}
                onCopy={item=>void copy(copyPalette(item.colors), `${item.name} copied.`)}
                notice={notice}
                onUndoRemove={undoRemove}
                returnFocus={toolsTrigger}
                restoreFocus={!activeColor && panel !== "fonts"}
              />
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Share palette"
                onClick={share}
              >
                <Share2 size={16} />
              </IconButton>
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Export palette"
                onClick={openExport}
              >
                <ArrowDownToLine size={17} />
              </IconButton>
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Reset palette and fonts"
                onClick={reset}
              >
                <RotateCcw size={16} />
              </IconButton>
              <DropdownMenu modal={false} open={toolsOpen} onOpenChange={open => { if (open) { shareView.current ??= sharedState(); setPanel(null); setActiveColor(null); setPreviewPalette(null); } setToolsOpen(open); }}>
                <DropdownMenuTrigger asChild><IconButton ref={toolsTrigger} className="icon-button toolbar-more" aria-label="More tools"><MoreHorizontal size={17} /></IconButton></DropdownMenuTrigger>
                <DropdownMenuContent className="palette-menu" side="top" sideOffset={Math.max(12, toolbarHeight - 32)} align="end" aria-label="More tools" onCloseAutoFocus={event => { if (exportOpen || collapsed || panel) event.preventDefault(); }}>
                  <DropdownMenuGroup className="mobile-tools">
                    <DropdownMenuItem onSelect={randomize}>Shuffle palette</DropdownMenuItem>
                    <DropdownMenuItem onSelect={toggleTheme}>{dark ? "Use light palette" : "Use dark palette"}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => togglePanel("fonts")}>Fonts</DropdownMenuItem>
                    <DropdownMenuItem onPointerEnter={preloadPalettePanel} onFocus={preloadPalettePanel} onSelect={() => togglePanel("saved")}>Palettes</DropdownMenuItem>
                    <DropdownMenuItem disabled={showCapture || Boolean(children)} onSelect={toggleInspector}>{inspecting ? "Stop selecting elements" : "Select an element"}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </DropdownMenuGroup>
                  <DropdownMenuItem disabled={index === 0} onSelect={undoPalette}>Undo palette</DropdownMenuItem>
                  <DropdownMenuItem disabled={index === history.length - 1} onSelect={redoPalette}>Redo palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={startComparison}>Compare palettes</DropdownMenuItem>
                  <DropdownMenuItem onSelect={share}>Share palette</DropdownMenuItem>
                  <DropdownMenuGroup className="clipboard-tools">
                    <DropdownMenuItem asChild><IconButton className="icon-button" aria-label="Copy palette" onClick={()=>void copy(copyPalette(palette), "Palette copied.")}><Copy size={17}/></IconButton></DropdownMenuItem>
                    <DropdownMenuItem asChild><IconButton className="icon-button" aria-label="Paste palette or theme" onClick={()=>void pasteClipboard()}><ClipboardPaste size={17}/></IconButton></DropdownMenuItem>
                    <DropdownMenuItem asChild><IconButton className="icon-button" aria-label="Copy theme and settings" onClick={()=>void copy(copyTheme(currentTheme()), "Theme copied.")}><FileJson size={17}/></IconButton></DropdownMenuItem>
                    <DropdownMenuItem asChild><IconButton className="icon-button" aria-label="Copy for AI" onClick={()=>void copy(themePrompt(currentTheme()), "AI prompt copied.")}><Sparkles size={17}/></IconButton></DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuItem asChild disabled={!pasteUndo}><IconButton className="icon-button" aria-label="Undo paste" disabled={!pasteUndo} onClick={undoPaste}><Undo2 size={17}/></IconButton></DropdownMenuItem>
                  <DropdownMenuItem onSelect={openExport}>Export palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={reset}>Reset palette and fonts</DropdownMenuItem>
                  <DropdownMenuItem onSelect={hideToolbar}>Hide color toolbar</DropdownMenuItem>
                  <DropdownMenuGroup className="mobile-tools">
                    <DropdownMenuSub open={previewsOpen} onOpenChange={setPreviewsOpen}>
                      <DropdownMenuSubTrigger>Previews</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="palette-menu mobile-preview-menu" aria-label="Previews">
                        {previewCatalog.map(site => <DropdownMenuItem asChild key={site.id}><Link prefetch={false} href={previewHref(site.path, palette, heading, body, elementRoles)}>{site.name}</Link></DropdownMenuItem>)}
                        <DropdownMenuItem asChild><Link prefetch={false} href={previewHref("/", palette, heading, body, elementRoles)}>All sites</Link></DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Hide color toolbar"
                onClick={hideToolbar}
              >
                <ChevronDown size={17} />
              </IconButton>
            </div>
          </div>
        </div>
      ))}
      {notice && panel !== "saved" && (
        <div className="toast" role="status">
          {notice}
          {undoRemove && (notice === "Palette removed." || notice === "Your browser could not save this palette.") && <IconButton className="icon-button" aria-label="Undo palette removal" onClick={undoRemove}><Undo2 size={17}/></IconButton>}
        </div>
      )}
      <dialog
        ref={dialog}
        aria-label="Export"
        onCancel={() => setExportOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setExportOpen(false);
        }}
      >
        <div className="export-dialog">
          <div className="panel-title">
            <h2>{manualCopy === null ? "Export" : "Copy text"}</h2>
            <IconButton className="icon-button" aria-label="Share view" onClick={share}><Share2 size={18}/></IconButton>
            <IconButton
              className="icon-button"
              aria-label="Close export"
              onClick={() => setExportOpen(false)}
            >
              <X size={18} />
            </IconButton>
          </div>
          {manualCopy !== null ? <label className="manual-copy">Text to copy<textarea readOnly value={manualCopy} onFocus={event=>event.target.select()}/></label> : <>
          <label className="export-format">Format
            <select aria-label="Format" value={exportFormat} onChange={event => setExportFormat(event.target.value as PaletteExportFormat)}>
              {Object.entries(paletteExportFormats).map(([value, format]) => <option value={value} key={value}>{format.label}</option>)}
            </select>
          </label>
          {exportFormat === "tailwind" && <p className="export-help">Add this block to your Tailwind 4 stylesheet.</p>}
          <pre role="region" tabIndex={0} aria-label={`${paletteExportFormats[exportFormat].label} export`}><code>{paletteExport(exportFormat, palette, fonts[heading], fonts[body])}</code></pre>
          </>}
          {manualCopy === null && <div className="dialog-actions">
            <IconButton className="icon-button" aria-label={`Copy ${paletteExportFormats[exportFormat].label}`} onClick={()=>void copy(paletteExport(exportFormat,palette,fonts[heading],fonts[body]),`${paletteExportFormats[exportFormat].label} copied.`)}><Copy size={18}/></IconButton>
            <IconButton className="icon-button" aria-label={`Download ${paletteExportFormats[exportFormat].label}`} onClick={download}><ArrowDownToLine size={18}/></IconButton>
          </div>}
        </div>
      </dialog>
    </main>
  );
}
