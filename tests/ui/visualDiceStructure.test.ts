import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge = readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf-8");
const css = readFileSync(new URL("../../src/visual-dice.css",import.meta.url),"utf-8");
const main = readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");
const creationAbilities = readFileSync(new URL("../../src/character-create/V09Abilities.tsx",import.meta.url),"utf-8");
const levelUp = readFileSync(new URL("../../src/LevelUpV10.tsx",import.meta.url),"utf-8");

test("visual dice bridge keeps authoritative results visible in a body-level replay overlay", () => {
  assert.match(bridge,/createPortal/);
  assert.match(bridge,/document\.body/);
  assert.match(bridge,/buildVisualDiceRoll/);
  assert.match(bridge,/visual-dice-overlay/);
  assert.match(bridge,/1550/);
  assert.match(bridge,/authoritative result · visual replay/);
  assert.match(main,/VisualDiceBridge/);
  assert.doesNotMatch(bridge,/querySelector<HTMLElement>\("\.dice-animation"\)/);
});

test("visual dice renderer is a shared component for creation, level-up, and runtime replay", () => {
  assert.match(bridge,/export function VisualDiceTray/);
  assert.match(creationAbilities,/import \{ VisualDiceTray \} from "\.\.\/VisualDiceBridge"/);
  assert.match(creationAbilities,/label="능력치 4d6 × 6"/);
  assert.match(creationAbilities,/sides:6 as const/);
  assert.match(levelUp,/import \{ VisualDiceTray \} from "\.\/VisualDiceBridge"/);
  assert.match(levelUp,/rollLevelUpHitDie/);
  assert.match(levelUp,/label=\{`히트 다이스 d\$\{plan\.hp\.hitDie\}`\}/);
  assert.match(levelUp,/levelup-hit-die-panel/);
});

test("visual dice renderer uses real 3D CSS transforms and supports all standard polyhedral dice", () => {
  assert.match(css,/perspective:/);
  assert.match(css,/transform-style:preserve-3d/);
  assert.match(css,/rotateX\(/);
  assert.match(css,/rotateY\(/);
  assert.match(css,/visual-dice-overlay/);
  assert.match(css,/visual-dice-stage\.compact/);
  for (const sides of [4,6,8,10,12,20]) assert.match(css,new RegExp(`\\.visual-die-shell\\.d${sides}`));
});

test("visual dice renderer respects reduced motion and labels legacy aggregate fallback explicitly", () => {
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/data-motion="reduced"/);
  assert.match(bridge,/legacy aggregate/);
});
