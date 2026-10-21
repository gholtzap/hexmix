import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { checkPage } from 'lintapple';
import { expectUI } from 'lintapple/playwright';
import { initialPalette, defaultDarkPalette, paletteQuery } from '../src/lib/palette.ts';
import { clickToolbarAction } from './lib/studio-toolbar.mts';
const base = process.env.APP_URL || 'http://127.0.0.1:3320';
const out = 'artifacts/hx-013'; await mkdir(out, { recursive: true });
const policy = JSON.parse(await readFile('ui-policy.json', 'utf8'));
const browser = await chromium.launch(), actions = [], reports = [], errors = [];
async function audit(page: Page, frame: FrameLocator, state: string) {
  let host = { findings: [] }, attached = false;
  try { await expectUI(page, { attach: async (_, data) => { attached = true; host = JSON.parse(String(data.body)); } }, policy); }
  catch (error) { if (!attached) throw error; }
  reports.push({ state, width: page.viewportSize()!.width, surface: 'studio', report: host });
  const native = await (await frame.locator('html').elementHandle())!.ownerFrame();
  reports.push({ state, width: page.viewportSize()!.width, surface: 'preview', report: await checkPage(native!, policy) });
}
try {
  for (const width of [390, 1440]) for (const mode of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: mode, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${base}/dashboards/ai-chatbot?${paletteQuery(mode === 'light' ? initialPalette : defaultDarkPalette)}`);
      await page.locator('[data-app-ready]').waitFor();
      const frame = page.frameLocator('iframe'); await frame.locator('[data-app-ready]').waitFor();
      const openSidebar = async () => { if (width === 390) await frame.getByRole('button', { name: 'Open sidebar', exact: true }).click(); };
      const newChat = async () => { await openSidebar(); await frame.getByRole('button', { name: 'New chat', exact: true }).click(); };
      const search = async (text: string) => { await openSidebar(); await frame.getByRole('button', { name: 'Search', exact: true }).click(); await frame.getByRole('searchbox', { name: 'Search chats', exact: true }).fill(text); };
      const send = async (text: string) => { await frame.getByRole('textbox', { name: 'Ask Pebble', exact: true }).fill(text); await frame.getByRole('textbox', { name: 'Ask Pebble', exact: true }).press('Enter'); };
      const title = 'Review the launch palette';
      await send(title); await send('Keep the second message too');
      await newChat(); await search(title);
      await frame.getByRole('dialog').getByRole('button', { name: title, exact: true }).waitFor();
      await audit(page, frame, `${mode}-search-history`);
      await frame.getByRole('dialog').getByRole('button', { name: title, exact: true }).click();
      assert.equal(await frame.locator('.chat-message.user').count(), 2);
      assert.equal(await frame.locator('.chat-message.assistant').count(), 2);
      assert.match(await frame.locator('.chat-conversation').innerText(), /Keep the second message too/);
      await audit(page, frame, `${mode}-restored-chat`);
      await newChat(); await send(title); await newChat(); await search(title);
      await frame.getByRole('dialog').getByRole('button', { name: `${title} (2)`, exact: true }).click();
      assert.equal(await frame.locator('.chat-message.user').count(), 1);
      await audit(page, frame, `${mode}-separate-duplicate-title`);
      await frame.getByRole('button', { name: 'Temporary chat', exact: true }).click();
      await send('Temporary draft 952'); await newChat(); await search('Temporary draft 952');
      assert.match(await frame.getByRole('dialog').innerText(), /No chats found/);
      await audit(page, frame, `${mode}-temporary-chat-not-listed`);

      await page.screenshot({ path: `${out}/${width}-${mode}.png` });
      actions.push({ width, mode, passed: true }); console.log(width, mode, 'passed');
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify({ actions, errors, reports }, null, 2));
}
const findings = reports.reduce((count, item) => count + item.report.findings.length, 0);
console.log(`${actions.length} action flows; ${reports.length} UI scans; ${findings} findings.`);
if (findings) process.exitCode = 1;
