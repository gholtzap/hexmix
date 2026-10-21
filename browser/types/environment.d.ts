interface PreviewPaint {src?:string; visible?:string; ready?:string; bodyVisibility?:string}
interface PreviewSpeechRecognition {
  start():void; stop():void;
  onresult: (event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void;
  onerror:()=>void; onend:()=>void;
}
interface Window {
  previewNavigationReady?:boolean;
  SpeechRecognition?:new()=>PreviewSpeechRecognition;
  webkitSpeechRecognition?:new()=>PreviewSpeechRecognition;
  EyeDropper?:new()=>{open():Promise<{sRGBHex:string}>};
  __contrastRuns?:number;
  __navigationDocument?:string;
  __navigationToolbar?:Element;
  recordPreviewPaint?:(state:PreviewPaint)=>void;
}
