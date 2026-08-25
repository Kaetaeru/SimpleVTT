import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge = readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf-8");
const physics = readFileSync(new URL("../../src/PhysicsDice3D.tsx",import.meta.url),"utf-8");
const css = readFileSync(new URL("../../src/visual-dice.css",import.meta.url),"utf-8");
const diceVisuals = readFileSync(new URL("../../src/app/diceVisuals.ts",import.meta.url),"utf-8");
const sessionRoot = readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf-8");
const sessionCss = readFileSync(new URL("../../src/session-mode.css",import.meta.url),"utf-8");
const main = readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");
const creationAbilities = readFileSync(new URL("../../src/character-create/V09Abilities.tsx",import.meta.url),"utf-8");
const levelUp = readFileSync(new URL("../../src/LevelUpV10.tsx",import.meta.url),"utf-8");
const officialSheet = readFileSync(new URL("../../src/OfficialCharacterSheetPlayScreen.tsx",import.meta.url),"utf-8");
const legacySheet = readFileSync(new URL("../../src/LegacyCharacterSheetPlayScreen.tsx",import.meta.url),"utf-8");
const motionPreferences = readFileSync(new URL("../../src/app/motionPreferences.ts",import.meta.url),"utf-8");

test("visual dice bridge keeps authoritative results in a body-level fast physics replay", () => {
  assert.match(bridge,/createPortal/);
  assert.match(bridge,/document\.body/);
  assert.match(bridge,/buildVisualDiceRoll/);
  assert.match(bridge,/visual-dice-overlay v09/);
  assert.match(diceVisuals,/VISUAL_DICE_REPLAY_MS\s*=\s*1480/);
  assert.match(diceVisuals,/VISUAL_DICE_REDUCED_REPLAY_MS\s*=\s*650/);
  assert.match(bridge,/VISUAL_DICE_REDUCED_REPLAY_MS:VISUAL_DICE_REPLAY_MS/);
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

test("resolved dice remain readable for four seconds and then fade unless a new roll replaces them",()=>{
  assert.match(diceVisuals,/VISUAL_DICE_RESULT_HOLD_MS\s*=\s*4000/);
  assert.match(diceVisuals,/VISUAL_DICE_RESULT_FADE_MS\s*=\s*420/);
  assert.match(bridge,/scheduleExit\(\)/);
  assert.match(bridge,/scheduleReplayExit\(key\)/);
  assert.match(bridge,/setFading\(false\)/);
  assert.match(bridge,/fading\?"is-fading":""/);
  assert.match(css,/\.visual-dice-overlay\.v09\.is-fading\{animation:visual-dice-result-out 420ms/);
  assert.match(css,/@keyframes visual-dice-result-out/);
});

test("standalone sheets publish local authority into the same body-level result presentation",()=>{
  assert.match(bridge,/export function StandaloneDicePresentation/);
  assert.match(bridge,/visual-dice-overlay v09 standalone-roll/);
  assert.match(bridge,/onResolved=\{settle\}/);
  assert.match(officialSheet,/import \{ StandaloneDicePresentation \}/);
  assert.match(legacySheet,/import \{ StandaloneDicePresentation \}/);
  assert.match(officialSheet,/onFinished=\{\(\) => setRoll\(null\)\}/);
  assert.match(legacySheet,/onFinished=\{\(\)=>setRoll\(null\)\}/);
  assert.doesNotMatch(officialSheet,/sheet-roll-result/);
  assert.doesNotMatch(legacySheet,/sheet-roll-result/);
  assert.doesNotMatch(creationAbilities,/screenTable/);
  assert.doesNotMatch(levelUp,/screenTable/);
});

test("visual dice renderer uses WebGL physics and actual polyhedral meshes", () => {
  assert.match(bridge,/PhysicsDice3D/);
  assert.match(physics,/WebGLRenderer/);
  assert.match(physics,/CANNON\.World/);
  assert.match(physics,/gravity/);
  assert.match(physics,/friction/);
  assert.match(physics,/restitution/);
  assert.match(physics,/angularVelocity/);
  for (const geometry of ["TetrahedronGeometry","BoxGeometry","OctahedronGeometry","pentagonalBipyramidGeometry","DodecahedronGeometry","IcosahedronGeometry"]) assert.match(physics,new RegExp(geometry));
  assert.doesNotMatch(physics,/CylinderGeometry/);
  assert.doesNotMatch(bridge,/visual-die-facet|transform-style:preserve-3d/);
});

test("runtime replay uses depth travel, a transparent screen-floor treatment, and authoritative result convergence", () => {
  assert.match(physics,/cinematic/);
  assert.match(physics,/bounds\.maxZ\+CAMERA_LAUNCH_OFFSET/);
  assert.match(physics,/-PRODUCT_PHYSICS\.throwSpeed/);
  assert.match(physics,/enteredTable/);
  assert.match(physics,/PRODUCT_PHYSICS\.throwSpeed/);
  assert.match(physics,/desiredIndex/);
  assert.match(css,/\.visual-dice-overlay\.v09:after/);
  assert.match(css,/\.visual-dice-world/);
});

test("Session result handoff waits for the body-level replay instead of rendering a second dice-stage card underneath it", () => {
  assert.match(sessionRoot,/ANIMATED_RESOLUTION_STAGES/);
  assert.match(sessionRoot,/resolution\.authoritativeDice\.length > 0/);
  assert.match(sessionRoot,/VISUAL_DICE_REDUCED_REPLAY_MS : VISUAL_DICE_REPLAY_MS/);
  assert.match(sessionRoot,/if \(!snapshot \|\| !resolution \|\| diceAnimated\) return null/);
  assert.match(sessionRoot,/if\(passiveRemote\)return <section className="session-resolution-layer session-resolution-notice"/);
  assert.match(sessionRoot,/session-resolution-layer/);
  assert.match(sessionRoot,/resolution\.stateChanges\.slice\(0, 2\)/);
  assert.match(sessionRoot,/onOpenActivity\(event\.currentTarget\)/);
  assert.match(sessionCss,/\.session-resolution-layer\s*\{[\s\S]*bottom:\s*14px/);
  assert.doesNotMatch(sessionRoot,/SessionResolutionFallback/);
  assert.doesNotMatch(sessionRoot,/VisualDiceTray|PhysicsDice3D|createPortal/);
});

test("no-roll and zero-dice resolution stages never force cinematic dice", () => {
  assert.match(bridge,/ANIMATED_STAGES\.has\(resolution\.stage\) && resolution\.authoritativeDice\.length > 0/);
  assert.match(sessionRoot,/ANIMATED_RESOLUTION_STAGES\.has\(resolution\.stage\) && resolution\.authoritativeDice\.length > 0/);
  assert.match(sessionRoot,/stage === "effect-preview"\) return "효과 확인"/);
  assert.match(sessionRoot,/resolution\.compact \|\| resolution\.calculatedOutcome/);
});

test("physics dice respect reduced motion and keep legacy aggregate fallback explicit", () => {
  assert.match(physics,/reducedMotion/);
  assert.match(bridge,/isReducedMotionPreferred/);
  assert.match(motionPreferences,/prefers-reduced-motion: reduce/);
  assert.match(motionPreferences,/explicit==="full"/);
  assert.match(bridge,/legacy aggregate/);
});

test("authoritative physical dice keep one replay array while the numeric reel animates", () => {
  assert.match(bridge,/const physical=useMemo\(\(\)=>replay/);
  assert.match(bridge,/: \[\],\[replay\]\);/);
  assert.doesNotMatch(bridge,/if \(!replay\) return null;\s*const physical=replay\.roll\.dice\.filter/);
});
