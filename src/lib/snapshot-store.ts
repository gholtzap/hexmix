import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { get, put } from '@vercel/blob';
import { maxStateBytes } from '../../browser/public/share-state';
import type { SharedSnapshot } from './shared-link';
import { parseSnapshot } from './shared-snapshot';
export { parseSnapshot } from './shared-snapshot';
const directory = () => process.env.SHARE_STORE_DIR ?? join(process.cwd(), '.local', 'shares');
export async function saveSnapshot(value: SharedSnapshot) {
  const id = randomBytes(16).toString('hex');
  const text = JSON.stringify(value);
  if (process.env.BLOB_READ_WRITE_TOKEN) await put(`shares/${id}.json`, text, { access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' });
  else {
    if (process.env.VERCEL) throw new Error('Share storage is not configured.');
    await mkdir(directory(), { recursive: true });
    await writeFile(join(directory(), `${id}.json`), text, { flag: 'wx', mode: 0o600 });
  }
  return id;
}
export async function loadSnapshot(id: string): Promise<SharedSnapshot | null> {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  try {
    let text: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const result = await get(`shares/${id}.json`, { access: 'public' });
      if (!result || result.statusCode !== 200) return null;
      text = await new Response(result.stream).text();
    } else {
      if (process.env.VERCEL) return null;
      text = await readFile(join(directory(), `${id}.json`), 'utf8');
    }
    return text.length <= maxStateBytes + 20_000 ? parseSnapshot(JSON.parse(text)) : null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
