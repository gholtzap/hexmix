"use client";

import {useEffect, useRef} from 'react';
import {Action, Icon, Menu, Tool} from './primitives';
import './navigation.css';
import {pageLabels,type PageId} from './pages/registry';

const groups = [
 ['Projects','Deployments','Logs','Analytics','Speed Insights','Observability','Firewall','CDN'],
 ['Environment Variables','Domains','Connect','Integrations','Storage','Flags','Agent','AI Gateway'],
];
type NavigationProps = {team:string;teamNames?:Record<string,string>;activePage?:PageId;open:boolean;onClose:()=>void;onOpen:()=>void;onAction:(title:string)=>void;onFind:()=>void};

export function Navigation({team,teamNames={},activePage='projects',open,onClose,onOpen,onAction,onFind}:NavigationProps){
 const teamName=teamNames[team]??team;
 const sidebar=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!open || !matchMedia('(max-width: 1099px)').matches)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const background=[...document.querySelectorAll<HTMLElement>('.vc-main,.vc-mobile-tools')];
  const inert=background.map(element=>element.inert);
  background.forEach(element=>{element.inert=true;});
  const controls=()=>[...sidebar.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,[tabindex="0"]')??[]].filter(element=>element.getClientRects().length);
  controls()[0]?.focus();
  function key(event:KeyboardEvent){
   if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();onClose();}
   if(event.key!=='Tab')return;
   const list=controls(),first=list[0],last=list.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);background.forEach((element,index)=>{element.inert=inert[index];});previous?.focus();};
 },[open,onClose]);
 return <>
  {open&&<div className="vc-sidebar-backdrop" aria-hidden="true" onClick={onClose}/>}
  <aside ref={sidebar} className={`vc-sidebar${open?' is-open':''}`} aria-label="Workspace navigation">
   <header className="vc-sidebar-header">
    <div className="vc-site-switcher-slot" data-site-switcher-slot>
     <span className="vc-avatar vc-team-avatar" aria-hidden="true"/><span>{teamName}</span>{" "}<span className="vc-plan">Pro</span>
    </div>
    <Action className="vc-find" onClick={onFind}><Icon name="FindF"/><span>Find</span><kbd>F</kbd></Action>
   </header>
   <nav className="vc-sidebar-links" aria-label="Team">
    {groups.map((group,index)=><div className="vc-nav-group" key={index}>{group.map(label=><Action key={label} className={`vc-nav-link${label===pageLabels[activePage]?' is-active':''}`} aria-current={label===pageLabels[activePage]?'page':undefined} onClick={()=>{onClose();onAction(label);}}><Icon name={label==='Environment Variables'?'Environment Variables47':label}/><span>{label}</span>{label==='Environment Variables'&&<span className="vc-env-count">47</span>}{['Logs','Observability','Firewall','Agent'].includes(label)&&<span className="vc-nav-chevron">›</span>}</Action>)}</div>)}
   </nav>
   <div className="vc-sidebar-close"><Tool label="Close sidebar" icon="close" onClick={onClose}/></div>
  </aside>
  <div className="vc-mobile-tools"><Action onClick={onFind}><Icon name="FindF"/>Find</Action><Tool label="Open sidebar" icon="Toggle sidebar" onClick={onOpen}/></div>
 </>;
}

export function Topbar({team,title='Overview',onOpen,onAction,onAgent}:{team:string;title?:string;onOpen:()=>void;onAction:(title:string)=>void;onAgent:()=>void}){
 return <header className="vc-topbar">
  <div className="vc-topbar-left"><span className="vc-topbar-toggle"><Tool label="Open sidebar" icon="Toggle sidebar" onClick={onOpen}/></span><Menu label="All Projects · Project scope" items={['All projects','Favorites'].map(label=>({label,onClick:()=>onAction(label)}))}><span>All Projects</span><Icon name="chevron"/></Menu></div>
  <span className="vc-topbar-overview">{title}</span><span className="vc-topbar-team"><span className="vc-avatar vc-team-avatar"/>{team}</span>
  <Action className="vc-agent-button" aria-label="Open Agent" title="Open Agent" onClick={onAgent}><Icon name="Toggle side chat"/><span>Agent</span></Action>
 </header>;
}
