import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { expectUI } from "lintapple/playwright";
import { defaultDarkPalette, initialPalette, paletteQuery } from "../src/lib/palette.ts";

const origin = process.env.APP_URL || "http://127.0.0.1:3000";
const output = "artifacts/gradient-inspector";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results: { path: string; target: string; width: number; theme: string; role: string; findings: unknown[] }[] = [];
try {
  for (const [path, name, selector, role] of [
    ["/avenlo", "text", ".hero__typed", "secondary"],
    ["/avenlo", "media", ".hero__yc", "secondary"],
    ["/tervix", "css", 'div.aspect-\\[16\\/9\\].origin-top', "accent"],
  ] as const) for (const width of [390, 1440]) for (const [theme, palette] of [["light", initialPalette], ["dark", defaultDarkPalette]] as const) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${origin}${path}?${paletteQuery(palette)}`);
    await page.locator("[data-app-ready]").waitFor();
    const frame = page.frameLocator("iframe.website-frame");
    await frame.locator('html[data-hexmix-inspector="true"]').waitFor();
    await frame.locator('html[data-contrast-ready="true"]').waitFor();
    await page.locator('iframe.website-frame[data-preview-ready="true"]').waitFor();
    const target = frame.locator(selector).first();
    const before = await target.evaluate(element => {
      const style = getComputedStyle(element);
      return { image: style.backgroundImage, color: style.backgroundColor, blend: style.backgroundBlendMode };
    });
    assert.notEqual(before.image, "none");
    await target.click({ modifiers: ["Alt"], position: { x: 5, y: 5 } });
    await page.locator(".element-panel").waitFor();
    const old = page.locator(".element-panel .element-swatch-fill").first();
    const next = page.locator(".element-panel .element-swatch-fill").last();
    assert.equal(await old.evaluate(element => getComputedStyle(element).backgroundImage), before.image);
    if (path === "/tervix") assert.equal(before.color, "rgba(0, 0, 0, 0)");
    await page.getByRole("button", { name: "Change new color" }).click();
    await page.getByRole("menuitem", { name: role[0].toUpperCase() + role.slice(1) }).click();
    await page.waitForFunction(({ selector, image, role }: { selector: string; image: string; role: string }) => {
      const element = document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector(selector);
      return element && getComputedStyle(element).backgroundImage === image
        && getComputedStyle(element).backgroundBlendMode.startsWith("luminosity")
        && (element as HTMLElement).style.backgroundColor === `var(--p-${role})`;
    }, { selector, image: before.image, role });
    assert.equal(await next.evaluate(element => getComputedStyle(element).backgroundImage), before.image);
    let report: { findings?: unknown[] } | undefined;
    try { await expectUI(page, { attach: async (_, data) => { report = JSON.parse(String(data.body)); } }); }
    catch (error) { if (!report) throw error; }
    results.push({ path, target: name, width, theme, role, findings: report?.findings ?? [] });
    await page.getByRole("button", { name: "Use old color" }).click();
    await page.waitForFunction(({ selector, before }: { selector: string; before: { image: string; color: string; blend: string } }) => {
      const element = document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.backgroundImage === before.image && style.backgroundColor === before.color && style.backgroundBlendMode === before.blend;
    }, { selector, before });
    await context.close();
    console.log(`${path} ${name} ${width}px ${theme}: gradient kept and restored; ${report?.findings?.length ?? 0} UI findings`);
  }
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(results, null, 2));
}
assert.equal(results.length, 12);
