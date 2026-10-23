import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTheme,copyPalette,copyTheme,themePrompt} from './theme-transfer.ts';
import {initialPalette,paletteCSS,paletteQuery,paletteExport} from './palette.ts';
import {fonts} from './fonts.ts';
const theme={colors:initialPalette,fonts:{heading:'Inter',body:'Lora'},elements:[{path:'/avenlo',selector:'body > main:nth-of-type(1)',property:'color',role:'primary'}]} as const;
test('palette and full theme copy round trip with named roles',()=>{
 assert.deepEqual(parseTheme(copyPalette(initialPalette)).colors,initialPalette);
 const parsed=parseTheme(copyTheme({...theme,elements:[...theme.elements]}));
 assert.deepEqual(parsed,{...theme,elements:[...theme.elements]});
 assert.equal(parseTheme(copyPalette(initialPalette)).fonts,undefined);
});
test('existing CSS, Tailwind, JSON and shared links import fonts and colors',()=>{
 for(const input of [paletteCSS(initialPalette,fonts.Inter,fonts.Lora),paletteExport('tailwind',initialPalette,fonts.Inter,fonts.Lora),paletteExport('json',initialPalette,fonts.Inter,fonts.Lora),`https://hexmix.dev/avenlo?${paletteQuery(initialPalette)}&heading=Inter&body=Lora&elements=${encodeURIComponent(JSON.stringify(theme.elements))}`]){
  const imported=parseTheme(input);assert.deepEqual(imported.colors,initialPalette);assert.deepEqual(imported.fonts,theme.fonts);
 }
});
test('unnamed lists use toolbar role order and normalize short and upper case hex',()=>{
 for(const text of ['#000 #FFF #AbCdEf #abc #123456','000-FFF-AbCdEf-abc-123456',JSON.stringify(['#000','#FFF','#AbCdEf','#abc','#123456'])]){
  const imported=parseTheme(text);assert.deepEqual(Object.values(imported.colors),['#000000','#ffffff','#abcdef','#aabbcc','#123456']);
 }
});
test('reject invalid input without partial imports',()=>{
 for(const value of ['', '#fff #000', '#000 #fff #aaa #bbb #ccc #ddd', 'red blue green orange yellow','https://hexmix.dev/?colors=000000-ffffff-zzzzzz-aaaaaa-bbbbbb',JSON.stringify({colors:{...initialPalette,primary:'url(javascript:bad)'}}),JSON.stringify({...theme,fonts:{heading:'Unknown',body:'Lora'}}),JSON.stringify({...theme,elements:[{...theme.elements[0],selector:'script'}]}),JSON.stringify({...theme,elements:'bad'}),'x'.repeat(50001)])assert.throws(()=>parseTheme(value));
});
test('AI prompt includes exact tokens, fonts, contrast rules and element assignments',()=>{
 const prompt=themePrompt({...theme,elements:[...theme.elements]});
 for(const expected of ['#e98878','--color-primary','Inter','Lora','4.5:1','body > main:nth-of-type(1)','Keep the existing layout'])assert(prompt.includes(expected));
});

test('shared theme links resolve only same-origin validated snapshots', async () => {
 const {readTheme}=await import('./theme-transfer.ts');
 const original=globalThis.fetch;let calls=0;
 try {
  globalThis.fetch=async()=>{calls++;return Response.json({v:1,href:'/editor?colors=111111-eeeeee-aabbcc-ddeeff-112233&heading=Arial&body=Verdana',state:{v:1,views:{}}});};
  const origin='https://hexmix.example',path='/s/'+'a'.repeat(32);
  const imported=await readTheme(origin+path,origin);
  assert.equal(imported.colors.primary,'#aabbcc');assert.deepEqual(imported.fonts,{heading:'Arial',body:'Verdana'});
  await assert.rejects(()=>readTheme('https://other.example'+path,origin));assert.equal(calls,1);
  globalThis.fetch=async()=>Response.json({v:1,href:'https://other.example/editor',state:{v:1,views:{}}});
  await assert.rejects(()=>readTheme(origin+path,origin));
  globalThis.fetch=async()=>new Response('',{status:404});await assert.rejects(()=>readTheme(origin+path,origin));
 }finally{globalThis.fetch=original;}
});


test('CSS comments cannot replace active palette tokens or font settings',()=>{
 const css=paletteCSS(initialPalette,fonts.Inter,fonts.Lora);
 const parsed=parseTheme('/* --color-primary: #000000; */'+css+'/* Old token: --color-primary: #ff0000; --font-heading: Arial; */');
 assert.deepEqual(parsed.colors,initialPalette);
 assert.deepEqual(parsed.fonts,{heading:'Inter',body:'Lora'});
});
