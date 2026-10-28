"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { useId, type ComponentPropsWithRef } from "react";

export default function FloatingIconButton({ children, ...props }: ComponentPropsWithRef<"button">) {
  const id = useId();
  return <Tooltip.Root>
    <Tooltip.Trigger aria-describedby={id} delay={0} closeOnClick={false} render={<button {...props}>{children}</button>} />
    <Tooltip.Portal keepMounted><Tooltip.Positioner side="bottom" sideOffset={8} className="floating-tooltip-positioner"><Tooltip.Popup role="tooltip" id={id} className="floating-tooltip">{props["aria-label"]}</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal>
  </Tooltip.Root>;
}
