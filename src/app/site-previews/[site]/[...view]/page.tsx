import { notFound,redirect } from 'next/navigation';
import { sitePreviews } from '@/lib/previews';
export default async function Page({ params,searchParams }: { params: Promise<{ site: string; view: string[] }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { site, view } = await params;
  if (!Object.hasOwn(sitePreviews, site)) notFound();
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(await searchParams))for(const item of Array.isArray(value)?value:[value])if(item!==undefined)query.append(key,item);
  const path=[sitePreviews[site as keyof typeof sitePreviews].slug,...view].map(encodeURIComponent).join('/');
  redirect(`/${path}${query.size?'?'+query:''}`);
}
