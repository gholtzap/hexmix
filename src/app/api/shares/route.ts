import { maxStateBytes } from '../../../../browser/public/share-state';
import { parseSnapshot, saveSnapshot } from '@/lib/snapshot-store';

const requests = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = (process.env.VERCEL ? request.headers.get('x-forwarded-host') : null) ?? request.headers.get('host') ?? new URL(request.url).host;
  let sameOrigin = false;
  try { const source = new URL(origin ?? ''); sameOrigin = source.host === host && ['http:', 'https:'].includes(source.protocol); } catch { /* Missing or invalid origins are rejected. */ }
  if (!sameOrigin) return Response.json({ error: 'Use the share control on this site.' }, { status: 403 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  const now = Date.now();
  for (const [key, item] of requests) if (item.until < now) requests.delete(key);
  const usage = requests.get(ip) ?? { count: 0, until: now + 3_600_000 };
  if (++usage.count > 60 || requests.size > 5000) return Response.json({ error: 'Try again later.' }, { status: 429 });
  requests.set(ip, usage);
  if (!request.body) return Response.json({ error: 'Missing view.' }, { status: 400 });
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maxStateBytes + 20_000) { await reader.cancel(); return Response.json({ error: 'This view is too large.' }, { status: 413 }); }
    chunks.push(value);
  }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return Response.json({ error: 'Invalid view.' }, { status: 400 }); }
  const snapshot = parseSnapshot(value);
  if (!snapshot) return Response.json({ error: 'Invalid view.' }, { status: 400 });
  try { return Response.json({ id: await saveSnapshot(snapshot) }, { status: 201, headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'The share link could not be saved.' }, { status: 503 }); }
}
