import { roles, type Role } from "./palette.ts";

export const elementProperties = ["background", "color", "border", "fill", "stroke", "image"] as const;
export type ElementProperty = (typeof elementProperties)[number];
export type ElementRole = { path: string; selector: string; property: ElementProperty; role: Role };
export type ElementSelection = { path: string; selector: string; label: string; property: ElementProperty; oldColor: string; oldImage?: string; bounds: { left: number; right: number; top: number; bottom: number } };
export const maxElementRoles = 24;
export const maxElementRolesLength = 24000;

const selectorPattern = /^body(?: > [a-z][a-z0-9-]*:nth-of-type\([1-9]\d*\)){1,24}$/;

export function isElementSelection(value: unknown): value is ElementSelection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ElementSelection>;
  return typeof item.path === "string" && item.path.startsWith("/") && item.path.length <= 240
    && typeof item.selector === "string" && item.selector.length <= 900 && selectorPattern.test(item.selector)
    && typeof item.label === "string" && item.label.length <= 80
    && elementProperties.includes(item.property as ElementProperty)
    && typeof item.oldColor === "string" && item.oldColor.length <= 120
    && (item.oldImage === undefined || (typeof item.oldImage === "string" && item.oldImage.length <= 16000))
    && !!item.bounds && [item.bounds.left, item.bounds.right, item.bounds.top, item.bounds.bottom].every(value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 100000);
}

export function isElementRole(value: unknown): value is ElementRole {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ElementRole>;
  return typeof item.path === "string" && item.path.startsWith("/") && item.path.length <= 240
    && typeof item.selector === "string" && item.selector.length <= 900 && selectorPattern.test(item.selector)
    && elementProperties.includes(item.property as ElementProperty)
    && roles.includes(item.role as Role);
}

export function readElementRoles(search: string): ElementRole[] {
  const encoded = new URLSearchParams(search).get("elements");
  if (!encoded || encoded.length > maxElementRolesLength) return [];
  try {
    const parsed: unknown = JSON.parse(encoded);
    if (!Array.isArray(parsed) || parsed.length > maxElementRoles) return [];
    return parsed.filter(isElementRole);
  } catch {
    return [];
  }
}

export function setElementRoles(query: URLSearchParams, values: ElementRole[]) {
  if (values.length) query.set("elements", JSON.stringify(values));
  else query.delete("elements");
}
