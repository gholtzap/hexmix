"use client";

import { useEffect, useState } from "react";
import { Heart, RotateCcw, X } from "lucide-react";
import { useDeferredComponent } from "@/hooks/useDeferredComponent";
import IconButton from "./IconButton";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./ui/popover";
import type { Props } from "./PalettePanelContent";

const load = () => import("./PalettePanelContent");
export const preloadPalettePanel = () => { void load().catch(() => {}); };

export default function PalettePanel(props: Props) {
  const { Component: PanelContent, error, loading, request } = useDeferredComponent(load);
  const { anchor, restoreFocus, returnFocus } = props;
  const onCloseAutoFocus = (event: Event) => {
    // Replacing the loading content must not move focus outside an open panel.
    if (props.open || !restoreFocus) event.preventDefault();
    else if (returnFocus?.current?.getClientRects().length && !anchor?.querySelector('button[aria-label="Palettes"]')?.getClientRects().length) {
      event.preventDefault();
      returnFocus.current.focus();
    }
  };
  const [hasOpened, setHasOpened] = useState(props.open);
  useEffect(() => { if (props.open) setHasOpened(true); }, [props.open]);
  useEffect(() => { if (props.open) request(); }, [props.open, request]);
  return <Popover open={props.open} onOpenChange={props.onOpenChange}>
    {props.anchor && <PopoverAnchor virtualRef={{ current: props.anchor }} />}
    <PopoverTrigger asChild onPointerEnter={preloadPalettePanel} onFocus={preloadPalettePanel}>
      {props.trigger ?? <IconButton className="icon-button" aria-label="Palettes" aria-haspopup={undefined}><Heart size={17} /></IconButton>}
    </PopoverTrigger>
    {(props.open || hasOpened) && (PanelContent ? <PanelContent {...props} onCloseAutoFocus={onCloseAutoFocus} /> :
      <PopoverContent className="palette-panel saved-panel" side="top" sideOffset={12} align="end" aria-label="Palettes" onCloseAutoFocus={onCloseAutoFocus}>
        <div className="palette-panel-header"><h2>Palettes</h2>{error && <IconButton className="icon-button" aria-label="Retry loading palettes" aria-busy={loading} onClick={request}><RotateCcw size={16} /></IconButton>}<IconButton className="icon-button" aria-label="Close palettes" onClick={() => props.onOpenChange(false)}><X size={16} /></IconButton></div>
        <p className="palette-notice" role={error && !loading ? "alert" : "status"}>{error && !loading ? "Palettes could not be loaded." : "Loading palettes…"}</p>
      </PopoverContent>
    )}
  </Popover>;
}
