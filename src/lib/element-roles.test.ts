import assert from "node:assert/strict";
import test from "node:test";
import { isElementSelection, maxElementRoles, maxElementRolesLength, readElementRoles, setElementRoles, type ElementRole } from "./element-roles.ts";

test("element selection requires a color and finite bounds", () => {
  const selection = { path: "/avenlo", selector: "body > h1:nth-of-type(1)", label: "Heading", property: "color", oldColor: "rgb(12, 10, 9)", bounds: { left: 10, right: 110, top: 20, bottom: 60 } };
  assert.equal(isElementSelection(selection), true);
  assert.equal(isElementSelection({ ...selection, bounds: { ...selection.bounds, left: Infinity } }), false);
  assert.equal(isElementSelection({ ...selection, oldColor: undefined }), false);
});

test("element role assignments survive a share link", () => {
  const values: ElementRole[] = [{ path: "/render/avenlo/", selector: "body > main:nth-of-type(1) > button:nth-of-type(2)", property: "background", role: "secondary" }];
  const query = new URLSearchParams();
  setElementRoles(query, values);
  assert.deepEqual(readElementRoles(`?${query}`), values);
  setElementRoles(query, []);
  assert.equal(query.has("elements"), false);
});

test("image role assignments survive a share link", () => {
  const values: ElementRole[] = [{ path: "/avenlo", selector: "body > main:nth-of-type(1) > img:nth-of-type(1)", property: "image", role: "accent" }];
  const query = new URLSearchParams();
  setElementRoles(query, values);
  assert.deepEqual(readElementRoles(`?${query}`), values);
});

test("invalid assignments from links are ignored", () => {
  const query = new URLSearchParams({ elements: JSON.stringify([
    { path: "/", selector: "body > button:nth-of-type(1)", property: "background", role: "accent" },
    { path: "/", selector: "body:has(*)", property: "background", role: "accent" },
    { path: "/", selector: "body > button:nth-of-type(1)", property: "background", role: "unknown" },
  ]) });
  assert.deepEqual(readElementRoles(`?${query}`), [{ path: "/", selector: "body > button:nth-of-type(1)", property: "background", role: "accent" }]);
  assert.deepEqual(readElementRoles(`?${new URLSearchParams({ elements: "x".repeat(maxElementRolesLength + 1) })}`), []);
  assert.deepEqual(readElementRoles(`?${new URLSearchParams({ elements: JSON.stringify(Array(maxElementRoles + 1).fill({ path: "/", selector: "body > button:nth-of-type(1)", property: "background", role: "accent" })) })}`), []);
});
