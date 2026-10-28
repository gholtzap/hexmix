"use client";

import { useEffect, useLayoutEffect, useRef, type ComponentProps } from "react";
import { RotateCcw } from "lucide-react";
import { useDeferredComponent } from "@/hooks/useDeferredComponent";
import type SiteSwitcherComponent from "./SiteSwitcher";
import IconButton from "./IconButton";

const load = () => import("./SiteSwitcher");

export default function DeferredSiteSwitcher(props: ComponentProps<typeof SiteSwitcherComponent>) {
  const { Component: SiteSwitcher, error, loading, request } = useDeferredComponent(load);
  const restoreFocus = useRef(false);
  useEffect(request, [request]);
  useLayoutEffect(() => {
    if (SiteSwitcher && restoreFocus.current) {
      if (document.activeElement === document.body) document.querySelector<HTMLButtonElement>('.preview-site-switcher .site-switcher-trigger')?.focus();
      restoreFocus.current = false;
    }
  }, [SiteSwitcher]);
  if (SiteSwitcher) return <SiteSwitcher {...props} />;
  if (!error) return null;
  return <IconButton className="icon-button site-switcher-trigger" aria-label="Retry loading site menu" aria-busy={loading} onClick={event => { restoreFocus.current = event.currentTarget === document.activeElement; request(); }}><RotateCcw size={16} /></IconButton>;
}
