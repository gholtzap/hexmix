"use client";
import { useId, type ButtonHTMLAttributes } from "react";
export default function IconButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
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
