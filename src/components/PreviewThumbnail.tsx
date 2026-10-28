"use client";

import { Fragment, memo, useEffect, useId, useRef, useState } from "react";
import { preload } from "react-dom";
import { defaultDarkPalette, foregroundForSurface, initialPalette, isDarkPalette, roles, samePalette, type Palette } from "@/lib/palette";

export default memo(function PreviewThumbnail({ id, palette, eager = false }: { id: string; palette: Palette; eager?: boolean }) {
  const element = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loadedDirectory, setLoadedDirectory] = useState<string | null>(null);
  const filter = `capture-${useId().replace(/:/g, "")}`;
  const colors = { ...palette, text: foregroundForSurface(palette.text, palette.background) };
  const directory = `/preview-captures/${id}/${isDarkPalette(palette) ? "dark" : "light"}`;
  // Mobile thumbnails are larger paint candidates than the page heading.
  if (eager) preload(`${directory}/original.webp`, { as: "image", fetchPriority: "high", media: "(max-width: 600px)" });
  const loaded = loadedDirectory === directory;
  const originalPalette = samePalette(palette, isDarkPalette(palette) ? defaultDarkPalette : initialPalette);
  const recolor = !originalPalette && loaded;
  useEffect(() => {
    if (visible) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "100px" });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let current = true;
    const image = new Image();
    image.src = `${directory}/original.webp`;
    image.decode().then(() => { if (current) setLoadedDirectory(directory); }, () => { if (current) setLoadedDirectory(null); });
    return () => { current = false; };
  }, [directory, visible]);
  return <svg ref={element} className="home-thumbnail" viewBox="0 0 1200 750" aria-hidden="true" focusable="false" data-capture={id}>
    <g className="thumbnail-placeholder">
      <rect width="1200" height="750" fill={palette.background} />
      <rect width="1200" height="80" fill={palette.secondary} />
      <circle cx="48" cy="40" r="17" fill={palette.primary} />
      <path d="M84 40h160m615 0h70m25 0h70m25 0h70" stroke={palette.text} strokeWidth="13" strokeLinecap="round" opacity=".25" />
      <rect x="80" y="230" width="460" height="42" rx="12" fill={palette.text} opacity=".2" />
      <rect x="80" y="295" width="350" height="26" rx="9" fill={palette.text} opacity=".13" />
      <rect x="80" y="375" width="230" height="62" rx="14" fill={palette.primary} />
      <rect x="680" y="185" width="435" height="410" rx="24" fill={palette.secondary} />
      <path d="M730 250h235m-235 55h320m-320 55h270" stroke={palette.text} strokeWidth="18" strokeLinecap="round" opacity=".12" />
    </g>
    {recolor && <defs>
      <filter id={filter} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={`${directory}/fixed.webp`} result="fixed" />
        {roles.map((role, index) => <Fragment key={role}>
          <feImage href={`${directory}/${role}.webp`} result={`${role}-mask`} />
          <feFlood floodColor={colors[role]} result={`${role}-color`} />
          <feComposite in={`${role}-color`} in2={`${role}-mask`} operator="in" result={`${role}-tint`} />
          <feComposite in={index ? `${roles[index - 1]}-sum` : "fixed"} in2={`${role}-tint`} operator="arithmetic" k2="1" k3="1" result={`${role}-sum`} />
        </Fragment>)}
      </filter>
    </defs>}
    <image href={visible ? `${directory}/original.webp` : undefined} width="1200" height="750" opacity={loaded || originalPalette ? 1 : 0} />
    {recolor && <rect width="1200" height="750" filter={`url(#${filter})`} />}
  </svg>;
});
