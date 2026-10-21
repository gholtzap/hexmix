import type {IncomingMessage, ServerResponse} from 'node:http';
import type {CapturedAsset} from '../../scripts/lib/assets.mts';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
const projectRoot = resolve(process.cwd(), process.cwd().endsWith('/tervix') ? '' : 'tervix');
const root = resolve(projectRoot, 'public') + sep;
const manifest: CapturedAsset[] = JSON.parse(await readFile(resolve(projectRoot, 'assets.json'), 'utf8'));
const routeAliases = new Map(Object.entries(JSON.parse(await readFile(resolve(projectRoot, 'route-aliases.json'), 'utf8')) as Record<string,string>));
export function assetKey(request: string) {
  const url = new URL(request, 'http://localhost');
  if (url.pathname !== '/_next/image') return url.pathname;
  url.searchParams.sort();
  return url.pathname + '?' + url.searchParams.toString();
}
const assets = new Map(manifest.map(asset => [assetKey(asset.request), asset]));
const comparisonSource = new Map([['approach-1', 'rundeck'], ['approach-2', 'stackstorm'], ['approach-3', 'backstage'], ['approach-4', 'port'], ['approach-5', 'n8n']]);
const homeTitle = 'Tervix | A clearer way to run your work';
const homeDescription = 'Bring requests, decisions, and follow-up work into one shared view.';
const homeIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#88a995"/><circle cx="23" cy="10" r="12" fill="#6bb0c0" opacity=".8"/><circle cx="10" cy="25" r="11" fill="#d4a574" opacity=".7"/></svg>');
function homePage(html: string) {
  const headEnd = html.indexOf('</head>');
  if (headEnd < 0) return html;
  let head = html.slice(0, headEnd);
  head = head.replace(/<link rel="preload"[^>]*(?:as="image"|imageSrcSet=)[^>]*\/>/g, '');
  head = head.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  head = head.replaceAll('__tervix_chunk_reload', '__tervix_chunk_reload');
  head = head.replace(/<title>[^<]*<\/title>/, `<title>${homeTitle}</title>`);
  head = head.replace(/<meta\s+(?:name|property)="[^"]+"\s+content="[^"]*"\s*\/>/g, (tag) => {
    const key = /(?:name|property)="([^"]+)"/.exec(tag)?.[1];
    const values: Record<string,string> = {
      description: homeDescription, 'application-name': 'Tervix', author: 'Tervix', creator: 'Tervix', publisher: 'Tervix',
      keywords: 'team planning, shared work, decisions', robots: 'noindex, nofollow', googlebot: 'noindex, nofollow',
      'og:title': homeTitle, 'og:description': homeDescription, 'og:url': 'https://hexmix.dev/tervix',
      'og:site_name': 'Tervix', 'og:image': 'http://127.0.0.1:3012/media-893f0f560686fc.png', 'og:image:alt': 'A palette color gradient',
      'twitter:title': homeTitle, 'twitter:description': homeDescription, 'twitter:image': 'http://127.0.0.1:3012/media-893f0f560686fc.png',
    };
    return key && Object.hasOwn(values, key) ? tag.replace(/content="[^"]*"/, `content="${values[key]}"`) : tag;
  });
  head = head.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, '<link rel="canonical" href="https://hexmix.dev/tervix"/>');
  head = head.replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*\/>/g, `<link rel="icon" href="${homeIcon}"/>`);
  return head + '<link rel="stylesheet" href="/render-assets/tervix/home-media.css"><script src="/render-assets/tervix/home-media.js" defer></script><script src="/color-bridge.js" defer></script>' + html.slice(headEnd);
}
const csp = ["default-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'", "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.cloudflarestream.com", "media-src 'self' blob: https://*.cloudflarestream.com", "worker-src 'self' blob:", "base-uri 'self'", "form-action 'none'", "object-src 'none'", "frame-ancestors 'self'"].join('; ');
// shortcut: this sample is fixed; add a backend when real workflow generation is required.
const demoWorkflow = {
  success: true,
  name: 'Demo workflow: review a new request',
  explanation: 'This fixed local example is not generated from your prompt. It does not run actions or send data to a service.',
  trigger_config: { source: 'request' },
  definition: {
    nodes: [
      { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'New request', integration: 'form' } },
      { id: 'review', type: 'action', position: { x: 240, y: 0 }, data: { label: 'Review the request', integration: 'workspace' } },
      { id: 'approval', type: 'approval', position: { x: 480, y: 0 }, data: { label: 'Request approval', integration: 'team' } },
      { id: 'notify', type: 'action', position: { x: 720, y: 0 }, data: { label: 'Notify the team', integration: 'team' } },
    ],
    edges: [
      { id: 'trigger-review', source: 'trigger', target: 'review' },
      { id: 'review-approval', source: 'review', target: 'approval' },
      { id: 'approval-notify', source: 'approval', target: 'notify', label: 'Approved' },
    ],
  },
};
export async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, body: string | Uint8Array, type = 'text/plain; charset=utf-8') => {
      if (type.startsWith('text/html')) body = String(body).replace('<html', '<html data-static-source-page="true"').replaceAll('http://127.0.0.1:3000', '').replaceAll('/_next/', '/render-assets/tervix/_next/').replaceAll('/mintlify-assets/render-assets/tervix/_next/', '/render-assets/tervix/mintlify-assets/_next/').replaceAll('/media-', '/render-assets/tervix/media-').replaceAll('/subpages.', '/render-assets/tervix/subpages.').replaceAll('/demo.', '/render-assets/tervix/demo.');
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    try {
      const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (rawPath.split(/[\\/]/).some(part => part === '..') || rawPath.includes('\0')) return send(400, 'Invalid path');
      const url = new URL(req.url || "/", 'http://localhost');
      if (url.pathname === '/api/playground/generate' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 16384) return send(413, JSON.stringify({ error: 'Request is too large.' }), 'application/json');
        }
        let data;
        try { data = JSON.parse(body); } catch { return send(400, JSON.stringify({ error: 'Send valid JSON.' }), 'application/json'); }
        if (typeof data?.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 1000) return send(400, JSON.stringify({ error: 'Enter a prompt with 1 to 1000 characters.' }), 'application/json');
        return send(200, JSON.stringify(demoWorkflow), 'application/json');
      }
      if (url.pathname === '/api/playground/generate' || !['GET', 'HEAD'].includes(req.method || '')) {
        res.setHeader('Allow', url.pathname === '/api/playground/generate' ? 'POST' : 'GET, HEAD');
        return send(405, 'Method not allowed');
      }
      const asset = assets.get(assetKey(req.url || "/"));
      const comparison = /^\/compare\/(approach-[1-5])$/.exec(url.pathname);
      const localPath = comparison ? `/compare/${comparison[1]}` : routeAliases.get(url.pathname) || url.pathname.replace(/^\/documentation(?=\/)/, '');
      const localPage = !/\.[^/]+$/.test(url.pathname) && url.pathname !== '/' ? `subpages${localPath}.html` : null;
      const localAsset = /^\/(?:subpages\.(?:css|js)|home-media\.(?:css|js)|demo\.(?:css|js)|auth\.(?:css|js)|status\.(?:css|js)|media-placeholder\.png|media-[a-f0-9]+\.(?:png|jpe?g|svg|webp)|llms\.txt|mintlify-assets\/_next\/static\/chunks\/[\w-]+\.css)$/.test(url.pathname) ? url.pathname.slice(1) : null;
      const file = ['/', '/index.html'].includes(url.pathname) ? 'index.html' : /^\/b\/[A-Za-z0-9]{10}$/.test(url.pathname) || url.pathname === '/demo' ? 'demo.html' : ['/login','/register'].includes(url.pathname) ? 'auth.html' : url.pathname === '/status' ? 'status.html' : url.pathname === '/contact' || url.pathname === '/about' ? 'subpages/forward-deployed.html' : url.pathname === '/developers' ? 'subpages/workflows/cli.html' : asset?.file || localAsset || localPage;
      if (file) {
        const path = resolve(root, file);
        if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) return send(400, 'Invalid path');
        let body;
        try { body = await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error; body = null; }
        if (body) {
          const type = asset?.type || (file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.png') ? 'image/png' : file.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8');
          return send(200, file === 'index.html' ? homePage(body.toString()) : body, type);
        }
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/') || /\.[^/]+$/.test(url.pathname)) return send(404, 'Not found');
      return send(404, 'Page not available');
    } catch (error) { send(error instanceof URIError || (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 : 500, 'Request failed'); }
}
export function createCloneServer() {
  return createServer(handleRequest);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createCloneServer().listen(Number(process.env.PORT || 3012), '127.0.0.1', () => console.log(`Tervix preview: http://127.0.0.1:${process.env.PORT || 3012}`));
}
