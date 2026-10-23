import { strict as assert } from "node:assert";
import { chromium } from "playwright";

const appUrl = process.env.APP_URL;
if (!appUrl) throw new Error("APP_URL is required");

const css = ":root { --color-text: #111111; --color-background: #eeeeee; --color-primary: #aabbcc; --color-secondary: #ddeeff; --color-accent: #112233; } /* Old token: --color-primary: #ff0000; */";
const expectedColors = "111111-eeeeee-aabbcc-ddeeff-112233";

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  try {
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.locator("main[data-app-ready]").waitFor({ state: "visible", timeout: 10000 });

    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(appUrl).origin,
    });
    await page.evaluate(async (value) => {
      await navigator.clipboard.writeText(value);
    }, css);

    const pasteButton = page.getByRole("button", { name: "Paste palette or theme" });
    await pasteButton.waitFor({ state: "visible", timeout: 5000 });
    await pasteButton.click();

    try {
      await page.waitForFunction(
        (expected) => new URL(window.location.href).searchParams.get("colors") === expected,
        expectedColors,
        { timeout: 5000, polling: 100 },
      );
    } catch {
      // The final URL assertion below reports an incorrect saved palette.
    }

    assert.equal(
      new URL(page.url()).searchParams.get("colors"),
      expectedColors,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
