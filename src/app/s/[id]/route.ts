import { notFound } from 'next/navigation';
import { loadSnapshot } from '@/lib/snapshot-store';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const value = await loadSnapshot(id);
  if (!value) notFound();
  const url = new URL(value.href, 'https://hexmix.invalid');
  url.searchParams.set('snapshot', id);
  return new Response(null, { status: 307, headers: { Location: url.pathname + url.search + url.hash, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex' } });
}
