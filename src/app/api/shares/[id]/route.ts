import { loadSnapshot } from '@/lib/snapshot-store';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const value = await loadSnapshot((await context.params).id);
    return value ? Response.json(value, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }) : Response.json({ error: 'This shared view was not found.' }, { status: 404 });
  } catch { return Response.json({ error: 'This shared view could not be loaded.' }, { status: 503 }); }
}
