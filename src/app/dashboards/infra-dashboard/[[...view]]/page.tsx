import Studio from '@/components/Studio';
import {notFound} from 'next/navigation';
import {isPageId,pageIds} from '@/components/dashboards/infrastructure/pages/registry';
export const metadata={title:'Infra Dashboard · Color editor'};
const palette={text:'#ededed',background:'#000000',primary:'#ededed',secondary:'#1f1f1f',accent:'#a1a1a1'};
export const dynamicParams=false;
export function generateStaticParams(){return [{view:[]},...pageIds.filter(page=>page!=='projects').map(page=>({view:[page]}))];}
export default async function Page({params}:{params:Promise<{view?:string[]}>}){const {view=[]}=await params;const page=view[0]||'projects';if(view.length>1||!isPageId(page))notFound();return <Studio preview={`/dashboard-previews/infrastructure?page=${page}`} defaultPalette={palette} waitForPreview/>;}
