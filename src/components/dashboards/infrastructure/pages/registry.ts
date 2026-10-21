import {dashboardPaths} from '../../../../lib/previews.ts';
export const pageLabels = {
 projects:'Projects', deployments:'Deployments', logs:'Logs', analytics:'Analytics',
 'speed-insights':'Speed Insights', observability:'Observability', firewall:'Firewall', cdn:'CDN',
 'environment-variables':'Environment Variables', domains:'Domains', connect:'Connect', integrations:'Integrations', storage:'Storage', flags:'Flags', agent:'Agent',
 'ai-gateway':'AI Gateway', sandboxes:'Sandboxes', workflows:'Workflows', images:'Images', daemons:'Daemons', usage:'Usage', support:'Support', settings:'Settings',
} as const;
export type PageId=keyof typeof pageLabels;
export const pageIds=Object.keys(pageLabels) as PageId[];
export function isPageId(value:unknown):value is PageId{return typeof value==='string'&&Object.hasOwn(pageLabels,value);}
export function pageForLabel(label:string):PageId|undefined{return pageIds.find(id=>pageLabels[id]===label);}
export function dashboardPath(page:PageId){return dashboardPaths.infra+(page==='projects'?'':'/'+page);}
export type PageAction=(title:string,detail?:string)=>void;
