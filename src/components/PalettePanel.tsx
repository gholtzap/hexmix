"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import IconButton from "./IconButton";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./ui/popover";
import type { Props } from "./PalettePanelContent";

const PanelContent = lazy(() => import("./PalettePanelContent"));
export const preloadPalettePanel = () => { void import("./PalettePanelContent").catch(() => {}); };

export default function PalettePanel(props: Props) {
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
  return <Popover open={props.open} onOpenChange={props.onOpenChange}>
    {props.anchor && <PopoverAnchor virtualRef={{ current: props.anchor }} />}
    <PopoverTrigger asChild onPointerEnter={preloadPalettePanel} onFocus={preloadPalettePanel}>
      {props.trigger ?? <IconButton className="icon-button" aria-label="Palettes" aria-haspopup={undefined}><Heart size={17} /></IconButton>}
    </PopoverTrigger>
    {(props.open || hasOpened) && <Suspense fallback={
      <PopoverContent className="palette-panel saved-panel" side="top" sideOffset={12} align="end" aria-label="Palettes" onCloseAutoFocus={onCloseAutoFocus}>
        <p className="palette-notice" role="status">Loading palettes…</p>
      </PopoverContent>
    }><PanelContent {...props} onCloseAutoFocus={onCloseAutoFocus} /></Suspense>}
  </Popover>;
}
