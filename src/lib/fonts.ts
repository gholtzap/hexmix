import { fonts } from "../../browser/public/font-catalog.ts";
export { fonts };

export type FontName = keyof typeof fonts;

export const fontPairs = [
  { heading: "System", body: "System" },
  { heading: "Arial", body: "Verdana" },
  { heading: "Verdana", body: "Arial" },
  { heading: "Inter", body: "Inter" },
  { heading: "Space Grotesk", body: "DM Sans" },
  { heading: "Manrope", body: "Plus Jakarta Sans" },
  { heading: "Playfair Display", body: "Lora" },
  { heading: "Outfit", body: "Inter" },
] satisfies { heading: FontName; body: FontName }[];
