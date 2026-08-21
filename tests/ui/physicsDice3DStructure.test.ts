import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const physics=readFileSync(new URL("../../src/PhysicsDice3D.tsx",import.meta.url),"utf8");
const bridge=readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf8");
const localPresentation=readFileSync(new URL("../../src/app/localDicePresentation.ts",import.meta.url),"utf8");
const presets=readFileSync(new URL("../../src/app/diceVisualPresets.ts",import.meta.url),"utf8");
const projection=readFileSync(new URL("../../src/app/diceVisuals.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/visual-dice.css",import.meta.url),"utf8");
const pkg=JSON.parse(readFileSync(new URL("../../package.json",import.meta.url),"utf8"));

test("shared dice renderer uses WebGL polyhedral geometry and one rigid-body physics world",()=>{
  assert.match(physics,/from "three"/);
  assert.match(physics,/from "cannon-es"/);
  assert.match(physics,/new THREE\.WebGLRenderer/);
  assert.match(physics,/new CANNON\.World/);
  assert.match(physics,/gravity: new CANNON\.Vec3/);
  assert.match(physics,/new CANNON\.SAPBroadphase/);
  assert.match(physics,/ContactMaterial/);
  assert.match(physics,/friction:/);
  assert.match(physics,/restitution:/);
  assert.match(physics,/angularVelocity\.set/);
  assert.match(physics,/new CANNON\.Plane/);
  assert.match(physics,/ConvexPolyhedron/);
  for(const shape of ["TetrahedronGeometry","BoxGeometry","OctahedronGeometry","d10Geometry","DodecahedronGeometry","IcosahedronGeometry"]) assert.match(physics,new RegExp(shape));
  assert.doesNotMatch(physics,/CylinderGeometry/);
  assert.equal(typeof pkg.dependencies.three,"string");
  assert.equal(typeof pkg.dependencies["cannon-es"],"string");
});

test("production dice use the personal visual preset registry instead of one hard-coded bronze skin",()=>{
  assert.match(physics,/readAppearancePreference/);
  assert.match(physics,/getDiceVisualPreset\(preference\.diceTheme\)/);
  assert.match(physics,/createVisualAssets\(preset\)/);
  assert.match(physics,/diceFaceLabel\(preset, value\)/);
  for(const id of ["classic-metal","minimal-blank","rune-etched","obsidian-glow","bone-relic","arcane-sigil","crystal-core","neon-holo"]) assert.match(presets,new RegExp(`"${id}"`));
  assert.doesNotMatch(physics,/DEMO_BRONZE|DEMO_NUMBER/);
});

test("cinematic replay treats the whole screen as the table and completes inside 1.5 seconds",()=>{
  assert.match(bridge,/cinematic/);
  assert.match(physics,/camera\.position\.set\(0, CINEMATIC_CAMERA_HEIGHT, 0\)/);
  assert.match(physics,/camera\.lookAt\(0, 0, 0\)/);
  assert.match(physics,/camera\.up\.set\(0, 0, -1\)/);
  assert.match(physics,/z = bounds\.minZ \+ 0\.95/);
  assert.match(physics,/const forward = 13\.5/);
  assert.match(physics,/const spin = 21/);
  assert.match(physics,/cinematic \? 1000 : 1250/);
  assert.match(physics,/cinematic \? 1500 : 2350/);
  assert.match(projection,/VISUAL_DICE_REPLAY_MS\s*=\s*1480/);
  assert.match(projection,/VISUAL_DICE_REDUCED_REPLAY_MS\s*=\s*650/);
  assert.match(bridge,/reduced\?VISUAL_DICE_REDUCED_REPLAY_MS:VISUAL_DICE_REPLAY_MS/);
  assert.match(css,/\.visual-dice-overlay\.v09/);
  assert.match(css,/background:transparent/);
});

test("d10 and d20 collision geometry keep the sandbox stability fixes",()=>{
  assert.match(physics,/old production geometry was inside-out/);
  assert.match(physics,/indices\.push\(0, next, current\)/);
  assert.match(physics,/indices\.push\(1, current, next\)/);
  assert.match(physics,/vertices\.length !== 12 \|\| faces\.length !== 20/);
  assert.match(physics,/return new CANNON\.Sphere\(0\.78\)/);
  assert.match(physics,/if \(rawDelta > 0\.1\) world\.step\(1 \/ 60\)/);
});

test("connected and standalone rolls share one full-screen replay bridge without changing mechanics authority",()=>{
  assert.match(bridge,/buildVisualDiceRoll/);
  assert.match(bridge,/resolution\.authoritativeDice/);
  assert.match(bridge,/LOCAL_DICE_PRESENT_EVENT/);
  assert.match(bridge,/window\.addEventListener\(LOCAL_DICE_PRESENT_EVENT/);
  assert.match(localPresentation,/window\.dispatchEvent\(new CustomEvent/);
  assert.match(bridge,/createPortal\(/);
  assert.match(bridge,/document\.body/);
  assert.doesNotMatch(physics,/resolveAction|advanceResolution|mockAdapter/);
  assert.doesNotMatch(localPresentation,/resolveAction|advanceResolution|mockAdapter/);
});

test("replay drives a slot reel notice and exposes final arithmetic",()=>{
  assert.match(bridge,/setInterval\(\(\)=>setReelValue/);
  assert.match(bridge,/,42\)/);
  assert.match(bridge,/visual-roll-notice/);
  assert.match(bridge,/visual-roll-notice-extension/);
  assert.match(bridge,/replay\.roll\.notice\.modifier/);
  assert.match(bridge,/replay\.roll\.notice\.total/);
  assert.match(css,/\.visual-roll-notice\.resolved \.visual-roll-notice-extension/);
});

test("natural d20 extremes have semantic result states independent from user accent color",()=>{
  assert.match(projection,/"natural-20"/);
  assert.match(projection,/"natural-1"/);
  assert.match(localPresentation,/"natural-20"/);
  assert.match(localPresentation,/"natural-1"/);
  assert.match(bridge,/tone=resolved\?replay\.roll\.notice\.tone:"normal"/);
  assert.match(css,/\.visual-roll-notice\.natural-20/);
  assert.match(css,/#48b875/);
  assert.match(css,/\.visual-roll-notice\.natural-1/);
  assert.match(css,/#d85359/);
});

test("physics presentation converges to each supplied face without becoming a second dice engine",()=>{
  assert.match(physics,/desiredIndex/);
  assert.match(physics,/setFromUnitVectors/);
  assert.match(physics,/slerp/);
  assert.match(physics,/runtime\.body\.velocity\.setZero\(\)/);
  assert.match(physics,/runtime\.body\.sleep\(\)/);
  assert.doesNotMatch(physics,/Math\.floor\(Math\.random\(\)\s*\*\s*die\.sides/);
});
