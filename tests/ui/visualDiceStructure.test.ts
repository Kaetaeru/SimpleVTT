import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge = readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf-8");
const css = readFileSync(new URL("../../src/visual-dice.css",import.meta.url),"utf-8");
const main = readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");

test("visual dice bridge portals authoritative results into the existing resolution animation host", () => {
  assert.match(bridge,/createPortal/);
  assert.match(bridge,/\.dice-animation/);
  assert.match(bridge,/buildVisualDiceRoll/);
  assert.match(bridge,/authoritative result · visual replay/);
  assert.match(main,/VisualDiceBridge/);
});

test("visual dice renderer uses real 3D CSS transforms and supports all standard polyhedral dice", () => {
  assert.match(css,/perspective:/);
  assert.match(css,/transform-style:preserve-3d/);
  assert.match(css,/rotateX\(/);
  assert.match(css,/rotateY\(/);
  for (const sides of [4,6,8,10,12,20]) assert.match(css,new RegExp(`\\.visual-die-shell\\.d${sides}`));
});

test("visual dice renderer respects reduced motion and labels legacy aggregate fallback explicitly", () => {
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/data-motion="reduced"/);
  assert.match(bridge,/legacy aggregate/);
});
