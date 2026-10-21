import { contrast, foregroundForSurface } from "../../browser/public/palette-contrast.ts";
export { contrast, foregroundForSurface };
import { sanzoCombinations } from "./sanzo-wada.ts";

export const roles = [
  "text",
  "background",
  "primary",
  "secondary",
  "accent",
] as const;
export type Role = (typeof roles)[number];
export type Palette = Record<Role, string>;
export type SavedPalette = { id: string; name: string; colors: Palette };
export const initialPalette: Palette = {
  text: "#0c0a09",
  background: "#ffffff",
  primary: "#e98878",
  secondary: "#ffe291",
  accent: "#a8655f",
};
export const defaultDarkPalette: Palette = {
  ...initialPalette,
  text: initialPalette.background,
  background: initialPalette.text,
};

export function samePalette(a: Palette, b: Palette) {
  return roles.every((role) => a[role].toLowerCase() === b[role].toLowerCase());
}
export const quickPickPresets = [
  { id: "peach-honey", name: "Peach & honey", colors: initialPalette },
  {
    id: "garden-party",
    name: "Garden party",
    colors: {
      text: "#25382d",
      background: "#f8fbf5",
      primary: "#8eac85",
      secondary: "#e1e8c4",
      accent: "#526c46",
    },
  },
  {
    id: "blue-hour",
    name: "Blue hour",
    colors: {
      text: "#203247",
      background: "#f7faff",
      primary: "#82a4d3",
      secondary: "#d6e4f4",
      accent: "#3d66a0",
    },
  },
  {
    id: "plum-perfect",
    name: "Plum perfect",
    colors: {
      text: "#36263a",
      background: "#fffaff",
      primary: "#b595c1",
      secondary: "#eddaeb",
      accent: "#895d93",
    },
  },
  {
    id: "after-hours",
    name: "After hours",
    colors: {
      text: "#f3eee7",
      background: "#242522",
      primary: "#cda37b",
      secondary: "#4d493e",
      accent: "#e7c099",
    },
  },
];
const neutralBases = {
  light: { text: "#171717", background: "#ffffff" },
  dark: { text: "#ededed", background: "#171717" },
};
export type PaletteMode = "light" | "dark";
export function paletteForMode(palette: Palette, mode: PaletteMode): Palette {
  return { ...palette, ...neutralBases[mode] };
}
export const presets: SavedPalette[] = [
  ...quickPickPresets,
  ...sanzoCombinations.map(([primary, secondary, accent = secondary], index) => {
    return {
      id: `sanzo-wada-${index + 1}`,
      name: `Sanzo Wada ${index + 1}`,
      colors: { ...neutralBases.light, primary, secondary, accent },
    };
  }),
];
export function presetForTheme(preset: SavedPalette, dark: boolean): SavedPalette {
  if (!preset.id.startsWith("sanzo-wada-")) return preset;
  return { ...preset, colors: paletteForMode(preset.colors, dark ? "dark" : "light") };
}
export function isPalette(value: unknown): value is Palette {
  return (
    typeof value === "object" &&
    value !== null &&
    roles.every((role) =>
      /^#[\da-f]{6}$/i.test(String((value as Palette)[role])),
    )
  );
}
export function surfaceForegrounds(palette: Palette) {
  return {
    text: foregroundForSurface(palette.text, palette.text),
    background: foregroundForSurface(palette.text, palette.background),
    secondary: foregroundForSurface(palette.text, palette.secondary),
    primary: foregroundForSurface(palette.text, palette.primary),
    accent: foregroundForSurface(palette.text, palette.accent),
    dark: foregroundForSurface(palette.text, "#1c1917"),
  };
}
export function paletteCSS(palette: Palette, heading: string, body: string) {
  return `:root {\n${roles.map((role) => `  --color-${role}: ${palette[role]};`).join("\n")}\n${Object.entries(surfaceForegrounds(palette)).map(([surface, color]) => `  --color-on-${surface}: ${color};`).join("\n")}\n  --font-heading: ${heading};\n  --font-body: ${body};\n}\n`;
}
export const paletteExportFormats = {
  css: { label: "CSS", filename: "hue-palette.css", mime: "text/css" },
  tailwind: { label: "Tailwind", filename: "hue-palette.tailwind.css", mime: "text/css" },
  json: { label: "JSON", filename: "hue-palette.json", mime: "application/json" },
} as const;
export type PaletteExportFormat = keyof typeof paletteExportFormats;
export function paletteExport(format: PaletteExportFormat, palette: Palette, heading: string, body: string) {
  if (format === "json") return JSON.stringify({
    colors: {
      ...Object.fromEntries(roles.map(role => [role, palette[role]])),
      ...Object.fromEntries(Object.entries(surfaceForegrounds(palette)).map(([surface, color]) => [`on-${surface}`, color])),
    },
    fonts: { heading, body },
  }, null, 2) + "\n";
  const css = paletteCSS(palette, heading, body);
  return format === "tailwind" ? css.replace(":root {", "@theme {") : css;
}
export function readPalette(search: string, key = "colors"): Palette | null {
  const colors = new URLSearchParams(search).get(key)?.split("-");
  if (!colors || colors.length !== 5) return null;
  const palette = Object.fromEntries(
    roles.map((role, i) => [role, `#${colors[i]}`]),
  );
  return isPalette(palette) ? palette : null;
}
export function isDarkPalette(palette: Palette): boolean {
  return contrast(palette.background, "#000000") < 4;
}
export function randomPalette(dark = false): Palette {
  const h = Math.floor(Math.random() * 360);
  const hex = (hue: number, s: number, l: number) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + hue / 30) % 12;
      return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  return {
    text: hex(h, 0.18, dark ? 0.98 : 0.15),
    background: hex(h, 0.35, dark ? 0.15 : 0.98),
    primary: hex(h, 0.42, 0.67),
    secondary: hex((h + 30) % 360, 0.6, 0.84),
    accent: hex(h, 0.4, 0.39),
  };
}

export function restorePalettes(value: unknown): SavedPalette[] {
  if (!Array.isArray(value)) throw new Error("Invalid palette collection");
  const ids = new Set<string>();
  const reserved = new Set(value.map(item => item?.id));
  return value.filter((item) => item && typeof item.name === "string" && isPalette(item.colors))
    .map((item, index) => {
      let id = typeof item.id === "string" && item.id && !ids.has(item.id)
        ? item.id : `restored-${index}`;
      while (ids.has(id) || (id !== item.id && reserved.has(id))) id += "-";
      ids.add(id);
      return { id, name: item.name, colors: item.colors };
    });
}

export function paletteTraits(colors: Palette) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(colors.primary.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue = delta === 0 ? 0 : ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
  const color = saturation < 0.12 ? "neutral" : hue < 20 || hue >= 345 ? "red" : hue < 50 ? "orange" : hue < 75 ? "yellow" : hue < 165 ? "green" : hue < 255 ? "blue" : hue < 290 ? "purple" : "pink";
  return {
    color,
    mode: isDarkPalette(colors) ? "dark" : "light",
    style: saturation < 0.35 ? "muted" : lightness > 0.65 ? "pastel" : "bold",
    temperature: hue < 75 || hue >= 290 ? "warm" : "cool",
  };
}

export type PaletteFilters = { query: string; color: string; mode: string; style: string };
export function matchesPalette(item: { name: string; colors: Palette }, filters: PaletteFilters) {
  const traits = paletteTraits(item.colors);
  const words = `${item.name} ${Object.values(traits).join(" ")} ${roles.map((role) => item.colors[role]).join(" ")}`.toLowerCase();
  return filters.query.toLowerCase().trim().split(/\s+/).every((word) => words.includes(word))
    && (!filters.color || filters.color === traits.color)
    && (!filters.mode || filters.mode === traits.mode)
    && (!filters.style || filters.style === traits.style);
}

export function paletteQuery(palette: Palette, key = "colors"): string {
  return new URLSearchParams({ [key]: roles.map((role) => palette[role].slice(1)).join("-") }).toString();
}
