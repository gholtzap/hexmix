import assert from "node:assert/strict";
import {test} from "node:test";
import {compile} from "tailwindcss";
import {initialPalette, paletteCSS, paletteExport, paletteExportFormats, roles, surfaceForegrounds} from "./palette.ts";

test("exports preserve selected colors, readable surface colors, and fonts", () => {
  const heading = "Arial, Helvetica, sans-serif", body = "Verdana, Geneva, sans-serif";
  assert.equal(paletteExport("css", initialPalette, heading, body), paletteCSS(initialPalette, heading, body));
  const json = JSON.parse(paletteExport("json", initialPalette, heading, body));
  for (const role of roles) assert.equal(json.colors[role], initialPalette[role]);
  for (const [surface, color] of Object.entries(surfaceForegrounds(initialPalette))) assert.equal(json.colors[`on-${surface}`], color);
  assert.deepEqual(json.fonts, {heading, body});
  assert.equal(paletteExportFormats.json.mime, "application/json");
  assert.equal(new Set(Object.values(paletteExportFormats).map(format => format.filename)).size, 3);
});

test("Tailwind export compiles to color and font utilities with the installed Tailwind", async () => {
  const theme = paletteExport("tailwind", initialPalette, "Arial, sans-serif", "Verdana, sans-serif");
  assert.ok(theme.startsWith("@theme {"));
  const compiler = await compile(`${theme}\n@tailwind utilities;`);
  const css = compiler.build(["bg-primary", "text-on-primary", "font-heading", "font-body"]);
  for (const utility of [".bg-primary", ".text-on-primary", ".font-heading", ".font-body"]) assert.ok(css.includes(utility), utility);
  assert.ok(css.includes(`--color-primary: ${initialPalette.primary}`));
  assert.ok(css.includes("--font-heading: Arial, sans-serif"));
});
