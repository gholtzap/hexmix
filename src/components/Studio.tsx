"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
import IconButton from "./IconButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
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
  paletteExport,
  paletteExportFormats,
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

type StudioProps = { preview?: string; defaultPalette?: Palette; waitForPreview?: boolean; capture?: { id: string; name: string } };

export default function Studio({ preview = "/preview/index.html", defaultPalette = defaultDarkPalette, waitForPreview = false, capture }: StudioProps) {
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
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<PaletteExportFormat>("css");
  const { saved, remove, storageReady, save, rename } = useSavedPalettes(setNotice);
  const frame = useRef<HTMLIFrameElement>(null);
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
    setHistory([readPalette(window.location.search) ?? defaultPalette]);
    const h = query.get("heading"),
      b = query.get("body");
    if (h && Object.hasOwn(fonts, h)) setHeading(h as FontName);
    if (b && Object.hasOwn(fonts, b)) setBody(b as FontName);
  }, [capture?.id, defaultPalette]);
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
    if (!root.ownerDocument.querySelector('link[data-preview-fonts]')) {
      const link = root.ownerDocument.createElement("link");
      link.rel = "stylesheet";
      link.href = "/fonts/fonts.css";
      link.dataset.previewFonts = "true";
      root.ownerDocument.head.append(link);
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
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(preview, window.location.origin).origin) return;
      if (event.data?.type === "color-editor-ready") updateFrame();
      if (event.data?.type === "color-editor-painted" && event.data.url === new URL(preview, window.location.origin).href && event.data.palette === roles.map(role => palette[role]).join("|")) setReadyPreview(preview);
      if (event.data?.type === "preview-toggle-theme") apply(randomPalette(!isDarkPalette(palette)));
      if (event.data?.type === "preview-navigate" && capture && typeof event.data.path === "string" && /^\/(?!\/)[a-zA-Z0-9%/_-]*$/.test(event.data.path)) {
        const query = new URLSearchParams(paletteQuery(palette));
        query.set("heading", heading); query.set("body", body);
        const site=previewCatalog.find(preview=>preview.id===capture.id);
        if(site)router.push(`${site.path}${event.data.path === "/" ? "" : event.data.path.replaceAll(capture.id,site.path.slice(1))}?${query}`, { scroll: false });
      }
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [palette, heading, body, preview, defaultPalette, waitForPreview, capture?.id, router]);
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
      if (event.key === "Escape" && panel === "fonts") close();
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
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      (dialog.current?.open ? dialog.current : document.body).append(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setNotice(copied ? message : "Copy is not available in this browser.");
    }
  }
  function share() {
    const url = new URL(window.location.href);
    url.search = paletteQuery(palette);
    url.searchParams.set("heading", heading);
    url.searchParams.set("body", body);
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
  return (
    <main className={collapsed ? "studio studio-collapsed" : "studio"} data-app-ready={storageReady || undefined} style={{ visibility: storageReady ? "visible" : "hidden", background: palette.background, "--toolbar-height": `${toolbarHeight}px` } as CSSProperties}>
      {showCapture && capture && capturePreview ? <div className="website-frame remote-preview" data-preview-capture={capture.id}>
        <a className="remote-preview-image" href={previewHref(`${capturePreview.path}/overview`,palette,heading,body)} aria-label={`Explore ${capture.name} pages`}><PreviewThumbnail id={capture.id} palette={palette} /></a>
        <div className="remote-preview-copy"><h1>{capture.name}</h1><nav className="remote-preview-links" aria-label={`${capture.name} pages`}>{[["overview","Explore pages"],["demo","Try the product"],["contact","Plan a session"]].map(([path,label])=><a key={path} href={previewHref(`${capturePreview.path}/${path}`,palette,heading,body)}>{label}</a>)}</nav></div>
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
      {collapsed ? (
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
                  onClick={() => setPanel(null)}
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
            <SiteSwitcher palette={palette} heading={heading} body={body} onOpen={()=>{setPanel(null);setActiveColor(null);setPreviewPalette(null);}}/>
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
                      <span>{role === "background" ? <>Back<wbr />ground</> : role === "secondary" ? <>Second<wbr />ary</> : role === "primary" ? <>Pri<wbr />mary</> : role[0].toUpperCase() + role.slice(1)}</span>
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
                onClick={() =>
                  apply({
                    ...palette,
                    text: palette.background,
                    background: palette.text,
                  })
                }
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
              <PalettePanel
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
                onApply={apply}
                onSave={(name) => save(palette, name)} onRename={rename}
                onRemove={remove}
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
                <DropdownMenuTrigger asChild><IconButton className="icon-button toolbar-more" aria-label="More tools"><MoreHorizontal size={17} /></IconButton></DropdownMenuTrigger>
                <DropdownMenuContent className="palette-menu" side="top" sideOffset={Math.max(12, toolbarHeight - 32)} align="end" aria-label="More tools" onCloseAutoFocus={event => { if (exportOpen || collapsed) event.preventDefault(); }}>
                  <DropdownMenuItem disabled={index === 0} onSelect={() => setIndex(index - 1)}>Undo palette</DropdownMenuItem>
                  <DropdownMenuItem disabled={index === history.length - 1} onSelect={() => setIndex(index + 1)}>Redo palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={share}>Share palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={openExport}>Export palette</DropdownMenuItem>
                  <DropdownMenuItem onSelect={reset}>Reset palette and fonts</DropdownMenuItem>
                  <DropdownMenuItem onSelect={hideToolbar}>Hide color toolbar</DropdownMenuItem>
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
      )}
      {notice && (
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
