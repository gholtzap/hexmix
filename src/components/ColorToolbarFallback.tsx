"use client";

import { LockKeyhole, RotateCcw, X } from "lucide-react";
import { useId, useRef } from "react";
import { contrast, roles, type Palette, type Role } from "@/lib/palette";
import IconButton from "./IconButton";
import { Button } from "./ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

const preload = () => { void import("./ColorToolbar").catch(() => {}); };

export default function ColorToolbarFallback({ palette, locked, activeColor, toolbarElement, onOpen, onClose, onCopy, error, loading, onRetry }: {
  palette: Palette; locked: Role[]; activeColor: Role | null; toolbarElement: HTMLElement | null;
  onOpen: (role: Role) => void; onClose: () => void; onCopy: (color: string) => void;
  error: boolean; loading: boolean; onRetry: () => void;
}) {
  const swatchTooltip = useId();
  const lastActive = useRef(activeColor);
  const restoreFocus = useRef(false);
  if (activeColor) lastActive.current = activeColor;
  return <div className="toolbar-colors">
    {roles.map(role => <div className="toolbar-color" key={role}>
      <Button variant="outline" className="color-trigger" data-slot="color-picker-trigger" aria-describedby={`${swatchTooltip}-${role}`} aria-label={`${role[0].toUpperCase() + role.slice(1)} color`} aria-haspopup="dialog" aria-expanded={activeColor === role} onPointerEnter={preload} onFocus={preload} onClick={() => onOpen(role)} onKeyDown={event => {
        if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "c" && !window.getSelection()?.toString()) { event.preventDefault(); onCopy(palette[role]); }
      }} style={{ background: palette[role], color: contrast(palette[role], "#ffffff") >= contrast(palette[role], "#000000") ? "#ffffff" : "#000000" }}>
        <span className="color-trigger-name">{role === "background" ? <><span className="background-name-wide">Background</span><span className="background-name-narrow" aria-hidden="true" /></> : role === "secondary" ? <>Secon<wbr />dary</> : role === "primary" ? <>Pri<wbr />mary</> : role === "accent" ? <>Acc<wbr />ent</> : role[0].toUpperCase() + role.slice(1)}</span>
        {locked.includes(role) && <LockKeyhole size={12} aria-hidden="true" />}<span className="control-tooltip swatch-tooltip" role="tooltip" id={`${swatchTooltip}-${role}`}>{role[0].toUpperCase() + role.slice(1)} color</span>
      </Button>
    </div>)}
    <Popover open={activeColor !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <PopoverAnchor virtualRef={{ current: toolbarElement }} />
      <PopoverContent className="color-picker-content" side="top" sideOffset={16} aria-label="Loading color picker" onEscapeKeyDown={() => { restoreFocus.current = true; }} onCloseAutoFocus={event => {
        event.preventDefault();
        const role = lastActive.current;
        if (restoreFocus.current && role) [...(toolbarElement?.querySelectorAll<HTMLButtonElement>(`[aria-label="${role[0].toUpperCase() + role.slice(1)} color"]`) ?? [])].find(button => button.getClientRects().length)?.focus();
        restoreFocus.current = false;
      }}>
        <div className="color-picker-heading"><h2>Color picker</h2>{error && <IconButton className="icon-button" aria-label="Retry loading color picker" aria-busy={loading} onClick={onRetry}><RotateCcw size={16} /></IconButton>}<IconButton className="icon-button" aria-label="Close color picker" onClick={() => { restoreFocus.current = true; onClose(); }}><X size={16} /></IconButton></div>
        <p className="palette-notice" role={error && !loading ? "alert" : "status"}>{error && !loading ? "Color picker could not be loaded." : "Loading color picker…"}</p>
      </PopoverContent>
    </Popover>
  </div>;
}
