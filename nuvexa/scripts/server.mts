import type {IncomingMessage, ServerResponse} from 'node:http';
import type {CapturedAsset} from '../../scripts/lib/assets.mts';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';

const projectRoot = resolve(process.cwd(), process.cwd().endsWith('/nuvexa') ? '' : 'nuvexa');
const root = resolve(projectRoot, 'public') + sep;
const manifest: CapturedAsset[] = JSON.parse(await readFile(resolve(projectRoot, 'assets.json'), 'utf8'));
export function assetKey(request: string) {
  const url = new URL(request, 'http://localhost');
  url.searchParams.sort();
  return url.pathname + url.search;
}
const exact = new Map(manifest.map(asset => [assetKey(asset.request), asset]));
const variants = new Map(manifest.map(asset => [new URL(asset.request, 'http://localhost').pathname, asset]));
const csp = ["default-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "media-src 'self' blob: data:", "connect-src 'self'", "frame-src 'none'", "object-src 'none'", "form-action 'none'", "base-uri 'self'", "frame-ancestors 'self'"].join('; ');

export async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, body: string | Uint8Array) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    try {
      const raw = decodeURIComponent((req.url || '/').split('?')[0]);
      if (raw.split(/[\\/]/).includes('..') || raw.includes('\0') || raw.includes('\\')) return send(400, 'Invalid path');
      if (!['GET', 'HEAD'].includes(req.method || '')) {
        res.setHeader('Allow', 'GET, HEAD');
        return send(405, 'Method not allowed');
      }
      const url = new URL(req.url || "/", 'http://localhost');
      const asset = exact.get(assetKey(req.url || "/")) || variants.get(url.pathname);
      const page = url.pathname.replace(/\/$/, '').slice(1);
      let pageFile = null;
      if (page && !page.includes('.')) {
        try {
          const candidate = `pages/${page}.html`;
          if ((await stat(resolve(root, candidate))).isFile()) pageFile = candidate;
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
      const file = ['/', '/index.html'].includes(url.pathname) ? 'index.html' : asset?.file || pageFile || (['subpages.js', 'subpages.css'].includes(page) ? page : null);
      if (!file) {
        if (/^\/(?:assets|api)(?:\/|$)/.test(url.pathname) || /\.[^/]+$/.test(url.pathname)) return send(404, 'Not found');
        return send(404, 'Page not found');
      }
      const path = resolve(root, file);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) return send(400, 'Invalid path');
      const info = await stat(path);
      if (!info.isFile()) return send(404, 'Not found');
      if (file.endsWith('.html')) {
        const body = (await readFile(path, 'utf8')).replace('</head>', '<script src="/color-bridge.js" defer></script></head>').replaceAll('http://127.0.0.1:3000', '').replaceAll('/assets/framerusercontent.com/', '/render-assets/nuvexa/assets/framerusercontent.com/').replaceAll('/subpages.', '/render-assets/nuvexa/subpages.');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      let start = 0, end = info.size - 1, status = 200;
      res.setHeader('Content-Type', asset?.type || ({ 'subpages.js': 'text/javascript; charset=utf-8', 'subpages.css': 'text/css; charset=utf-8' })[file] || 'text/html; charset=utf-8');
      if (asset?.type.startsWith('video/')) {
        res.setHeader('Accept-Ranges', 'bytes');
        if (req.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
          if (match && (match[1] || match[2]) && match.slice(1).every(value => !value || Number.isSafeInteger(Number(value)))) {
            if (match[1]) {
              start = Number(match[1]);
              end = match[2] ? Math.min(Number(match[2]), end) : end;
            } else {
              start = Math.max(0, info.size - Number(match[2]));
              if (Number(match[2]) === 0) start = info.size;
            }
          } else start = NaN;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
            res.setHeader('Content-Range', `bytes */${info.size}`);
            return send(416, 'Invalid range');
          }
          status = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
        }
      }
      res.writeHead(status, { 'Content-Length': Math.max(0, end - start + 1) });
      if (req.method === 'HEAD' || info.size === 0) return res.end();
      await pipeline(createReadStream(path, { start, end }), res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      send(error instanceof URIError ? 400 : (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500, 'Request failed');
    }
}
export function createCloneServer() {
  return createServer(handleRequest);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createCloneServer().listen(Number(process.env.PORT || 3014), '127.0.0.1', () => console.log(`Nuvexa preview: http://127.0.0.1:${process.env.PORT || 3014}`));
}
