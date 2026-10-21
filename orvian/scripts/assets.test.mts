import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('page images and scene textures are local and present', async () => {
  const root = new URL('../../', import.meta.url);
  const content = new URL('src/previews/orvian/content/',root);
  const media = new URL('public/',root);
  let scenes = 0;
  for (const name of await readdir(content)) {
    const html = await readFile(new URL(name,content), 'utf8');
    assert(!html.includes('<script'), `${name} contains a source script`);
    for (const [, src] of html.matchAll(/src="([^"]+)"/g)) {
      assert(src.startsWith('/') || src.startsWith('data:'), `${name}: remote image ${src}`);
      if (src.startsWith('/')) await access(new URL(src.slice(1),media));
    }
    for (const [, project] of html.matchAll(/data-scene="([^"]+)"/g)) {
      const scene = await readFile(new URL(`scenes/${project}.json`,media), 'utf8');
      JSON.parse(scene);
      assert(!scene.includes('https://'), `${project}: remote texture`);
      scenes++;
    }
  }
  assert.equal(scenes, 6);
  await access(new URL('assets/media-aaa4cd4140d257.png',media));
});
