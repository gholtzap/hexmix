"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { contrast, defaultDarkPalette, isDarkPalette, isPalette, randomPalette, readPalette, roles, type Palette, type Role } from "@/lib/palette";
import {fonts,fontPairs,type FontName} from "@/lib/fonts";
import { previewCatalog,previewHref } from "@/lib/preview-catalog";
import PalettePanel from "./PalettePanel";
import { useSavedPalettes } from "@/hooks/useSavedPalettes";
import PreviewThumbnail from "./PreviewThumbnail";
import { Button } from "./ui/button";
import {
  ColorPicker, ColorPickerArea, ColorPickerContent, ColorPickerFields,
  ColorPickerPanel, ColorPickerSlider, ColorPickerTrigger,
} from "./reui/color-picker";

export default function Home() {
  const [palette, setPalette] = useState<Palette>(defaultDarkPalette);
  const [palettesOpen, setPalettesOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const { saved, remove, save, rename } = useSavedPalettes(setNotice);
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState("All");
  const [heading,setHeading]=useState<FontName>("System"),[body,setBody]=useState<FontName>("System");
  const [active, setActive] = useState<Role | null>(null);
  useEffect(() => {
    setPalette(readPalette(window.location.search) ?? defaultDarkPalette);
    const query=new URLSearchParams(window.location.search);
    const h=query.get("heading"),b=query.get("body");
    if(h&&Object.hasOwn(fonts,h))setHeading(h as FontName);
    if(b&&Object.hasOwn(fonts,b))setBody(b as FontName);
    setReady(true);
  }, []);
  function update(next: Palette) {
    if (!isPalette(next)) return;
    setPalette(next);
    window.history.replaceState(null, "", previewHref("/",next,heading,body));
  }
  function selectFonts(nextHeading: FontName, nextBody: FontName) {
    setHeading(nextHeading);
    setBody(nextBody);
    window.history.replaceState(null, "", previewHref("/", palette, nextHeading, nextBody));
  }
  const href = (path: string) => previewHref(path,palette,heading,body);
  const dark = isDarkPalette(palette);

  return <main className="home-page" data-app-ready={ready || undefined}>
    <div className="home-shell">
      <header className="home-header"><Image src="/hexmix-logo.png" width={44} height={44} alt="" priority /><span className="home-wordmark">Hexmix</span><a className="icon-button home-github" href="https://github.com/gholtzap/hexmix" target="_blank" rel="noopener noreferrer" aria-label="View Hexmix on GitHub" aria-describedby="home-github-tooltip"><span className="home-github-icon" aria-hidden="true" /><span className="control-tooltip" role="tooltip" id="home-github-tooltip">View Hexmix on GitHub</span></a></header>
      <section className="home-start" aria-labelledby="home-title">
        <div className="home-intro">
          <h1 id="home-title" style={{ fontFamily: fonts[heading] }}>See your colors on real pages.</h1>
        </div>
      </section>
      <section className="home-gallery" aria-labelledby="preview-title">
        <div className="home-gallery-heading"><h2 id="preview-title">Previews</h2>
          <div className="home-categories" role="group" aria-label="Preview categories">
            {["All", "Homepages", "Dashboards"].map((value) => <Button key={value} variant="ghost" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</Button>)}
          </div>
        </div>
        <div className="home-preview-grid">
          {previewCatalog.filter((preview) => category === "All" || category === preview.category).map((preview) => <div className="home-preview-card" key={preview.path}>
            <Link className="home-preview-link" href={href(preview.path)} prefetch={false}>
              <PreviewThumbnail id={preview.id} palette={palette} />
              <div className="home-preview-caption"><h3>{preview.name}</h3></div>
            </Link>
          </div>)}
        </div>
      </section>
      <section className="home-palette" aria-labelledby="colors-title">
          <div className="home-palette-heading"><h2 id="colors-title">Colors</h2><div className="home-palette-actions">
            <PalettePanel open={palettesOpen} anchor={null} palette={palette} saved={saved}
              initialBrowse trigger={<Button variant="outline" aria-haspopup={undefined}>Browse palettes</Button>}
              onOpenChange={(open) => { setPalettesOpen(open); if (open) setActive(null); }}
              onApply={update} onSave={(name) => save(palette, name)} onRename={rename}
              onRemove={remove} restoreFocus />
            <Button variant="outline" onClick={() => update(randomPalette(dark))}>Random</Button>
            <Button variant="outline" onClick={() => update({ ...palette, text: palette.background, background: palette.text })}>{dark ? "Use light palette" : "Use dark palette"}</Button>
          </div></div>
          {notice && <p role="status">{notice}</p>}
          <div className="home-color-grid">
            {roles.map((role) => {
              const label = role[0].toUpperCase() + role.slice(1);
              return <ColorPicker key={role} value={palette[role]} format="hex" open={active === role}
                aria-label={`${label} color`} onOpenChange={(open) => setActive(open ? role : null)}
                onValueChange={(value) => update({ ...palette, [role]: value })}>
                <ColorPickerTrigger className="home-color" aria-describedby={`${role}-color-tooltip`} aria-label={`${label} ${palette[role]}`}
                  style={{ background: palette[role], color: contrast(palette[role], "#ffffff") >= contrast(palette[role], "#000000") ? "#ffffff" : "#000000" }}>
                  <span>{label}</span>{" "}<span>{palette[role]}</span><span id={`${role}-color-tooltip`} className="control-tooltip" role="tooltip">{label} {palette[role]}</span>
                </ColorPickerTrigger>
                <ColorPickerContent className="color-picker-content" side="bottom" sideOffset={12} align="end">
                  <div className="home-picker-heading"><h2>{label}</h2><Button variant="outline" onClick={() => setActive(null)}>Close</Button></div>
                  <ColorPickerPanel><ColorPickerArea /><ColorPickerSlider channel="hue" /><ColorPickerFields formats={["hex", "rgb", "hsl"]} /></ColorPickerPanel>
                </ColorPickerContent>
              </ColorPicker>;
            })}
          </div>
          <section className="home-fonts" aria-labelledby="font-pairs-title">
            <h2 id="font-pairs-title">Fonts</h2>
            <div className="home-font-selectors">
              <label className="home-font-pair-select" htmlFor="home-font-pair">Font pair
                <select id="home-font-pair" value={fontPairs.some((pair) => pair.heading === heading && pair.body === body) ? `${heading}|${body}` : "custom"}
                  onChange={(event) => {
                    const pair = fontPairs.find((item) => `${item.heading}|${item.body}` === event.target.value);
                    if (pair) selectFonts(pair.heading, pair.body);
                  }}>
                  <option value="custom" disabled>Custom pair</option>
                  {fontPairs.map((pair) => <option key={`${pair.heading}-${pair.body}`} value={`${pair.heading}|${pair.body}`}>{pair.heading} + {pair.body}</option>)}
                </select>
              </label>
              <label htmlFor="home-heading-font">Headings
                <select id="home-heading-font" value={heading} onChange={(event) => selectFonts(event.target.value as FontName, body)}>
                  {Object.keys(fonts).map((font) => <option key={font}>{font}</option>)}
                </select>
              </label>
              <label htmlFor="home-body-font">Body
                <select id="home-body-font" value={body} onChange={(event) => selectFonts(heading, event.target.value as FontName)}>
                  {Object.keys(fonts).map((font) => <option key={font}>{font}</option>)}
                </select>
              </label>
            </div>
          </section>
      </section>
    </div>
  </main>;
}
