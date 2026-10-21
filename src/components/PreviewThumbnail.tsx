"use client";

import { Fragment, useId } from "react";
import { defaultDarkPalette, foregroundForSurface, initialPalette, isDarkPalette, roles, samePalette, type Palette } from "@/lib/palette";

export default function PreviewThumbnail({ id, palette }: { id: string; palette: Palette }) {
  const filter = `capture-${useId().replace(/:/g, "")}`;
  const colors = { ...palette, text: foregroundForSurface(palette.text, palette.background) };
  const directory = `/preview-captures/${id}/${isDarkPalette(palette) ? "dark" : "light"}`;
  const originalPalette = samePalette(palette, isDarkPalette(palette) ? defaultDarkPalette : initialPalette);
  return <svg className="home-thumbnail" viewBox="0 0 1200 750" aria-hidden="true" focusable="false" data-capture={id}>
    {!originalPalette && <defs>
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
    <image href={`${directory}/original.webp`} width="1200" height="750" />
    {!originalPalette && <rect width="1200" height="750" filter={`url(#${filter})`} />}
  </svg>;
}
