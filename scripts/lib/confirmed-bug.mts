import {chromium,type Page,type Frame,type BrowserContext} from 'playwright';
import {checkPage} from 'lintapple';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {clickToolbarAction} from './studio-toolbar.mts';

// Each branch keeps this identical helper so its regression check can run on its own.
export async function runBugCheck(id:string,path:string,run:(test:{page:Page;frame:Frame;context:BrowserContext;open:(link:string,storage?:Record<string,string>)=>Promise<{page:Page;frame:Frame;context:BrowserContext}>;share:()=>Promise<string>;audit:(target:Page|Frame,state:string)=>Promise<void>;nav:(label:string)=>Promise<void>})=>Promise<void>){
 const base=process.env.APP_URL||'http://127.0.0.1:3340',out=`artifacts/${id.toLowerCase()}`;
 const policy=JSON.parse(await readFile('ui-policy.json','utf8')),browser=await chromium.launch(),reports=[],checks=[],snapshots=new Set<string>();
 await mkdir(out,{recursive:true});
 const widths=process.env.CHECK_WIDTH?[Number(process.env.CHECK_WIDTH)]:[390,1440];
 const themes=process.env.CHECK_THEME?[process.env.CHECK_THEME]:['light','dark'];
 try{for(const width of widths)for(const theme of themes){
  const contexts:BrowserContext[]=[];
  async function open(link:string,storage:Record<string,string>={}){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme as 'light'|'dark',permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'});contexts.push(context);
   await context.addInitScript(values=>{for(const[key,value]of Object.entries(values))localStorage.setItem(key,value);},storage);
   const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(link);await page.locator('[data-app-ready]').waitFor();await page.locator('iframe[data-preview-ready=true]').waitFor();
   const frame=await(await page.locator('iframe').elementHandle())!.contentFrame();if(!frame)throw new Error('Preview did not load');return{page,frame,context};
  }
  const url=new URL(path,base);url.searchParams.set('colors',theme==='light'?'171717-ffffff-e98878-ffe291-a8655f':'ededed-171717-e98878-333333-a8655f');
  const{page,frame,context}=await open(url.href);
  const audit=async(target:Page|Frame,state:string)=>{await target.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});reports.push({width,theme,state,report:await checkPage(target,policy)});const view='page'in target?target.page():target;await view.screenshot({path:`${out}/${width}-${theme}-${state}.png`});};
  const share=async()=>{await page.evaluate(()=>navigator.clipboard.writeText(''));await clickToolbarAction(page,'Share palette');let link='';for(let i=0;i<150;i++){link=await page.evaluate(()=>navigator.clipboard.readText());if(/^https?:/.test(link))break;await new Promise(resolve=>setTimeout(resolve,100));}if(!/^https?:/.test(link))throw new Error('Share did not copy a link');const snapshot=/\/s\/([a-f0-9]{32})/.exec(link)?.[1];if(snapshot)snapshots.add(snapshot);return link;};
  const nav=async(label:string)=>{const target=frame.locator('.vc-sidebar-links').getByRole('button',{name:label,exact:true});if(!await target.isVisible())await frame.locator('.vc-topbar-toggle').getByRole('button',{name:'Open sidebar',exact:true}).click();await target.click();};
  try{await run({page,frame,context,open,share,audit,nav});checks.push({width,theme,passed:true});console.log(id,width,theme,'passed');}
  catch(error){checks.push({width,theme,passed:false,error:String(error)});await page.screenshot({path:`${out}/${width}-${theme}-failed.png`});console.error(id,width,theme,String(error));}
  finally{await Promise.all(contexts.map(c=>c.close()));}
 }}finally{await browser.close();for(const id of snapshots)await unlink(`.local/shares/${id}.json`).catch(error=>{if(error.code!=='ENOENT')throw error;});await writeFile(`${out}/report.json`,JSON.stringify({id,checks,reports},null,2));}
 const findings=reports.reduce((sum,r)=>sum+r.report.findings.length,0);console.log(`${checks.length} cases; ${findings} UI findings; report: ${out}/report.json`);if(checks.some(c=>!c.passed))process.exitCode=2;else if(findings)process.exitCode=1;
}
