"use client";

import { useLinkState } from "@/hooks/useLinkState";
import Link from "next/link";
import Image from "next/image";
import { fonts } from "@/lib/fonts";
import { previewCatalog, previewHref } from "@/lib/preview-catalog";
import Studio from "./Studio";
import PreviewThumbnail from "./PreviewThumbnail";
import { Button } from "./ui/button";
export default function Home() {
  const [category, setCategory] = useLinkState("Home.Home.category", "All", { validate: value => ["All", "Homepages", "Dashboards"].includes(String(value)) });
  return <Studio>{({ palette, heading, body }) => <div className="home-page">
    <div className="home-shell">
      <header className="home-header"><Image src="/hexmix-logo.png" width={44} height={44} alt="" priority /><span className="home-wordmark">Hexmix</span><a className="icon-button home-github" href="https://github.com/gholtzap/hexmix" target="_blank" rel="noopener noreferrer" aria-label="View Hexmix on GitHub" aria-describedby="home-github-tooltip"><span className="home-github-icon" aria-hidden="true" /><span className="control-tooltip" role="tooltip" id="home-github-tooltip">View Hexmix on GitHub</span></a></header>
      <section className="home-start" aria-labelledby="home-title">
        <div className="home-intro">
          <h1 id="home-title" style={{ fontFamily: fonts[heading] }}>See your colors on real pages.</h1>
        </div>
      </section>
      <section className="home-gallery" aria-label="Choose a preview">
        <div className="home-categories" role="group" aria-label="Preview categories">
          {["All", "Homepages", "Dashboards"].map((value) => <Button key={value} variant="ghost" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</Button>)}
        </div>
        {["Homepages", "Dashboards"].filter(value => category === "All" || category === value).map(group => <section className="home-preview-group" key={group} aria-labelledby={`preview-${group.toLowerCase()}`}>
          <h3 id={`preview-${group.toLowerCase()}`}>{group}</h3>
          <div className="home-preview-grid">
            {previewCatalog.filter(preview => preview.category === group).map(preview => <div className="home-preview-card" key={preview.path}>
              <Link className="home-preview-link" href={previewHref(preview.path, palette, heading, body)} prefetch={false}>
                <PreviewThumbnail id={preview.id} palette={palette} />
                <div className="home-preview-caption"><h4>{preview.name}</h4></div>
              </Link>
            </div>)}
          </div>
        </section>)}
      </section>
    </div>
  </div>}</Studio>;
}
