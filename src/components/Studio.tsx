"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  LockKeyhole,
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
import { Button } from "./ui/button";
import { comparisonHref } from "@/lib/comparison";
import { copyText } from "@/lib/clipboard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "./ui/dropdown-menu";
import PalettePanel from "./PalettePanel";
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
import { isElementSelection, maxElementRoles, maxElementRolesLength, readElementRoles, setElementRoles, type ElementRole, type ElementSelection } from "@/lib/element-roles";

type StudioProps = { children?: (state: { palette: Palette; heading: FontName; body: FontName }) => ReactNode; preview?: string; defaultPalette?: Palette; waitForPreview?: boolean; capture?: { id: string; name: string } };

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
  const router = useRouter();
  const [history, setHistory] = useState<Palette[]>([defaultPalette]);
  const [index, setIndex] = useState(0);
  const [previewPalette, setPreviewPalette] = useState<Palette | null>(null);
  const [activeColor, setActiveColor] = useState<Role | null>(null);
  const palette = previewPalette ?? history[index];
  const [locked, setLocked] = useState<Role[]>([]);
  const [heading, setHeading] = useState<FontName>("System");
  const [body, setBody] = useState<FontName>("System");
  const [panel, setPanel] = useState<"fonts" | "saved" | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [selection, setSelection] = useState<ElementSelection | null>(null);
  const [elementRoles, setElementRolesState] = useState<ElementRole[]>([]);
  const [rolesReadyPath, setRolesReadyPath] = useState("");
  const [embedded, setEmbedded] = useState(false);
  const [comparisonToolbar, setComparisonToolbar] = useState(false);
  const comparisonState = useRef('');
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<PaletteExportFormat>("css");
  const { saved, remove, storageReady, save, rename } = useSavedPalettes(setNotice);
  const frame = useRef<HTMLIFrameElement>(null);
  const newColorButton = useRef<HTMLButtonElement>(null);
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [showCapture, setShowCapture] = useState(false);
  const [readyPreview, setReadyPreview] = useState<string | null>(null);
  const attachFrame = useCallback((element: HTMLIFrameElement | null) => {
    frame.current = element;
    setReadyPreview(null);
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setShowCapture(Boolean(capture && new URL(preview, window.location.origin).hostname === "127.0.0.1" && !["127.0.0.1", "localhost"].includes(window.location.hostname)));
  }, [capture?.id, preview]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setEmbedded(['1', 'toolbar'].includes(query.get("embed") ?? ''));
    setComparisonToolbar(query.get("embed") === "toolbar");
    comparisonState.current = JSON.stringify([readPalette(window.location.search) ?? defaultPalette, query.get('heading') ?? 'System', query.get('body') ?? 'System']);
    setHistory([readPalette(window.location.search) ?? defaultPalette]);
    const h = query.get("heading"),
      b = query.get("body");
    if (h && Object.hasOwn(fonts, h)) setHeading(h as FontName);
    if (b && Object.hasOwn(fonts, b)) setBody(b as FontName);
    setElementRolesState(readElementRoles(window.location.search));
    setRolesReadyPath(window.location.pathname);
  }, [capture?.id, defaultPalette]);
  useEffect(() => {
    if (!storageReady || rolesReadyPath !== window.location.pathname) return;
    const url = new URL(window.location.href);
    url.searchParams.set("colors", new URLSearchParams(paletteQuery(palette)).get("colors")!);
    url.searchParams.set("heading", heading);
    url.searchParams.set("body", body);
    setElementRoles(url.searchParams, elementRoles);
    window.history.replaceState(null, "", url);
  }, [storageReady, palette, heading, body, elementRoles, rolesReadyPath]);
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
      const target = frameDocument?.querySelector(selection.selector);
      if (!target) return;
      const box = target.getBoundingClientRect();
      setSelection(current => current?.selector === selection.selector ? { ...current, bounds: { left: box.left, right: box.right, top: box.top, bottom: box.bottom } } : current);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", updatePosition);
    frameDocument?.addEventListener("pointerdown", close, true);
    frameDocument?.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
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
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (embedded && event.source === window.parent && event.origin === window.location.origin && event.data?.type === "hexmix-comparison-colors" && isPalette(event.data.palette)) {
        comparisonState.current = JSON.stringify([event.data.palette, event.data.heading, event.data.body]);
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
  }, [palette, heading, body, preview, defaultPalette, waitForPreview, capture?.id, router, embedded, comparisonToolbar, inspecting, elementRoles, selection?.path, selection?.selector]);
  useEffect(() => {
    if (embedded) window.parent.postMessage({ type: "hexmix-comparison-ready" }, window.location.origin);
  }, [embedded]);
  useEffect(() => {
    if (!comparisonToolbar) return;
    const signature = JSON.stringify([history[index], heading, body]);
    if (signature === comparisonState.current) return;
    comparisonState.current = signature;
    window.parent.postMessage({ type: 'hexmix-comparison-change', palette: history[index], heading, body }, window.location.origin);
  }, [comparisonToolbar, history, index, heading, body]);
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
    const timeout = setTimeout(() => setNotice(""), 4000);
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
      if (event.key === "Escape" && panel === "fonts") { close(); focusMobileTools(); }
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
  function randomize() {
    const next = randomPalette(isDarkPalette(palette));
    locked.forEach((role) => (next[role] = palette[role]));
    apply(next);
  }
  async function copy(text: string, message: string) {
    setNotice(await copyText(text, dialog.current?.open ? dialog.current : document.body) ? message : "Copy is not available in this browser.");
  }
  function startComparison() {
    if (comparisonToolbar) { window.parent.postMessage({ type: 'hexmix-comparison-options' }, window.location.origin); return; }
    const selected = previewCatalog.find(item => window.location.pathname === item.path || window.location.pathname.startsWith(item.path + '/'));
    const first = saved.find(item => samePalette(item.colors, palette));
    const second = saved.find(item => !samePalette(item.colors, palette));
    router.push(comparisonHref({ a: palette, b: second?.colors ?? (samePalette(palette, initialPalette) ? defaultDarkPalette : initialPalette), preview: selected?.id ?? 'avenlo', heading, body, nameA: first?.name ?? 'Palette A', nameB: second?.name ?? 'Palette B', mode: isDarkPalette(palette) ? 'dark' : 'light' }));
  }
  function share() {
    const url = new URL(window.location.href);
    url.search = paletteQuery(palette);
    url.searchParams.set("heading", heading);
    url.searchParams.set("body", body);
    setElementRoles(url.searchParams, elementRoles);
    void copy(url.toString(), "Palette link copied.");
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
  function focusMobileTools() {
    if (window.matchMedia("(max-width: 560px), (max-height: 500px) and (max-width: 1000px)").matches) toolsTrigger.current?.focus();
  }
  function closeFonts() { setPanel(null); focusMobileTools(); }
  function toggleInspector() { setInspecting(!inspecting); setSelection(null); setPanel(null); setActiveColor(null); }
  useEffect(() => { if (panel === "fonts") document.getElementById("heading-font")?.focus(); }, [panel]);
  function togglePanel(next: "fonts" | "saved") {
    setActiveColor(null);
    setPreviewPalette(null);
    setPanel(panel === next ? null : next);
  }
  function openExport() { setPanel(null); setExportOpen(true); }
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
        key={preview}
        ref={attachFrame}
        className={preview.startsWith("/dashboard-previews/") ? "website-frame dashboard-frame" : "website-frame"}
        src={preview}
        title="Page preview"
        data-preview-ready={!capture || readyPreview === preview}
        style={{ visibility: capture && readyPreview !== preview ? "hidden" : "visible" }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        onLoad={updateFrame}
      />}
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
            <SiteSwitcher palette={palette} heading={heading} body={body} elementRoles={elementRoles} onOpen={()=>{setPanel(null);setActiveColor(null);setPreviewPalette(null);setSelection(null);setInspecting(false);}}/>
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
            <div className="toolbar-actions">
              <Button variant="ghost" className="toolbar-secondary" aria-label="Compare palettes" onClick={startComparison}>Compare</Button>
              <IconButton
                className="icon-button"
                aria-label="Shuffle palette"
                onClick={randomize}
              >
                <Shuffle size={17} />
              </IconButton>
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Undo palette"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ArrowLeft size={17} />
              </IconButton>
              <IconButton
                className="icon-button toolbar-secondary"
                aria-label="Redo palette"
                disabled={index === history.length - 1}
                onClick={() => setIndex(index + 1)}
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
                notice={notice}
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
              <DropdownMenu modal={false} onOpenChange={open => { if (open) { setPanel(null); setActiveColor(null); setPreviewPalette(null); } }}>
                <DropdownMenuTrigger asChild><IconButton ref={toolsTrigger} className="icon-button toolbar-more" aria-label="More tools"><MoreHorizontal size={17} /><span className="mobile-tools-label">Tools</span></IconButton></DropdownMenuTrigger>
                <DropdownMenuContent className="palette-menu" side="top" sideOffset={Math.max(12, toolbarHeight - 32)} align="end" aria-label="More tools" onCloseAutoFocus={event => { if (exportOpen || collapsed || panel) event.preventDefault(); }}>
                  <DropdownMenuGroup className="mobile-tools">
                    <DropdownMenuItem onSelect={randomize}>Shuffle palette</DropdownMenuItem>
                    <DropdownMenuItem onSelect={toggleTheme}>{dark ? "Use light palette" : "Use dark palette"}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => togglePanel("fonts")}>Fonts</DropdownMenuItem>
                    <DropdownMenuItem disabled={showCapture || Boolean(children)} onSelect={toggleInspector}>{inspecting ? "Stop selecting elements" : "Select an element"}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => togglePanel("saved")}>Palettes</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </DropdownMenuGroup>
                  <DropdownMenuItem disabled={index === 0} onSelect={() => setIndex(index - 1)}>Undo palette</DropdownMenuItem>
                  <DropdownMenuItem disabled={index === history.length - 1} onSelect={() => setIndex(index + 1)}>Redo palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={startComparison}>Compare palettes</DropdownMenuItem>
                  <DropdownMenuItem onSelect={share}>Share palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={openExport}>Export palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={reset}>Reset palette and fonts</DropdownMenuItem>
                  <DropdownMenuItem onSelect={hideToolbar}>Hide color toolbar</DropdownMenuItem>
                  <DropdownMenuGroup className="mobile-tools">
                    <DropdownMenuSub>
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
          <Check size={15} />
          {notice}
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
            <h2>Export</h2>
            <IconButton
              className="icon-button"
              aria-label="Close export"
              onClick={() => setExportOpen(false)}
            >
              <X size={18} />
            </IconButton>
          </div>
          <label className="export-format">Format
            <select aria-label="Format" value={exportFormat} onChange={event => setExportFormat(event.target.value as PaletteExportFormat)}>
              {Object.entries(paletteExportFormats).map(([value, format]) => <option value={value} key={value}>{format.label}</option>)}
            </select>
          </label>
          {exportFormat === "tailwind" && <p className="export-help">Add this block to your Tailwind 4 stylesheet.</p>}
          <pre role="region" tabIndex={0} aria-label={`${paletteExportFormats[exportFormat].label} export`}><code>{paletteExport(exportFormat, palette, fonts[heading], fonts[body])}</code></pre>
          <div className="dialog-actions">
            <button
              onClick={() =>
                void copy(
                  paletteExport(exportFormat, palette, fonts[heading], fonts[body]),
                  `${paletteExportFormats[exportFormat].label} copied.`,
                )
              }
            >
              <Copy size={15} /> Copy {paletteExportFormats[exportFormat].label}
            </button>
            <button className="button-dark" onClick={download}>
              <ArrowDownToLine size={15} /> Download {paletteExportFormats[exportFormat].label}
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
