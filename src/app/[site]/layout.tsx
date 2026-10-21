import { notFound } from "next/navigation";
import SiteStudio from "@/components/SiteStudio";
import { siteIdForSlug } from "@/lib/previews";

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const site = siteIdForSlug((await params).site);
  if (!site) notFound();
  return <><SiteStudio site={site} />{children}</>;
}
