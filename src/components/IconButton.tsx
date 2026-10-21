"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { useId, type ComponentPropsWithRef } from "react";
export default function IconButton({
  children,
  floatingTooltip = false,
  ...props
}: ComponentPropsWithRef<"button"> & { floatingTooltip?: boolean }) {
  const id = useId();
  if (floatingTooltip) return <Tooltip.Root>
    <Tooltip.Trigger aria-describedby={id} delay={0} closeOnClick={false} render={<button {...props}>{children}</button>} />
    <Tooltip.Portal keepMounted><Tooltip.Positioner side="bottom" sideOffset={8} className="floating-tooltip-positioner"><Tooltip.Popup role="tooltip" id={id} className="floating-tooltip">{props["aria-label"]}</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal>
  </Tooltip.Root>;
  return (
    <button {...props} aria-describedby={id}>
      {children}
      <span className="control-tooltip" role="tooltip" id={id}>
        {props["aria-label"]}
      </span>
    </button>
  );
}
