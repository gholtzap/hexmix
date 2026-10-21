import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { expectUI } from "lintapple/playwright";
import { defaultDarkPalette, initialPalette, paletteQuery } from "../src/lib/palette.ts";

const origin = process.env.APP_URL || "http://127.0.0.1:3000";
const output = "artifacts/color-map";
const paths = ["/avenlo", "/avenlo/products/team-planning", "/tervix", "/orvian", "/nuvexa", "/dashboards/ai-chatbot", "/dashboards/infra-dashboard"];
const reports: { path: string; width: number; theme: string; state: string; count: number; report?: { findings?: unknown[] } }[] = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const path of paths) for (const width of [390, 1440]) for (const [theme, palette] of [["light", initialPalette], ["dark", defaultDarkPalette]] as const) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(`${origin}${path}?${paletteQuery(palette)}`);
    await page.locator("[data-app-ready]").waitFor();
    await page.locator('iframe.website-frame[data-preview-ready="true"]').waitFor();
    const frame = page.frameLocator("iframe.website-frame");
    await frame.locator('html[data-hexmix-inspector="true"]').waitFor();
    if (width === 390) {
      await page.getByRole("button", { name: "More tools" }).click();
      if ((path === "/avenlo" || path === "/dashboards/ai-chatbot") && theme === "light") {
        let menuReport: { findings?: unknown[] } | undefined;
        try {
          await expectUI(page, { attach: async (_, data) => { menuReport = JSON.parse(String(data.body)); } });
        } catch (error) {
          if (!menuReport) throw error;
        }
        reports.push({ path, width, theme, state: "more tools", count: 0, report: menuReport });
      }
      await page.getByRole("menuitem", { name: "Show color map" }).click();
    } else await page.getByRole("button", { name: "Show color map" }).click();
    await frame.locator("[data-hexmix-role]").first().waitFor();
    const count = await frame.locator("[data-hexmix-role]").count();
    assert(count > 0, `No mapped colors on ${path} at ${width}px in ${theme} mode`);
    let report: { findings?: unknown[] } | undefined;
    try {
      await expectUI(page, { attach: async (_, data) => { report = JSON.parse(String(data.body)); } });
    } catch (error) {
      if (!report) throw error;
    }
    reports.push({ path, width, theme, state: "color map", count, report });
    if ((path === "/avenlo" || path === "/dashboards/infra-dashboard") && theme === "light") {
      await page.screenshot({ path: `${output}/${path.slice(1).replaceAll("/", "-")}-${width}-${theme}.png` });
    }
    if (path === "/avenlo" && theme === "light") {
      const beforePath = new URL(page.url()).pathname;
      await frame.getByRole("link", { name: "Explore a sample plan now" }).click();
      await page.locator(".element-panel").waitFor();
      assert.equal(new URL(page.url()).pathname, beforePath);
      let selectionReport: { findings?: unknown[] } | undefined;
      try {
        await expectUI(page, { attach: async (_, data) => { selectionReport = JSON.parse(String(data.body)); } });
      } catch (error) {
        if (!selectionReport) throw error;
      }
      reports.push({ path, width, theme, state: "mapped element selected", count, report: selectionReport });
      await page.getByRole("button", { name: "Change new color" }).click();
      await page.getByRole("menuitem", { name: "Secondary" }).click();
      assert.equal(JSON.parse(new URL(page.url()).searchParams.get("elements") || "[]")[0].role, "secondary");
      await page.getByRole("button", { name: "Use old color" }).click();
      await page.keyboard.press("Escape");
    }
    await page.getByRole("region", { name: "Color map" }).getByRole("button", { name: "Hide color map" }).click();
    await frame.locator("[data-hexmix-role]").first().waitFor({ state: "detached" });
    const target = path.endsWith("infra-dashboard") ? frame.getByRole("button", { name: width === 390 ? "Open sidebar" : "Projects", exact: true }).last() : frame.locator("h1").first();
    await target.click({ modifiers: ["Alt"], force: true });
    await page.locator(".element-panel").waitFor();
    assert.equal(await page.locator('button[aria-label="Show color map"]').getAttribute("aria-pressed"), "false");
    if (path === "/avenlo" && width === 390 && theme === "light") {
      await page.keyboard.press("Escape");
      await frame.getByRole("button", { name: "Open menu" }).click({ modifiers: ["Alt"] });
      await page.locator(".element-panel").waitFor();
      assert.equal(await page.locator(".element-panel .element-swatch-fill").first().evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
    }
    console.log(`${path} ${width}px ${theme}: ${count} mapped elements; Alt+click works`);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/ui-report.json`, JSON.stringify(reports, null, 2));
}
console.log(`${reports.length} map states checked; ${reports.reduce((sum, item) => sum + (item.report?.findings?.length ?? 0), 0)} UI findings.`);
