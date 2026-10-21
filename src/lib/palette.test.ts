import { createHash } from "node:crypto";
import { sanzoCombinations } from "./sanzo-wada.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  restorePalettes,
  matchesPalette,
  presets,
  paletteQuery,
  defaultDarkPalette,
  foregroundForSurface,
  contrast,
  isPalette,
  isDarkPalette,
  initialPalette,
  readPalette,
  randomPalette,
  paletteCSS,
  samePalette,
  presetForTheme,
} from "./palette.ts";
test("contrast matches black and white and identical colors", () => {
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.equal(contrast("#ffffff", "#000000"), 21);
});
test("palette comparison ignores hex letter case", () => {
  assert.equal(samePalette(initialPalette, { ...initialPalette, accent: "#A8655F" }), true);
  assert.equal(samePalette(initialPalette, { ...initialPalette, accent: "#000000" }), false);
});
test("shared palettes reject malformed and extra colors", () => {
  assert.deepEqual(
    readPalette("?colors=0c0a09-ffffff-e98878-ffe291-a8655f"),
    initialPalette,
  );
  assert.equal(readPalette("?colors=zzzzzz-fffefa-da8c7c-f4dcad-ac514b"), null);
  assert.equal(readPalette("?colors=000000"), null);
  assert.equal(
    readPalette("?colors=0c0a09-ffffff-e98878-ffe291-a8655f-ffffff"),
    null,
  );
  assert.equal(isPalette(null), false);
});
test("generated palettes keep their mode and readable text", () => {
  for (const dark of [false, true]) {
    for (let i = 0; i < 100; i++) {
      const p = randomPalette(dark);
      assert.ok(isPalette(p));
      assert.equal(isDarkPalette(p), dark);
      assert.ok(contrast(p.text, p.background) > 10);
    }
  }
  assert.equal(isDarkPalette(randomPalette()), false);
});
test("export contains all palette roles and fonts", () => {
  const css = paletteCSS(initialPalette, "Georgia", "Inter");
  assert.ok(css.includes("--color-accent: #a8655f;"));
  assert.ok(css.includes("--font-heading: Georgia;"));
  assert.ok(css.includes("--color-on-dark: #ffffff;"));
});

test("saved collections retain all valid records and get unique persistent IDs", () => {
  const records = Array.from({ length: 3000 }, (_, i) => ({ name: `Palette ${i}`, colors: initialPalette }));
  const restored = restorePalettes([...records, { name: "Invalid", colors: {} }]);
  assert.equal(restored.length, 3000);
  assert.equal(new Set(restored.map((item) => item.id)).size, 3000);
  assert.deepEqual(restorePalettes(restored), restored);
  assert.throws(() => restorePalettes({}));
  const duplicates = restorePalettes([{ ...restored[0], id: "same" }, { ...restored[1], id: "same" }]);
  assert.notEqual(duplicates[0].id, duplicates[1].id);
});
test("palette searches combine name and color traits with filters", () => {
  const filters = { query: "blue pastel", color: "blue", mode: "light", style: "pastel" };
  assert.equal(matchesPalette(presets[2], filters), true);
  assert.equal(matchesPalette(presets[2], { ...filters, mode: "dark" }), false);
  assert.equal(matchesPalette(presets[2], { ...filters, query: "missing" }), false);
  assert.equal(matchesPalette(presets[4], { query: " warm ", color: "", mode: "dark", style: "" }), true);
});

test("preview links carry all five colors into the editor", () => {
  for (const palette of [initialPalette, randomPalette(true)]) {
    const url = new URL(`/dashboards/ai-chatbot?${paletteQuery(palette)}`, "https://example.test");
    assert.deepEqual(readPalette(url.search), palette);
    assert.equal(url.pathname, "/dashboards/ai-chatbot");
  }
});

test("all 348 Sanzo presets keep source data and numbers with neutral bases", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(sanzoCombinations)).digest("hex"),
    "b688466015884901188ec8d041de1d75687c08f628c17bff22005f2f645ab06f");
  assert.deepEqual([2, 3, 4].map(size => sanzoCombinations.filter(colors => colors.length === size).length), [120, 120, 108]);
  const sanzo = presets.filter(item => item.id.startsWith("sanzo-wada-"));
  assert.equal(sanzo.length, 348);
  assert.equal(new Set(presets.map(item => item.id)).size, presets.length);
  sanzo.forEach((item, index) => {
    assert.equal(item.id, `sanzo-wada-${index + 1}`);
    assert.equal(item.name, `Sanzo Wada ${index + 1}`);
    assert.ok(isPalette(item.colors));
    const source = sanzoCombinations[index];
    assert.deepEqual(item.colors, { text: "#171717", background: "#ffffff", primary: source[0], secondary: source[1], accent: source[2] ?? source[1] });
    const dark = presetForTheme(item, true);
    assert.equal(dark.colors.text, "#ededed");
    assert.equal(dark.colors.background, "#171717");
    for (const role of ["primary", "secondary", "accent"] as const) assert.equal(dark.colors[role], item.colors[role]);
    assert.ok(contrast(dark.colors.text, dark.colors.background) > 10);
    assert.deepEqual(presetForTheme(dark, false), item);
    assert.ok(contrast(item.colors.text, item.colors.background) >= 4.5);
    assert.deepEqual(readPalette(paletteQuery(item.colors)), item.colors);
    assert.ok(matchesPalette(item, { query: "Sanzo Wada", color: "", mode: "", style: "" }));
  });
});

test("the default preview starts dark and keeps readable text", () => {
  assert.equal(isDarkPalette(defaultDarkPalette), true);
  assert.ok(contrast(defaultDarkPalette.text, defaultDarkPalette.background) > 10);
  assert.equal(isDarkPalette(initialPalette), false);
});

test("surface text keeps the chosen color only where it is readable", () => {
  assert.equal(foregroundForSurface("#000000", "#ffffff"), "#000000");
  assert.equal(foregroundForSurface("#000000", "#1c1917"), "#ffffff");
  assert.equal(foregroundForSurface("#ffffff", "#ffffff"), "#000000");
  assert.equal(foregroundForSurface("#ffffff", "#1c1917"), "#ffffff");
  assert.equal(foregroundForSurface("#203247", "#f7faff"), "#203247");
  for (const background of ["#808080", "#e98878", "#ffe291", "#a8655f"]) {
    const text = foregroundForSurface("#777777", background);
    assert.ok(contrast(text, background) >= 4.5);
  }
});

test("theme adaptation keeps other presets and stored palettes unchanged", () => {
  const standard = presets.find(item => item.id === "blue-hour")!;
  assert.equal(presetForTheme(standard, true), standard);
  const stored = {id: "saved-sanzo", name: "Saved colors", colors: { ...initialPalette, background: "#de4500" }};
  assert.deepEqual(restorePalettes([stored]), [stored]);
});
