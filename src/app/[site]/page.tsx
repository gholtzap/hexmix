import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { sitePreviews as previews,siteIdForSlug } from "@/lib/previews";

export function generateStaticParams() {
  return Object.values(previews).map(preview => ({site:preview.slug}));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const { site } = await params;
  const id=siteIdForSlug(site);
  const preview=id?previews[id]:undefined;
  return { title: preview ? `${preview.name} — Color preview` : "Color preview" };
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const id=siteIdForSlug(site);
  const preview=id?previews[id]:undefined;
  if (!preview||!id) notFound();
  return null;
}
