import {paletteQuery,type Palette} from "./palette.ts";
import type {FontName} from "./fonts.ts";
import { sitePreviews,dashboardPaths } from "./previews.ts";

export const previewCatalog = [
  { id: "workspace", path: dashboardPaths.chatbot, name: "AI Chatbot", category: "Dashboards" },
  ...Object.entries(sitePreviews).map(([site, preview]) => ({ id: site, path: `/${preview.slug}`, name: preview.name, category: "Homepages" })),
  { id: "infrastructure", path: dashboardPaths.infra, name: "Infra Dashboard", category: "Dashboards" },
];

export function previewHref(path:string,palette:Palette,heading:FontName,body:FontName){
  const query=new URLSearchParams(paletteQuery(palette));
  query.set('heading',heading);query.set('body',body);
  return `${path}?${query}`;
}
