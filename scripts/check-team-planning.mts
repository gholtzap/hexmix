import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {expectUI} from 'lintapple/playwright';

const directory = 'artifacts/team-planning';
await mkdir(directory, {recursive: true});
const browser = await chromium.launch();
const reports = [];
const errors = [];

async function checkUI(page, width, state) {
  let report = {findings: []};
  let attached = false;
  try {
    await expectUI(page, {attach: async (_, attachment) => {
      report = JSON.parse(String(attachment.body));
      attached = true;
    }});
  } catch (error) {
    if (!attached) throw error;
  }
  reports.push({width, state, report});
  await page.screenshot({path: `${directory}/${width}-${state}.png`});
}

try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000/avenlo/products/videocall-agent');
    const frame = page.frameLocator('iframe');
    await frame.locator('html[data-editor-site="avenlo"]').waitFor();
    assert.equal(await frame.locator('h1').innerText(), 'Bring your team\ninto focus');
    assert.equal(await frame.locator('main .vca > section').count(), 9);
    assert.equal(await frame.locator('.htl__step:visible').count(), 3);
    assert.equal(await frame.locator('.vs__mock').count(), 4);
    const text = await frame.locator('body').innerText();
    assert.doesNotMatch(text, /Avenlo|Combinator|Storylane|Navattic|Supademo|Consensus/);
    const mediaBefore = await frame.locator('.vs__mock').first().evaluate(element => getComputedStyle(element).backgroundImage);
    await checkUI(page, width, 'light');

    if (width === 390) await frame.locator('.nav__toggle').click();
    else await frame.getByRole('button', {name: 'Products', exact: true}).click();
    await checkUI(page, width, 'menu');
    if (width === 390) await frame.locator('.nav__toggle').click();
    else await frame.getByRole('button', {name: 'Products', exact: true}).click();

    await frame.getByRole('button', {name: 'Work stays visible'}).click();
    assert.equal(await frame.getByRole('button', {name: 'Work stays visible'}).getAttribute('aria-expanded'), 'true');
    assert.equal(await frame.locator('#vca-safe-panel-1').isVisible(), true);
    await checkUI(page, width, 'accordion');

    await frame.getByRole('link', {name: 'Explore view'}).first().click();
    await frame.getByRole('dialog', {name: 'Team planning'}).waitFor();
    await checkUI(page, width, 'dialog');
    await frame.getByRole('button', {name: 'Close preview'}).click();
    await frame.getByRole('link', {name: 'Explore view'}).last().click();
    await frame.getByRole('dialog', {name: 'Team planning'}).waitFor();
    await frame.getByRole('button', {name: 'Close preview'}).click();

    const email = frame.locator('#cta-watch');
    await email.fill('not-an-email');
    await frame.locator('.cta__form button[type="submit"]').click();
    assert.equal(await email.evaluate(element => (element as HTMLInputElement).validity.typeMismatch), true);
    assert.equal(await frame.locator('#demo-popup').evaluate(element => (element as HTMLDialogElement).open), false);
    await email.fill('team@example.com');
    await frame.locator('.cta__form button[type="submit"]').click();
    await frame.getByRole('dialog', {name: 'Team planning'}).waitFor();
    await frame.getByRole('button', {name: 'Close preview'}).click();

    await page.getByRole('button', {name: 'Use dark palette'}).click();
    await frame.locator('html[data-editor-light="false"]').waitFor();
    const mediaAfter = await frame.locator('.vs__mock').first().evaluate(element => getComputedStyle(element).backgroundImage);
    assert.notEqual(mediaBefore, mediaAfter);
    await checkUI(page, width, 'dark');
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${directory}/ui.json`, JSON.stringify({reports, errors}, null, 2));
}
const findings = reports.reduce((total, item) => total + item.report.findings.length, 0);
console.log(`${reports.length} Team planning states checked; ${findings} UI findings`);
if (findings) process.exitCode = 1;
