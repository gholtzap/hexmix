"use client";
import {useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Button} from '@/components/ui/button';
import IconButton from '@/components/IconButton';
import {CardDialog, DropdownMenu} from '../vendor/halaska';
import sourceIcons from './icons.json';
import { useLinkState } from '@/hooks/useLinkState';
const icons:Record<string,string>=sourceIcons;
const inertOwners = new WeakMap<HTMLElement, { count: number; previous: boolean }>();
function useInertApp() {
 useEffect(() => {
  const app = document.querySelector<HTMLElement>('.infrastructure-app');
  if (!app) return;
  const state = inertOwners.get(app) ?? { count: 0, previous: app.inert };
  state.count++; inertOwners.set(app, state); app.inert = true;
  return () => { if (--state.count === 0) { app.inert = state.previous; inertOwners.delete(app); } };
 }, []);
}
export function Icon({name,className=''}:{name:string;className?:string}){
 const body=icons[name];
 return <svg className={`vc-icon ${className}`} viewBox={name==='Toggle side chat'?'0 0 24 24':'0 0 16 16'} fill="currentColor" width="16" height="16" aria-hidden="true" focusable="false">{body?<g dangerouslySetInnerHTML={{__html:body}}/>:name==='close'?<path d="m4 4 8 8m-8 0 8-8" stroke="currentColor" strokeWidth="1.5"/>:name==='plus'?<path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5"/>:name==='chevron'?<path d="m5 6 3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.5"/>:name==='github'?<image href="/dashboard-previews/infrastructure/assets/github.svg" width="16" height="16"/>:name==='triangle'?<path d="M8 1 16 15H0Z" fill="currentColor"/>:name==='star'?<path d="m8 1 2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7Z" fill="none" stroke="currentColor" strokeWidth="1.2"/>:name==='list'?<path d="M5 3h10M5 8h10M5 13h10M1 3h1M1 8h1M1 13h1" stroke="currentColor" strokeWidth="1.5"/>:<circle cx="8" cy="8" r="3" fill="currentColor"/>}</svg>;
}
export function Action({className='',variant='ghost',...props}:ComponentProps<typeof Button>){return <Button {...props} render={props['aria-label']?<IconButton/>:undefined} variant={variant} className={`vc-button ${className}`}/>;}
export function Tool({label,icon,onClick}:{label:string;icon:string;onClick?:()=>void}){return <Action className="vc-tool" aria-label={label} title={label} onClick={onClick}><Icon name={icon}/></Action>;}
type MenuProps={label:string;icon?:string;children?:ReactNode;items:{label:string;onClick:()=>void}[];className?:string};
export function Menu({label,icon,children,items,className=''}:MenuProps){
 const [open,setOpen]=useLinkState(`menu:${label}`,false);
 const trigger=useRef<HTMLButtonElement>(null);
 const [anchor,setAnchor]=useState<HTMLElement|null>(null);
 useEffect(()=>{setAnchor(open?trigger.current:null);},[open]);
 const iconOnly=!children||className.includes('vc-score-menu')||className.includes('vc-add')||className.includes('vc-team-menu')||className.includes('vc-profile-menu');
 return <div className={`vc-menu ${className}`} data-component="halaska-dropdown-menu"><div data-menu-trigger><Action ref={trigger} className={children?'':'vc-tool'} aria-label={iconOnly?label:undefined} title={label} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(true)}>{icon&&<Icon name={icon}/>} {children}</Action></div>{anchor&&<MenuPopup anchor={anchor} label={label} items={items} onClose={()=>setOpen(false)}/>}</div>;
}
function MenuPopup({anchor,label,items,onClose}:{anchor:HTMLElement;label:string;items:MenuProps['items'];onClose:()=>void}){
 const host=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const panel=host.current?.querySelector<HTMLElement>('[role="menu"]');if(!panel)return;
  const rect=anchor.getBoundingClientRect();const left=Math.max(8,Math.min(rect.left,innerWidth-panel.offsetWidth-8));const top=rect.bottom+6+panel.offsetHeight>innerHeight?Math.max(8,rect.top-panel.offsetHeight-6):rect.bottom+6;
  Object.assign(panel.style,{position:'fixed',left:`${left}px`,right:'auto',top:`${top}px`,marginTop:'0px'});panel.setAttribute('aria-label',label);panel.querySelector<HTMLButtonElement>('button')?.focus();
 },[anchor,label]);
 useInertApp();
 useEffect(() => () => anchor.focus({ preventScroll: true }), [anchor]);
 return createPortal(<div ref={host} className="vc-menu vc-menu-popup"><DropdownMenu theme="dark" externalAnchor={anchor} onClose={onClose} items={items}/></div>,document.body);
}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 useInertApp();
 if(typeof document==='undefined')return null;
 return createPortal(<div className="vc-modal" data-component="halaska-card-dialog"><CardDialog open onClose={onClose} title={title} theme="dark"><Tool label="Close dialog" icon="close" onClick={onClose}/><div className="vc-dialog-body">{children}</div></CardDialog></div>,document.body);
}
