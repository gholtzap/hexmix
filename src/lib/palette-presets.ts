import { sanzoCombinations } from "./sanzo-wada.ts";
import { initialPalette, paletteForMode, quickPickPresets, type SavedPalette } from "./palette.ts";

export const presets: SavedPalette[] = [
  ...quickPickPresets,
  ...sanzoCombinations.map(([primary, secondary, accent = secondary], index) => {
    return {
      id: `sanzo-wada-${index + 1}`,
      name: `Sanzo Wada ${index + 1}`,
      colors: paletteForMode({ ...initialPalette, primary, secondary, accent }, "light"),
    };
  }),
];
export function presetForTheme(preset: SavedPalette, dark: boolean): SavedPalette {
  if (!preset.id.startsWith("sanzo-wada-")) return preset;
  return { ...preset, colors: paletteForMode(preset.colors, dark ? "dark" : "light") };
}
