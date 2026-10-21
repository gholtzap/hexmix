"use client";
import { useId, type ComponentPropsWithRef } from "react";
export default function IconButton({
  children,
  ...props
}: ComponentPropsWithRef<"button">) {
  const id = useId();
  return (
    <button {...props} aria-describedby={id}>
      {children}
      <span className="control-tooltip" role="tooltip" id={id}>
        {props["aria-label"]}
      </span>
    </button>
  );
}
