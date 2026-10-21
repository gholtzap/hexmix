"use client";

import { useEffect } from "react";

export function useVisibleViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height ?? innerHeight;
      root.style.setProperty("--visible-height", `${height}px`);
      root.style.setProperty("--keyboard-inset", `${Math.max(0, innerHeight - height - (viewport?.offsetTop ?? 0))}px`);
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);
}
