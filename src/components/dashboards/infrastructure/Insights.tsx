"use client";

import { useLinkState } from "@/hooks/useLinkState";
import {SegmentedControl} from '../vendor/halaska';
import {Action, Icon, Menu} from './primitives';
import {previews} from './data';
import './insights.css';

const metrics = [
  ['Build CPU Minutes', '$2.91'],
  ['Fluid Provisioned Memory', '$0.57'],
  ['Drains Volume', '$0.34'],
  ['Fluid Active CPU', '$0.24'],
  ['Fast Origin Transfer', '$0.08'],
  ['ISR Writes', '$0.05'],
  ['Function Invocations', '$0.05'],
  ['ISR Reads', '$0.05'],
  ['CDN Requests - Additional CPU Duration', '$0.03'],
  ['Image Optimization Transformation', '$0.00'],
];

export default function Insights({onAction}:{onAction:(title:string,detail?:string)=>void}) {
  const [tab,setTab]=useLinkState("Insights.Insights.tab", 'Recents');
  const [usageExpanded,setUsageExpanded]=useLinkState("Insights.Insights.usageExpanded", false);
  const [recentsExpanded,setRecentsExpanded]=useLinkState("Insights.Insights.recentsExpanded", false);
  return <aside className={`vc-insights vc-insights-${tab.toLowerCase()}`} aria-label="Project insights">
    <div className="vc-insight-tabs" data-component="halaska-segmented-control">
      <SegmentedControl options={['Recents','Usage','Alerts']} value={tab} onChange={setTab} theme="dark"/>
    </div>
    <section className="vc-insight-section vc-usage-section">
      <span className="vc-section-title" role="heading" aria-level={2}>Usage</span>
      <div className={`vc-panel vc-usage-panel${usageExpanded?' is-expanded':''}`}>
        <div className="vc-usage-cycle">
          <Action onClick={()=>onAction('Billing cycle','12 days remaining in cycle')}>12 days remaining in cycle</Action>
          <Action variant="outline" onClick={()=>onAction('Billing')}>Billing</Action>
        </div>
        <div className="vc-credit">
          <div className="vc-credit-values">
            <div><span>Included Credit</span><strong>$4.33 / $20</strong></div>
            <div><span>On-Demand Charges</span><strong>$0</strong></div>
          </div>
          <div className="vc-credit-track" role="meter" aria-label="Included credit used" aria-valuemin={0} aria-valuemax={20} aria-valuenow={4.33}><span/></div>
        </div>
        <div className="vc-usage-metrics">
          {(usageExpanded?metrics:metrics.slice(0,1)).map(([name,value])=><Action key={name} className="vc-usage-metric" onClick={()=>onAction(name,value)}><span>{name}</span><span>{value}</span></Action>)}
        </div>
      </div>
      <Action className="vc-insight-expand vc-usage-expand" aria-label={usageExpanded?'Show less usage':'Show more usage'} title={usageExpanded?'Show less usage':'Show more usage'} aria-expanded={usageExpanded} onClick={()=>setUsageExpanded(!usageExpanded)}><Icon name="chevron" className={usageExpanded?'is-up':''}/></Action>
    </section>
    <section className="vc-insight-section vc-alerts-section">
      <span className="vc-section-title" role="heading" aria-level={2}>Alerts</span>
      <div className="vc-panel vc-alerts-panel">
        <span className="vc-alert-bell"><Icon name="208 unseen notifications"/></span>
        <p>Get notified when usage or errors spike across your projects.</p>
        <Action className="vc-alert-enable" variant="default" onClick={()=>onAction('Enable Observability Plus')}>Enable Observability Plus</Action>
      </div>
    </section>
    <section className="vc-insight-section vc-recents-section">
      <span className="vc-section-title" role="heading" aria-level={2}>Recent Previews</span>
      <div className={`vc-panel vc-preview-list${recentsExpanded?' is-expanded':''}`}>
        {previews.map(preview=><article className="vc-preview-row" key={preview.id}>
          <div className="vc-preview-title"><span className="vc-preview-avatars" aria-hidden="true"><span/><span style={{background:'var(--p-accent)'}}/></span><span title={preview.title}>{preview.title}</span></div>
          <div className="vc-preview-controls">
            <Action className="vc-preview-pill" onClick={()=>onAction('Preview',preview.title)}><Icon name="Preview"/>Preview</Action>
            <Action className="vc-preview-pill" onClick={()=>onAction('View source',preview.project)}><Icon name="View Source"/>Source</Action>
            <Action className="vc-preview-pill vc-preview-id" onClick={()=>onAction('Deployment',preview.id)}><span className="vc-preview-status"/><code>{preview.id}</code></Action>
          </div>
          <Menu label={`Preview menu for ${preview.title}`} icon="Preview Menu" items={[
            {label:'View deployment',onClick:()=>onAction('Deployment',preview.id)},
            {label:'View source',onClick:()=>onAction('View source',preview.project)},
            {label:'Copy URL',onClick:()=>onAction('Copy URL',preview.project)},
          ]}/>
        </article>)}
      </div>
      <Action className="vc-insight-expand vc-recents-expand" aria-label={recentsExpanded?'Show fewer previews':'Show more previews'} title={recentsExpanded?'Show fewer previews':'Show more previews'} aria-expanded={recentsExpanded} onClick={()=>setRecentsExpanded(!recentsExpanded)}><Icon name="chevron" className={recentsExpanded?'is-up':''}/></Action>
    </section>
  </aside>;
}
