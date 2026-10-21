"use client";
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {useLinkState} from "@/hooks/useLinkState";
import {PreviewCard} from '@base-ui/react/preview-card';
import {usePathname} from 'next/navigation';
import {ChevronDown,Check} from 'lucide-react';
import PreviewThumbnail from './PreviewThumbnail';
import {Button} from './ui/button';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuGroup,DropdownMenuSeparator} from './ui/dropdown-menu';
import {previewCatalog,previewHref} from '@/lib/preview-catalog';
import type {Palette} from '@/lib/palette';
import type {FontName} from '@/lib/fonts';
import type {ElementRole} from '@/lib/element-roles';
type SitePreview=(typeof previewCatalog)[number];
export default function SiteSwitcher({palette,heading,body,elementRoles=[],onOpen}:{palette:Palette;heading:FontName;body:FontName;elementRoles?:ElementRole[];onOpen:()=>void}){
 const path=usePathname() ?? "";
 const menu=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useLinkState("siteMenu",false);
 useEffect(()=>{if(!open)return;const studio=document.querySelector<HTMLElement>('main.studio');if(!studio)return;const previous=studio.inert;studio.inert=true;return()=>{studio.inert=previous;};},[open]);
 const current=previewCatalog.find(site=>path===site.path||path.startsWith(site.path+'/'));
 const href=(path:string)=>previewHref(path,palette,heading,body,elementRoles);
 const option=(site?:SitePreview)=><DropdownMenuItem key={site?.path??'/'} asChild><PreviewCard.Trigger payload={site} delay={120} closeDelay={80} render={<Link prefetch={false} href={href(site?.path??'/')} aria-current={site===current&&site?'page':undefined}/>}><span>{site?.name??'All sites'}</span>{site&&site===current&&<Check size={16} aria-hidden="true"/>}</PreviewCard.Trigger></DropdownMenuItem>;
 return <DropdownMenu open={open} onOpenChange={value=>{setOpen(value);if(value)onOpen();}}><DropdownMenuTrigger asChild><Button variant="ghost" className="site-switcher-trigger" aria-label={`Switch site: ${current?.name??'Preview'}`}><span>{current?.name??'Preview'}</span><ChevronDown size={16}/></Button></DropdownMenuTrigger><DropdownMenuContent ref={menu} className="site-switcher-menu" align="start" side="top" sideOffset={12} collisionPadding={12}>
  <PreviewCard.Root<SitePreview>>{({payload})=><>
   {['Homepages','Dashboards'].map(category=><DropdownMenuGroup key={category}><DropdownMenuLabel>{category}</DropdownMenuLabel>{previewCatalog.filter(site=>site.category===category).map(site=>option(site))}</DropdownMenuGroup>)}
   <DropdownMenuSeparator/>{option()}
   <PreviewCard.Portal><PreviewCard.Positioner className="site-switcher-preview-positioner" anchor={menu} side="right" align="end" sideOffset={12} collisionPadding={12} collisionAvoidance={{side:'flip',align:'shift',fallbackAxisSide:'start'}}>
    <PreviewCard.Popup className="site-switcher-preview" data-page-preview={payload?.id??'gallery'}>
     {payload?<PreviewThumbnail id={payload.id} palette={palette}/>:<div className="site-switcher-gallery">{previewCatalog.map(preview=><div key={preview.id}><PreviewThumbnail id={preview.id} palette={palette}/><span>{preview.name}</span></div>)}</div>}
     <p>{payload?.name??'All sites'}</p>
    </PreviewCard.Popup>
   </PreviewCard.Positioner></PreviewCard.Portal>
  </>}</PreviewCard.Root>
 </DropdownMenuContent></DropdownMenu>;
}
