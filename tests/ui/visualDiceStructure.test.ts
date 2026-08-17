import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge = readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf-8");
const physics = readFileSync(new URL("../../src/PhysicsDice3D.tsx",import.meta.url),"utf-8");
const main = readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");
const creationAbilities = readFileSync(new URL("../../src/character-create/V09Abilities.tsx",import.meta.url),"utf-8");
const levelUp = readFileSync(new URL("../../src/LevelUpV10.tsx",import.meta.url),"utf-8");

test("visual dice bridge keeps authoritative results visible in a body-level physics replay overlay", () => {
  assert.match(bridge,/createPortal/);
  assert.match(bridge,/document\.body/);
  assert.match(bridge,/buildVisualDiceRoll/);
  assert.match(bridge,/visual-dice-overlay/);
  assert.match(bridge,/2700/);
  assert.match(bridge,/authoritative result · physics replay/);
  assert.match(main,/VisualDiceBridge/);
});

test("visual dice renderer remains shared by creation, level-up, and runtime replay", () => {
  assert.match(bridge,/export function VisualDiceTray/);
  assert.match(creationAbilities,/import \{ VisualDiceTray \} from "\.\.\/VisualDiceBridge"/);
  assert.match(creationAbilities,/label="능력치 4d6 × 6"/);
  assert.match(creationAbilities,/sides:6 as const/);
  assert.match(levelUp,/import \{ VisualDiceTray \} from "\.\/VisualDiceBridge"/);
  assert.match(levelUp,/rollLevelUpHitDie/);
  assert.match(levelUp,/label=\{`히트 다이스 d\$\{plan\.hp\.hitDie\}`\}/);
});

test("visual dice renderer uses WebGL physics and actual polyhedral meshes", () => {
  assert.match(bridge,/PhysicsDice3D/);
  assert.match(physics,/WebGLRenderer/);
  assert.match(physics,/CANNON\.World/);
  assert.match(physics,/gravity/);
  assert.match(physics,/friction/);
  assert.match(physics,/restitution/);
  assert.match(physics,/angularVelocity/);
  for (const geometry of ["TetrahedronGeometry","BoxGeometry","OctahedronGeometry","CylinderGeometry","DodecahedronGeometry","IcosahedronGeometry"]) assert.match(physics,new RegExp(geometry));
  assert.doesNotMatch(bridge,/visual-die-facet|transform-style:preserve-3d/);
});

test("physics dice respect reduced motion and keep legacy aggregate fallback explicit", () => {
  assert.match(physics,/reducedMotion/);
  assert.match(bridge,/prefers-reduced-motion/);
  assert.match(bridge,/legacy aggregate/);
});
