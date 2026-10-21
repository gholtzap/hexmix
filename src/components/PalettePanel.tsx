"use client";

import { useCallback, useMemo, useRef, type ReactElement, type RefObject } from "react";
import { useLinkState } from "@/hooks/useLinkState";
import { oneOf, nullable, stringRecord } from "@/lib/link-state";
import { Check, Heart, Plus, Share2, X, Copy, MoreHorizontal, FilterX, ChevronDown, LayoutGrid, List, Undo2 } from "lucide-react";
import { isDarkPalette, matchesPalette, presetForTheme, presets, roles, type Palette, type SavedPalette } from "@/lib/palette";
import { samePalette } from "@/lib/palette";
import PreviewThumbnail from "./PreviewThumbnail";
import IconButton from "./IconButton";
import { ColorPickerSwatch } from "./reui/color-picker";
import { Card } from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type Props = {
  trigger?: ReactElement;
  initialBrowse?: boolean;
  initialTab?: "presets" | "saved";
  open: boolean;
  anchor: HTMLElement | null;
  palette: Palette;
  saved: SavedPalette[];
  previewId?: string;
  onOpenChange: (open: boolean) => void;
  onApply: (palette: Palette, item?: SavedPalette) => void;
  onSave: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onUndoRemove?: () => void;
  onShare?: () => void;
  onCopy: (item: SavedPalette) => void;
  notice?: string;
  restoreFocus: boolean;
  returnFocus?: RefObject<HTMLButtonElement | null>;
};

export default function PalettePanel({
  trigger, initialBrowse = false, initialTab = "presets", open, anchor, palette, saved, previewId = "workspace", onOpenChange, onApply, onSave, onRename, onRemove, onUndoRemove, restoreFocus, returnFocus, notice, onCopy, onShare,
}: Props) {
  const [editing, setEditing] = useLinkState<{ id?: string; name: string } | null>("PalettePanel.PalettePanel.editing", null, { validate: nullable(value => stringRecord(value) && typeof value.name === "string"), private: true });
  const [nameError, setNameError] = useLinkState("PalettePanel.PalettePanel.nameError", "");
  const [tab, setTab] = useLinkState<string | number>("PalettePanel.PalettePanel.tab", initialTab, { validate: oneOf("presets", "saved") });
  const [browse, setBrowse] = useLinkState("PalettePanel.PalettePanel.browse", initialBrowse);
  const [filters, setFilters] = useLinkState("PalettePanel.PalettePanel.filters", { query: "", color: "", mode: "", style: "" });
  const [limit, setLimit] = useLinkState("PalettePanel.PalettePanel.limit", 24, { validate: value => Number.isSafeInteger(value) && Number(value) >= 24 && Number(value) <= 10008 });
  const scroll = useRef<Record<string, number>>({});
  const restoreBodyScroll = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollTop = scroll.current[String(tab)] ?? 0;
  }, [tab]);
  const restoreListScroll = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollTop = scroll.current[node.dataset.collection ?? ""] ?? 0;
  }, []);
  const dark = isDarkPalette(palette);
  const collections = useMemo(() => [
    { value: "presets", items: presets.map(item => presetForTheme(item, dark)) },
    { value: "saved", items: saved },
  ].map((collection) => ({ ...collection, results: browse ? collection.items.filter((item) => matchesPalette(item, filters)) : collection.items })), [saved, browse, filters, dark]);
  function changeFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setLimit(24);
    scroll.current = {};
  }
  const savedTab = useRef<HTMLButtonElement>(null);
  const returnToSaved = useRef(false);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchor && <PopoverAnchor virtualRef={{ current: anchor }} />}
      <PopoverTrigger asChild>
        {trigger ?? <IconButton className="icon-button" aria-label="Palettes" aria-haspopup={undefined}>
          <Heart size={17} />
        </IconButton>}
      </PopoverTrigger>
      <PopoverContent
        className={`palette-panel saved-panel ${browse ? "palette-browser" : ""}`}
        side="top"
        sideOffset={12}
        align="end"
        aria-label="Palettes"
        onCloseAutoFocus={(event) => {
          if (!restoreFocus) event.preventDefault();
          else if (returnFocus?.current?.getClientRects().length && !anchor?.querySelector('button[aria-label="Palettes"]')?.getClientRects().length) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <div className="palette-panel-header">
          <h2>Palettes</h2>
          {onUndoRemove && <IconButton className="icon-button" aria-label="Undo palette removal" onClick={onUndoRemove}><Undo2 size={17}/></IconButton>}
          <IconButton
            aria-label="Save palette"
            className="icon-button panel-save"
            onClick={() => {
              let number = saved.length + 1;
              while (saved.some((item) => item.name === `My palette ${number}`)) number++;
              setEditing({ name: `My palette ${number}` });
              setNameError("");
            }}
          >
            <Plus size={17} aria-hidden="true" />
          </IconButton>
          {onShare && <IconButton className="icon-button" aria-label="Share view" onClick={onShare}><Share2 size={17}/></IconButton>}
          <IconButton className="icon-button" aria-label="Close palettes" onClick={() => onOpenChange(false)}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="palette-panel-body"
          ref={restoreBodyScroll}
          onScroll={event => { scroll.current[String(tab)] = event.currentTarget.scrollTop; }}>
        {notice && <p className="palette-notice" role="status">{notice}</p>}
        {editing && <form className="palette-name-form" noValidate onSubmit={(event) => {
          event.preventDefault();
          const name = editing.name.trim();
          if (!name) { setNameError("Enter a palette name."); return; }
          if (name.length > 80) { setNameError("Use 80 characters or fewer."); return; }
          if (editing.id) onRename(editing.id, name);
          else onSave(name);
          setEditing(null);
          setTab("saved");
          setFilters({ query: "", color: "", mode: "", style: "" });
          setLimit(24);
          requestAnimationFrame(() => savedTab.current?.focus());
        }}>
          <label htmlFor="palette-name">Palette name</label>
          <input id="palette-name" autoFocus maxLength={80} value={editing.name}
            aria-invalid={!!nameError} aria-describedby={nameError ? "palette-name-error" : undefined}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => { setEditing({ ...editing, name: event.target.value }); setNameError(""); }} />
          {nameError && <p id="palette-name-error" role="alert">{nameError}</p>}
          <div className="palette-name-actions">
            <IconButton type="button" className="icon-button" aria-label="Cancel palette name" onClick={() => { setEditing(null); savedTab.current?.focus(); }}><X size={17}/></IconButton>
            <IconButton type="submit" className="icon-button" aria-label={editing.id ? "Save name" : "Save"}><Check size={17}/></IconButton>
          </div>
        </form>}
        {browse && <div className="palette-filters">
          <label className="palette-search">Search palettes
            <input type="search" value={filters.query} onChange={(event) => changeFilter("query", event.target.value)} />
          </label>
          <div className="palette-filter-row">
            {([
              ["color", "Color", ["red", "orange", "yellow", "green", "blue", "purple", "pink", "neutral"]],
              ["mode", "Theme", ["light", "dark"]],
              ["style", "Style", ["muted", "pastel", "bold"]],
            ] as const).map(([key, label, values]) => <label key={key}>{label}
              <select aria-label={label} value={filters[key]} onChange={(event) => changeFilter(key, event.target.value)}>
                <option value="">All</option>
                {values.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
              </select>
            </label>)}
          </div>
        </div>}
        <Tabs value={tab} onValueChange={setTab} className="palette-tabs">
          <TabsList activateOnFocus aria-label="Palette collections" className="palette-tab-list">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="saved" ref={savedTab}>Saved</TabsTrigger>
          </TabsList>
          {collections.map(({ value, items, results }) => (
            <TabsContent value={value} key={value}
              data-collection={value} ref={restoreListScroll}
              onScroll={(event) => { scroll.current[value] = event.currentTarget.scrollTop; }}>
              {browse && <p className="palette-result-count" role="status">{results.length} {results.length === 1 ? "palette" : "palettes"}</p>}
              {results.length ? (
                <div className="palette-grid">
                  {results.slice(0, browse ? limit : 6).map((item) => {
                    const selected = samePalette(palette, item.colors);
                    return (
                      <Card
                        className={`palette-card ${value === "saved" ? "saved-row" : ""}`}
                        data-selected={selected || undefined}
                        key={item.id}
                      >
                        <div className="palette-apply">
                          <input
                            type="button"
                            className="palette-select"
                            value=""
                            aria-label={`Apply ${item.name}`}
                            aria-pressed={selected}
                            onClick={() => onApply(item.colors, item)}
                          />
                          {value === "saved" && <PreviewThumbnail id={previewId} palette={item.colors} />}
                          <span className="palette-preview" aria-hidden="true">
                            {roles.map((role) => (
                              <ColorPickerSwatch key={role} color={item.colors[role]} />
                            ))}
                          </span>
                          <span className="palette-card-caption">
                            <span>{item.name}</span>
                            {selected && <Check size={14} aria-hidden="true" />}
                          </span>
                        </div>
                        {value === "saved" && (
                          <div className="palette-card-actions">
                            <IconButton floatingTooltip className="icon-button" aria-label={`Copy ${item.name}`} onClick={()=>onCopy(item)}><Copy size={17}/></IconButton>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <IconButton floatingTooltip className="icon-button palette-more" aria-label={`More actions for ${item.name}`}><MoreHorizontal size={17}/></IconButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="palette-menu" side="top" sideOffset={8} align="end"
                                onCloseAutoFocus={(event) => {
                                  if (!returnToSaved.current) return;
                                  event.preventDefault();
                                  returnToSaved.current = false;
                                  savedTab.current?.focus();
                                }}>
                                <DropdownMenuItem onSelect={() => {
                                  setEditing({ id: item.id, name: item.name });
                                  setNameError("");
                                }}>Rename palette</DropdownMenuItem>
                                <DropdownMenuItem className="palette-remove" onSelect={() => {
                                  returnToSaved.current = true;
                                  onRemove(item.id);
                                }}>
                                  Remove palette
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="palette-empty">
                  <p>{items.length ? "No palettes match your search." : "No saved palettes yet."}</p>
                  {items.length > 0 && <IconButton className="icon-button" aria-label="Clear filters" onClick={() => {
                    setFilters({ query: "", color: "", mode: "", style: "" }); setLimit(24);
                  }}><FilterX size={17}/></IconButton>}
                </div>
              )}
              {browse && results.length > limit && <IconButton className="icon-button palette-load" aria-label="Load more" onClick={() => setLimit((current) => current + 24)}><ChevronDown size={17}/></IconButton>}
            </TabsContent>
          ))}
        </Tabs>
        <IconButton className="icon-button palette-browse-toggle" aria-label={browse ? "Quick picks" : "Browse all palettes"} onClick={() => { setBrowse(!browse); scroll.current = {}; }}>{browse?<List size={17}/>:<LayoutGrid size={17}/>}</IconButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
