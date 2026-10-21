"use client";

import { usePathname } from "next/navigation";
import Studio from "./Studio";
import { sitePreviews } from "@/lib/previews";

export default function SiteStudio({ site }: { site: keyof typeof sitePreviews }) {
  const pathname = usePathname() ?? "";
  const preview = sitePreviews[site];
  const path = pathname.slice(preview.slug.length + 2);
  const sourcePath = site === "avenlo" && path === "contact" ? "contact-demo" : path;
  return <Studio preview={`${preview.url}${sourcePath ? `/${sourcePath}` : ""}`} defaultPalette={preview.colors} waitForPreview capture={{ id: site, name: preview.name }} />;
}
