import { notFound } from 'next/navigation';
import destinations from '@/lib/site-destinations.json';
import { sitePreviews,siteIdForSlug } from '@/lib/previews';
export async function generateMetadata({params}:{params:Promise<{site:string;view:string[]}>}) {
  const {site,view}=await params;const id=siteIdForSlug(site);
  const records=id?destinations[id] as Record<string,{title:string}>:{};
  const path=view.join('/');
  return {title:id?`${sitePreviews[id].name} · ${(records[path] || records['./'+path])?.title || 'Page preview'}`:'Page preview'};
}
export default async function Page({ params }: { params: Promise<{ site: string; view: string[] }> }) {
  const { site, view } = await params;
  const id=siteIdForSlug(site);
  const preview=id?sitePreviews[id]:undefined;
  if (!preview||!id) notFound();
  return null;
}
