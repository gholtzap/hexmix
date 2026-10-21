import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { expectUI } from "lintapple/playwright";
import { defaultDarkPalette, initialPalette, paletteQuery } from "../src/lib/palette.ts";

const origin = process.env.APP_URL || "http://127.0.0.1:3000";
const output = "artifacts/element-inspector";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const uiReports = [];
async function startSelecting(page: import("playwright").Page) {
  const button = page.locator('button[aria-label="Select an element"]');
  if (await button.isVisible()) await button.click();
  else {
    await page.getByRole("button", { name: "More tools" }).click();
    await page.getByRole("menuitem", { name: "Edit element" }).click();
  }
}
try {
  for (const path of ["/avenlo", "/avenlo/products/team-planning", "/tervix", "/orvian", "/nuvexa", "/dashboards/ai-chatbot", "/dashboards/infra-dashboard"]) {
    for (const width of [390, 1440]) for (const [theme, palette] of [["light", initialPalette], ["dark", defaultDarkPalette]] as const) {
      console.log(`Checking ${path} at ${width}px in ${theme} mode.`);
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await page.goto(`${origin}${path}?${paletteQuery(palette)}`);
      await page.locator("[data-app-ready]").waitFor();
      const frame = page.frameLocator("iframe.website-frame");
      await frame.locator('html[data-hexmix-inspector="true"]').waitFor();
      await frame.locator('html[data-contrast-ready="true"]').waitFor();
      await frame.locator("body").waitFor({ state: "visible" });
      const outline = frame.locator("[data-hexmix-inspector-outline]");
      assert.equal(await outline.isVisible(), false);
      if (path === "/avenlo") {
        const word = frame.locator(".hero__typed");
        await word.click({ modifiers: ["Alt"] });
        await page.locator('.element-panel[aria-label^="Colors for Element:"]').waitFor();
        assert.match(await page.locator(".element-panel .element-swatch-fill").first().evaluate(element => getComputedStyle(element).backgroundImage), /^linear-gradient/);
        await page.getByRole("button", { name: "Change new color" }).click();
        await page.getByRole("menuitem", { name: "Accent" }).click();
        await page.waitForFunction((accent: string) => {
          const word = document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector<HTMLElement>(".hero__typed");
          return word && getComputedStyle(word).backgroundColor === `rgb(${[1, 3, 5].map(index => Number.parseInt(accent.slice(index, index + 2), 16)).join(", ")})`
            && getComputedStyle(word).color === "rgba(0, 0, 0, 0)"
            && getComputedStyle(word).backgroundImage.startsWith("linear-gradient")
            && getComputedStyle(word).backgroundBlendMode === "luminosity";
        }, palette.accent);
        await page.getByRole("button", { name: "Use old color" }).click();
        await page.waitForFunction(() => getComputedStyle(document.querySelector<HTMLIFrameElement>("iframe.website-frame")!.contentDocument!.querySelector(".hero__typed")!).backgroundImage.startsWith("linear-gradient"));
      }
      if (path === "/tervix") {
        const gradient = frame.locator('div.aspect-\\[16\\/9\\].origin-top').first();
        const originalImage = await gradient.evaluate(element => getComputedStyle(element).backgroundImage);
        assert.match(originalImage, /^radial-gradient/);
        await gradient.click({ modifiers: ["Alt"], position: { x: 5, y: 5 } });
        await page.locator(".element-panel").waitFor();
        assert.match(await page.locator(".element-panel .element-swatch-fill").first().evaluate(element => getComputedStyle(element).backgroundImage), /^radial-gradient/);
        await page.getByRole("button", { name: "Change new color" }).click();
        await page.getByRole("menuitem", { name: "Accent" }).click();
        await page.waitForFunction((image: string) => {
          const target = document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector('div.aspect-\\[16\\/9\\].origin-top');
          return target && getComputedStyle(target).backgroundImage === image && getComputedStyle(target).backgroundBlendMode.startsWith("luminosity");
        }, originalImage);
        assert.equal(await page.locator(".element-panel .element-swatch-fill").last().evaluate(element => getComputedStyle(element).backgroundImage), originalImage);
        await page.getByRole("button", { name: "Use old color" }).click();
        await page.waitForFunction((image: string) => {
          const target = document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector('div.aspect-\\[16\\/9\\].origin-top');
          return target && getComputedStyle(target).backgroundImage === image && getComputedStyle(target).backgroundColor === "rgba(0, 0, 0, 0)";
        }, originalImage);
      }
      if (path === "/avenlo" && width === 1440 && theme === "light") {
        const link = frame.getByRole("banner").getByRole("link", { name: "Talk to sales" });
        const beforeFrameUrl = await frame.locator("html").evaluate(element => element.ownerDocument.location.href);
        await link.click({ modifiers: ["Alt"] });
        await page.locator(".element-panel").waitFor();
        await outline.waitFor({ state: "visible" });
        assert.equal(await frame.locator("html").evaluate(element => element.ownerDocument.location.href), beforeFrameUrl);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".element-panel").count(), 0);
        await outline.waitFor({ state: "hidden" });
        const image = frame.locator("img.caller--shota").first();
        const originalSource = await image.getAttribute("src");
        await image.click({ modifiers: ["Alt"] });
        await page.locator(".element-panel").waitFor();
        const imageBox = await image.boundingBox(), outlineBox = await outline.boundingBox();
        assert(imageBox && outlineBox && Math.abs(imageBox.x - outlineBox.x) < 1 && Math.abs(imageBox.y - outlineBox.y) < 1 && Math.abs(imageBox.width - outlineBox.width) < 1);
        await page.getByRole("button", { name: "Change new color" }).click();
        await page.getByRole("menuitem", { name: "Accent" }).click();
        await frame.locator('img.caller--shota[data-editor-gradient-role="accent"]').first().waitFor();
        await page.waitForFunction((accent: string) => {
          const image = document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector<HTMLImageElement>("img.caller--shota");
          return image && decodeURIComponent(image.src).includes(`stop-color="${accent}"`);
        }, palette.accent);
        assert.notEqual(await image.getAttribute("src"), originalSource);
        await page.getByRole("button", { name: "Use old color" }).click();
        await frame.locator("img.caller--shota:not([data-editor-gradient-role])").first().waitFor();
        await page.waitForFunction((oldSource: string) => document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector<HTMLImageElement>("img.caller--shota")?.getAttribute("src") === oldSource, originalSource);
      }
      if (path === "/avenlo" && width === 390 && theme === "dark") {
        await page.locator('iframe.website-frame[data-preview-ready="true"]').waitFor();
        const logo = frame.locator('header.nav img[alt="Avenlo"]').first();
        const originalSource = await logo.getAttribute("src");
        await logo.click({ modifiers: ["Alt"] });
        await page.locator('.element-panel[aria-label="Colors for Image"]').waitFor();
        await page.getByRole("button", { name: "Change new color" }).click();
        await page.getByRole("menuitem", { name: "Accent" }).click();
        await frame.locator('header.nav img[data-editor-gradient-role="accent"]').waitFor();
        await page.waitForFunction((oldSource: string) => document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector<HTMLImageElement>('header.nav img[alt="Avenlo"]')?.src !== oldSource, originalSource);
        await page.screenshot({ path: `${output}/avenlo-image-390-dark.png` });
        await page.getByRole("button", { name: "Use old color" }).click();
      }
      if (path === "/avenlo") {
        const transparentTarget = width === 390 ? frame.getByRole("button", { name: "Open menu" }) : frame.getByRole("banner").getByRole("link", { name: "Customers" });
        assert.equal(await transparentTarget.evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
        await transparentTarget.click({ modifiers: ["Alt"] });
        await page.locator(".element-panel").waitFor();
        assert.equal(await page.locator(".element-panel .element-swatch-fill").first().evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
        await page.getByRole("button", { name: "Change new color" }).click();
        await page.getByRole("menuitem", { name: "Primary" }).click();
        const [assignment] = JSON.parse(new URL(page.url()).searchParams.get("elements") || "[]");
        assert.equal(assignment.property, "background");
        await frame.locator(`${assignment.selector}[style*="var(--p-primary)"]`).waitFor();
        await page.getByRole("button", { name: "Change new color" }).click();
        const original = page.getByRole("menuitem", { name: "Original" });
        assert.equal(await original.locator(".element-role-chip-original").evaluate(element => getComputedStyle(element).backgroundImage.startsWith("conic-gradient")), true);
        let originalReport: { findings?: unknown[] } | undefined;
        try {
          await expectUI(page, { attach: async (_, data) => { originalReport = JSON.parse(String(data.body)); } });
        } catch (error) {
          if (!originalReport) throw error;
        }
        uiReports.push({ path, width, theme, state: "original menu", report: originalReport });
        if ((width === 390 && theme === "dark") || (width === 1440 && theme === "light")) await page.screenshot({ path: `${output}/avenlo-original-${width}-${theme}.png` });
        await original.click();
        await page.waitForFunction((selector: string) => {
          const element = document.querySelector<HTMLIFrameElement>("iframe.website-frame")?.contentDocument?.querySelector(selector);
          return element && getComputedStyle(element).backgroundColor === "rgba(0, 0, 0, 0)";
        }, assignment.selector);
        assert.equal(new URL(page.url()).searchParams.has("elements"), false);
      }
      const target = path.endsWith("infra-dashboard") ? (width === 390 ? frame.getByRole("button", { name: "Open sidebar", exact: true }).last() : frame.getByRole("button", { name: "Projects", exact: true }).first())
        : path === "/nuvexa" && width === 390 ? frame.getByRole("button", { name: "Menu", exact: true }) : frame.locator("h1").first();
      const beforeUrl = page.url();
      const expanded = await target.getAttribute("aria-expanded");
      await target.click({ force: true, modifiers: ["Alt"] });
      await page.locator(".element-panel").waitFor();
      await outline.waitFor({ state: "visible" });
      assert.equal(await outline.evaluate(element => getComputedStyle(element).pointerEvents), "none");
      assert.equal(await page.locator('button[aria-label="Select an element"]').getAttribute("aria-pressed"), "false");
      assert.equal(page.url(), beforeUrl);
      if (expanded !== null) assert.equal(await target.getAttribute("aria-expanded"), expanded);
      assert.deepEqual(await page.locator(".element-panel > * > span:first-child").allTextContents(), ["Old", "New"]);
      assert.equal(await page.getByRole("button", { name: "Change new color" }).evaluate(element => document.activeElement === element), true);
      const panelBox = await page.locator(".element-panel").boundingBox();
      const targetBox = await target.boundingBox();
      assert(panelBox && targetBox && panelBox.x >= 8 && panelBox.y >= 8 && panelBox.x + panelBox.width <= width - 8 && panelBox.y + panelBox.height <= (width === 390 ? 844 : 900) - 8);
      const gapX = Math.max(targetBox.x - panelBox.x - panelBox.width, panelBox.x - targetBox.x - targetBox.width, 0);
      const gapY = Math.max(targetBox.y - panelBox.y - panelBox.height, panelBox.y - targetBox.y - targetBox.height, 0);
      assert(Math.hypot(gapX, gapY) <= 20);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".element-panel").count(), 0);
      await outline.waitFor({ state: "hidden" });
      await startSelecting(page);
      await frame.locator('html[style*="crosshair"]').waitFor();
      await target.click({ force: true });
      await page.locator(".element-panel").waitFor();
      await outline.waitFor({ state: "visible" });
      const oldColor = await page.locator(".element-panel .element-swatch-fill").first().evaluate(element => getComputedStyle(element).backgroundColor);
      await page.getByRole("button", { name: "Change new color" }).click();
      await page.locator(".element-role-menu").waitFor();
      if (path === "/avenlo") {
        let menuReport: { findings?: unknown[] } | undefined;
        try {
          await expectUI(page, { attach: async (_, data) => { menuReport = JSON.parse(String(data.body)); } });
        } catch (error) {
          if (!menuReport) throw error;
        }
        uiReports.push({ path, width, theme, state: "role menu", report: menuReport });
      }
      await page.getByRole("menuitem", { name: "Accent" }).click();
      const assignments = JSON.parse(new URL(page.url()).searchParams.get("elements") || "[]");
      assert.equal(assignments.length, 1);
      assert.equal(assignments[0].role, "accent");
      const cssProperty = { background: "background-color", color: "color", border: "border-color", fill: "fill", stroke: "stroke" }[assignments[0].property as "background" | "color" | "border" | "fill" | "stroke"];
      await frame.locator(`${assignments[0].selector}[style*="var(--p-accent)"]`).waitFor();
      assert.equal(await frame.locator(assignments[0].selector).evaluate((element, property) => (element as HTMLElement).style.getPropertyValue(property), cssProperty), "var(--p-accent)");
      assert.equal(await page.locator(".element-panel .element-swatch-fill").first().evaluate(element => getComputedStyle(element).backgroundColor), oldColor);
      assert.equal(await page.locator(".element-panel .element-swatch-fill").last().evaluate(element => getComputedStyle(element).backgroundColor), `rgb(${[1, 3, 5].map(index => Number.parseInt(palette.accent.slice(index, index + 2), 16)).join(", ")})`);
      let report: { findings?: unknown[] } | undefined;
      try {
        await expectUI(page, { attach: async (_, data) => { report = JSON.parse(String(data.body)); } });
      } catch (error) {
        if (!report) throw error;
      }
      uiReports.push({ path, width, theme, report });
      await page.screenshot({ path: `${output}/${path.slice(1).replaceAll("/", "-")}-${width}-${theme}.png` });
      if (width === 1440 && theme === "light") {
        if (path === "/avenlo") {
          await page.getByRole("button", { name: "Accent color" }).click();
          await page.getByRole("textbox", { name: "Hex", exact: true }).fill("224466");
          await page.getByRole("textbox", { name: "Hex", exact: true }).press("Enter");
          await page.getByRole("button", { name: "Close color picker" }).click();
          assert.equal(await frame.locator(assignments[0].selector).evaluate((element, property) => getComputedStyle(element).getPropertyValue(property), cssProperty), "rgb(34, 68, 102)");
        }
        await page.getByRole("button", { name: "Share palette" }).click();
        assert.equal(new URL(await page.evaluate(() => navigator.clipboard.readText())).searchParams.get("elements"), new URL(page.url()).searchParams.get("elements"));
        await page.reload();
        await page.locator("[data-app-ready]").waitFor();
        const reloaded = page.frameLocator("iframe.website-frame");
        await reloaded.locator('html[data-hexmix-inspector="true"]').waitFor();
        await reloaded.locator('html[data-contrast-ready="true"]').waitFor();
        await reloaded.locator(assignments[0].selector).waitFor();
        assert.equal(await reloaded.locator(assignments[0].selector).evaluate((element, property) => (element as HTMLElement).style.getPropertyValue(property), cssProperty), "var(--p-accent)");
        await startSelecting(page);
        await reloaded.locator('html[style*="crosshair"]').waitFor();
        await reloaded.locator(assignments[0].selector).dispatchEvent("click");
        await page.locator(".element-panel").waitFor();
        await page.getByRole("button", { name: "Use old color" }).click();
        assert.equal(new URL(page.url()).searchParams.has("elements"), false);
      }
      results.push({ path, width, theme, altClick: true, pointerTool: true });
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/actions.json`, JSON.stringify(results, null, 2));
  await writeFile(`${output}/ui-report.json`, JSON.stringify(uiReports, null, 2));
}
console.log(`Checked ${results.length} element choices.`);
console.log(`${uiReports.reduce((total, item) => total + (item.report?.findings?.length ?? 0), 0)} UI findings.`);
