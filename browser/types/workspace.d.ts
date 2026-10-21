export type DashboardDialog = HTMLElement & {close: () => void};
export type MenuItem = {label:string; action?:()=>void};
export interface DashboardComponents {
  dialog(title:string, body:string, onOpen?:(panel:DashboardDialog)=>void):DashboardDialog;
  menu(anchor:HTMLElement, items:MenuItem[]):void;
  toast(message:string):void;
  disposeView():void;
  unmountWithin(container:HTMLElement):void;
  mode(host:HTMLElement, work:boolean, onChange:(view:string)=>void):void;
  effort(host:HTMLElement, value:number, onChange:(value:number)=>void):void;
  response(host:HTMLElement, text:string):void;
  destroy():void;
}
declare global {interface Window {dashboardComponents?:DashboardComponents}}
