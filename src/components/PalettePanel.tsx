"use client";

import { useCallback, useMemo, useRef, useState, type ReactElement, type RefObject } from "react";
import { Check, Heart, Plus, X } from "lucide-react";
import { isDarkPalette, matchesPalette, presetForTheme, presets, roles, type Palette, type SavedPalette } from "@/lib/palette";
import { samePalette } from "@/lib/palette";
import PreviewThumbnail from "./PreviewThumbnail";
import IconButton from "./IconButton";
import { ColorPickerSwatch } from "./reui/color-picker";
import { Button } from "./ui/button";
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
  notice?: string;
  restoreFocus: boolean;
  returnFocus?: RefObject<HTMLButtonElement | null>;
};

export default function PalettePanel({
  trigger, initialBrowse = false, initialTab = "presets", open, anchor, palette, saved, previewId = "workspace", onOpenChange, onApply, onSave, onRename, onRemove, restoreFocus, returnFocus, notice,
}: Props) {
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null);
  const [nameError, setNameError] = useState("");
  const [tab, setTab] = useState<string | number>(initialTab);
  const [browse, setBrowse] = useState(initialBrowse);
  const [filters, setFilters] = useState({ query: "", color: "", mode: "", style: "" });
  const [limit, setLimit] = useState(24);
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
          else if (returnFocus?.current && window.matchMedia("(max-width: 560px), (max-height: 500px) and (max-width: 1000px)").matches) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <div className="palette-panel-header">
          <h2>Palettes</h2>
          <Button
            variant="outline"
            className="panel-save"
            onClick={() => {
              let number = saved.length + 1;
              while (saved.some((item) => item.name === `My palette ${number}`)) number++;
              setEditing({ name: `My palette ${number}` });
              setNameError("");
            }}
          >
            <Plus size={14} aria-hidden="true" /> Save palette
          </Button>
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
            <Button type="button" variant="outline" onClick={() => { setEditing(null); savedTab.current?.focus(); }}>Cancel</Button>
            <Button type="submit" variant="outline">{editing.id ? "Save name" : "Save"}</Button>
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
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="palette-more" aria-label={`More actions for ${item.name}`}>
                                  More
                                </Button>
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
                  {items.length > 0 && <Button variant="outline" onClick={() => {
                    setFilters({ query: "", color: "", mode: "", style: "" }); setLimit(24);
                  }}>Clear filters</Button>}
                </div>
              )}
              {browse && results.length > limit && <Button variant="outline" className="palette-load" onClick={() => setLimit((current) => current + 24)}>Load more</Button>}
            </TabsContent>
          ))}
        </Tabs>
        <Button variant="outline" className="palette-browse-toggle" onClick={() => { setBrowse(!browse); scroll.current = {}; }}>
          {browse ? "Quick picks" : "Browse all palettes"}
        </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
