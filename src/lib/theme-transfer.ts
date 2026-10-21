import {parseSnapshot} from './shared-snapshot.ts';
import {fonts,type FontName} from './fonts.ts';
import {roles,paletteCSS,type Palette} from './palette.ts';
import {readElementRoles,maxElementRolesLength,type ElementRole} from './element-roles.ts';

export type Theme = {colors:Palette;fonts:{heading:FontName;body:FontName};elements:ElementRole[]};
export type ThemeImport = {colors:Palette;fonts?:Partial<Theme['fonts']>;elements?:ElementRole[]};
const inputError='Paste five hex colors, palette CSS, theme JSON, or a Hexmix link.';
function color(value:unknown):string {
 if(typeof value!=='string'||!/^#?(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim()))throw new Error('Use a three- or six-digit hex value for each color.');
 const hex=value.trim().replace(/^#/,'').toLowerCase();return '#'+(hex.length===3?[...hex].map(c=>c+c).join(''):hex);
}
function palette(value:unknown):Palette {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(inputError);
 const values=value as Record<string,unknown>;return Object.fromEntries(roles.map(role=>[role,color(values[role])])) as Palette;
}
function font(value:unknown):FontName {
 const entry=Object.entries(fonts).find(([name,css])=>value===name||value===css);
 if(!entry)throw new Error('This font is not available in Hexmix. Choose a supported font before pasting.');return entry[0] as FontName;
}
function importFonts(value:unknown):ThemeImport['fonts'] {
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The font settings are not valid.');
 const source=value as Record<string,unknown>,result:ThemeImport['fonts']={};
 for(const key of ['heading','body'] as const)if(source[key]!==undefined)result[key]=font(source[key]);return result;
}
function elements(value:unknown):ElementRole[]|undefined {
 if(value===undefined)return undefined;
 if(!Array.isArray(value))throw new Error('The element settings are not valid.');
 const encoded=JSON.stringify(value),parsed=readElementRoles(new URLSearchParams({elements:encoded}).toString());
 if(parsed.length!==value.length||encoded.length>maxElementRolesLength)throw new Error('The element settings are not valid.');return parsed;
}
function list(values:unknown[]):ThemeImport {
 if(values.length!==roles.length)throw new Error('Paste exactly five colors in toolbar order.');
 return {colors:Object.fromEntries(roles.map((role,i)=>[role,color(values[i])])) as Palette};
}
export function parseTheme(input:string):ThemeImport {
 const text=input.trim();if(!text||text.length>50000)throw new Error(text.length>50000?'Paste 50,000 characters or fewer.':inputError);
 if(/^https?:\/\//i.test(text)){
  let url:URL;try{url=new URL(text);}catch{throw new Error(inputError);}
  const colors=url.searchParams.get('colors');if(!colors)throw new Error('The link has no palette.');
  const imported=list(colors.split('-'));
  const h=url.searchParams.get('heading'),b=url.searchParams.get('body'),e=url.searchParams.get('elements');
  let assignments:unknown;try{assignments=e===null?undefined:JSON.parse(e);}catch{throw new Error('The element settings are not valid.');}
  return {...imported,fonts:importFonts({...h?{heading:h}:{},...b?{body:b}:{}}),elements:elements(assignments)};
 }
 if(text.startsWith('{')||text.startsWith('[')){
  let data:unknown;try{data=JSON.parse(text);}catch{if(!text.includes('--'))throw new Error('The JSON is not valid.');}
  if(Array.isArray(data))return list(data);
  if(data&&typeof data==='object'){
   const record=data as Record<string,unknown>;
   if(record.version!==undefined&&record.version!==1)throw new Error('This theme version is not supported.');
   return {colors:palette(record.colors??record),fonts:importFonts(record.fonts),elements:elements(record.elements)};
  }
 }
 if(text.includes('--')){
  const values=Object.fromEntries([...text.matchAll(/--(?:color-)?(text|background|primary|secondary|accent)\s*:\s*([^;}]+)(?:;|(?=\}))/g)].map(m=>[m[1],m[2].trim()]));
  const family=Object.fromEntries([...text.matchAll(/--font-(heading|body)\s*:\s*([^;}]+)(?:;|(?=\}))/g)].map(m=>[m[1],m[2].trim()]));
  return {colors:palette(values),fonts:importFonts(family)};
 }
 return list(text.split(/[\s,;\-]+/).filter(Boolean));
}
export async function readTheme(input:string,origin:string):Promise<ThemeImport> {
 const text=input.trim();
 if(text.length>50000) return parseTheme(text);
 let url:URL;try{url=new URL(text);}catch{return parseTheme(text);}
 const id=/^\/s\/([a-f0-9]{32})\/?$/.exec(url.pathname)?.[1];
 if(!id)return parseTheme(text);
 if(url.origin!==origin)throw new Error('Use a shared theme link from this site.');
 const response=await fetch(`/api/shares/${id}`,{redirect:'error'});
 if(!response.ok)throw new Error('The shared theme could not be loaded.');
 const snapshot=parseSnapshot(await response.json());
 if(!snapshot)throw new Error('The shared theme is not valid.');
 return parseTheme(new URL(snapshot.href,origin).href);
}
export function copyPalette(colors:Palette):string {return JSON.stringify(colors,null,2);}
export function copyTheme(theme:Theme):string {return JSON.stringify({version:1,...theme},null,2);}
export function themePrompt(theme:Theme):string {
 return `Apply this theme to the existing UI. Keep the existing layout, content, and behavior.\nUse the semantic color roles below. Use the on-surface colors for readable labels. Keep normal text contrast at least 4.5:1. Do not change the palette values.\nHeading font: ${theme.fonts.heading}\nBody font: ${theme.fonts.body}\nLoad the selected fonts if they are not already available.\n\n${paletteCSS(theme.colors,fonts[theme.fonts.heading],fonts[theme.fonts.body])}${theme.elements.length?`\nElement color assignments (page path, CSS selector, property, palette role):\n${JSON.stringify(theme.elements,null,2)}\n`:''}\nCheck mobile and desktop layouts, keyboard access, and contrast before completion.`;
}
