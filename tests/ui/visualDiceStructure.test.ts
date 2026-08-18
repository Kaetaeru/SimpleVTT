import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge = readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf-8");
const physics = readFileSync(new URL("../../src/PhysicsDice3D.tsx",import.meta.url),"utf-8");
const css = readFileSync(new URL("../../src/visual-dice.css",import.meta.url),"utf-8");
const main = readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");
const creationAbilities = readFileSync(new URL("../../src/character-create/V09Abilities.tsx",import.meta.url),"utf-8");
const levelUp = readFileSync(new URL("../../src/LevelUpV10.tsx",import.meta.url),"utf-8");

test("visual dice bridge keeps authoritative results in a body-level fast physics replay", () => {
  assert.match(bridge,/createPortal/);
  assert.match(bridge,/document\.body/);
  assert.match(bridge,/buildVisualDiceRoll/);
  assert.match(bridge,/visual-dice-overlay v09/);
  assert.match(bridge,/reduced\?650:1480/);
  assert.match(bridge,/visual-roll-notice/);
  assert.match(bridge,/visual-roll-reel/);
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

test("runtime replay uses depth travel, a transparent screen-floor treatment, and authoritative result convergence", () => {
  assert.match(physics,/cinematic/);
  assert.match(physics,/-8\.4-index\*\.36/);
  assert.match(physics,/body\.velocity\.set\([^\n]*10\.4\+Math\.random\(\)\*2\.4/);
  assert.match(physics,/desiredIndex/);
  assert.match(css,/\.visual-dice-overlay\.v09:after/);
  assert.match(css,/\.visual-dice-world/);
});

test("physics dice respect reduced motion and keep legacy aggregate fallback explicit", () => {
  assert.match(physics,/reducedMotion/);
  assert.match(bridge,/prefers-reduced-motion/);
  assert.match(bridge,/legacy aggregate/);
});
