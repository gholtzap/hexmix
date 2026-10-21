import type {Frame, Page} from 'playwright';
export async function measure(frame: Frame | Page) {
 return frame.evaluate(()=>{
  const context=document.createElement('canvas').getContext('2d'),cache=new Map();
  const rgba=value=>{if(!cache.has(value)){context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);const color=[...context.getImageData(0,0,1,1).data];color[3]/=255;cache.set(value,color);}return cache.get(value);};
  const hex=values=>'#'+values.slice(0,3).map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');
  const over=(front,back)=>front.slice(0,3).map((value,index)=>value*front[3]+back[index]*(1-front[3]));
  const result=[];
  for(const node of document.querySelectorAll('body *')){
   if(node.closest('script,style,noscript,[disabled]')||!node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
   const wordmark=node.matches('img[data-editor-wordmark]');
   const field=node.matches('input:not([type=checkbox]):not([type=radio]),textarea,select');
   if(!wordmark&&!field&&![...node.childNodes].some(child=>child.nodeType===3&&child.textContent.trim()))continue;
   let ancestors=[];for(let parent=node;parent;parent=parent.parentElement)ancestors.push(parent);
   let background=[255,255,255];for(const parent of ancestors.toReversed())background=over(rgba(getComputedStyle(parent).backgroundColor),background);
   const backing=node.matches('text,tspan')&&node.previousElementSibling?.tagName.toLowerCase()==='rect'?node.previousElementSibling:null;
   if(backing){const text=node.getBoundingClientRect(),rect=backing.getBoundingClientRect(),x=text.x+text.width/2,y=text.y+text.height/2;if(rect.left<=x&&rect.right>=x&&rect.top<=y&&rect.bottom>=y)background=over(rgba(getComputedStyle(backing).fill),background);}
   const css=getComputedStyle(node);let foreground=css.webkitTextFillColor||css.color;
   if(node.matches('text,tspan'))foreground=css.fill;
   if(wordmark){if(!(node as HTMLImageElement).src.startsWith('data:image/svg+xml,'))continue;foreground=new DOMParser().parseFromString(decodeURIComponent((node as HTMLImageElement).src.split(',')[1]),'image/svg+xml').querySelector('text')?.getAttribute('fill');if(!foreground)continue;}
   const opacity=ancestors.reduce((value,parent)=>value*Number(getComputedStyle(parent).opacity),1);
   const painted=color=>{const channels=[...rgba(color)];channels[3]*=opacity;return over(channels,background);};
   const record=(label,color)=>result.push({label,selector:node.tagName+'.'+String((node as SVGElement).className.baseVal??node.className).split(' ').slice(0,3).join('.'),foreground:hex(painted(color)),background:hex(background)});
   const gradient = css.backgroundClip === 'text' && css.backgroundImage !== 'none' && !node.hasAttribute('data-preview-foreground');
   if (gradient) {
    const stops=(css.backgroundImage.match(/(?:rgba?|color|oklch|oklab)\([^()]+\)/g)||[]).map(rgba);
    for(const [index,stop] of stops.entries()) {
     const next=stops[index+1]||stop;
     for(let step=0;step<=10;step++) {
      const sample=stop.map((value,channel)=>value+(next[channel]-value)*step/10);
      result.push({label:'Gradient: '+node.textContent.trim().slice(0,80),selector:node.tagName+'.'+String(node.className),foreground:hex(over(sample,background)),background:hex(background)});
     }
    }
    continue;
   }
   record((wordmark?(node as HTMLImageElement).alt:field?node.getAttribute('aria-label')||node.getAttribute('placeholder')||(node as HTMLInputElement).type:node.textContent.trim()).slice(0,90),foreground);
   if(field&&node.hasAttribute('placeholder'))record('Placeholder: '+node.getAttribute('placeholder'),getComputedStyle(node,'::placeholder').color);
  }
  return result;
 });
}
