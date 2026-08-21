import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const physics=readFileSync(new URL("../../src/PhysicsDice3D.tsx",import.meta.url),"utf8");
const bridge=readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf8");
const projection=readFileSync(new URL("../../src/app/diceVisuals.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/visual-dice.css",import.meta.url),"utf8");
const sandboxWorld=readFileSync(new URL("../../experiments/dice-tauri-sandbox/src/dice-world.ts",import.meta.url),"utf8");
const sandboxMain=readFileSync(new URL("../../experiments/dice-tauri-sandbox/src/main.ts",import.meta.url),"utf8");
const sandboxHtml=readFileSync(new URL("../../experiments/dice-tauri-sandbox/index.html",import.meta.url),"utf8");
const sandboxCss=readFileSync(new URL("../../experiments/dice-tauri-sandbox/src/styles.css",import.meta.url),"utf8");
const pkg=JSON.parse(readFileSync(new URL("../../package.json",import.meta.url),"utf8"));

test("shared dice renderer uses WebGL polyhedral geometry and a physics world",()=>{
  assert.match(physics,/from "three"/);
  assert.match(physics,/from "cannon-es"/);
  assert.match(physics,/new THREE\.WebGLRenderer/);
  assert.match(physics,/new CANNON\.World/);
  assert.match(physics,/gravity:new CANNON\.Vec3/);
  assert.match(physics,/ContactMaterial/);
  assert.match(physics,/friction:/);
  assert.match(physics,/restitution:/);
  assert.match(physics,/angularVelocity\.set/);
  assert.match(physics,/new CANNON\.Plane/);
  assert.match(physics,/ConvexPolyhedron/);
  for(const shape of ["TetrahedronGeometry","BoxGeometry","OctahedronGeometry","pentagonalBipyramidGeometry","DodecahedronGeometry","IcosahedronGeometry"]) assert.match(physics,new RegExp(shape));
  assert.doesNotMatch(physics,/CylinderGeometry/);
  assert.equal(typeof pkg.dependencies.three,"string");
  assert.equal(typeof pkg.dependencies["cannon-es"],"string");
});

test("production dice preserve the UI-demo bronze facet language instead of the prior dark generic treatment",()=>{
  assert.match(physics,/DEMO_BRONZE="#c77d38"/);
  assert.match(physics,/flatShading:true/);
  assert.match(physics,/DEMO_NUMBER="#f7dfae"/);
  assert.match(physics,/HemisphereLight\(0xffead0/);
  assert.doesNotMatch(physics,/#262d38/);
  assert.doesNotMatch(physics,/context\.arc\(64,64,35/);
});

test("connected replay uses fast depth-first cinematic motion and completes inside 1.5 seconds",()=>{
  assert.match(bridge,/cinematic/);
  assert.match(physics,/PRODUCT_PHYSICS\.throwSpeed/);
  assert.match(physics,/PRODUCT_PHYSICS\.spinSpeed/);
  assert.match(physics,/GUIDANCE_START_MS=680/);
  assert.match(physics,/CONVERGENCE_LOCK_MS=980/);
  assert.match(physics,/CONVERGENCE_DURATION_MS=220/);
  assert.match(physics,/cinematic\?1460:2350/);
  assert.match(projection,/VISUAL_DICE_REPLAY_MS\s*=\s*1480/);
  assert.match(projection,/VISUAL_DICE_REDUCED_REPLAY_MS\s*=\s*650/);
  assert.match(bridge,/reduced\?VISUAL_DICE_REDUCED_REPLAY_MS:VISUAL_DICE_REPLAY_MS/);
});

test("parallel table cameras launch from the player camera edge before enabling table colliders",()=>{
  for (const source of [physics,sandboxWorld]) {
    assert.match(source,/CAMERA_LAUNCH_OFFSET/);
    assert.match(source,/CAMERA_LAUNCH_GATE/);
    assert.match(source,/CAMERA_LAUNCH_SCALE/);
    assert.match(source,/enteredTable/);
    assert.match(source,/bounds\.maxZ/);
    assert.match(source,/collisionFilterMask/);
  }
  assert.match(physics,/-PRODUCT_PHYSICS\.throwSpeed/);
  assert.match(sandboxWorld,/velocity\.set\(lateral, -2\.4 - Math\.random\(\) \* 1\.4, -forward\)/);
  assert.match(physics,/runtime\.body\.position\.z<=bounds\.maxZ-CAMERA_LAUNCH_GATE/);
  assert.match(sandboxWorld,/runtime\.body\.position\.z <= this\.bounds\.maxZ - CAMERA_LAUNCH_GATE/);
});

test("production physics imports the sandbox table model with natural collisions and invisible viewport bounds",()=>{
  assert.match(physics,/MASS_BY_SIDES/);
  assert.match(physics,/SAPBroadphase/);
  assert.match(physics,/solver\.iterations=14/);
  assert.match(physics,/sleepSpeedLimit:\.22/);
  assert.match(physics,/runtime\.body\.collisionFilterMask=SURFACE_GROUP\|DICE_GROUP/);
  assert.match(physics,/rebuildBounds/);
  assert.match(physics,/new CANNON\.Box\(halfExtents\)/);
  assert.doesNotMatch(physics,/boundaryDebug|LineLoop/);
});

test("screen-table cameras face the table head-on and d10 keeps outward-facing solid facets",()=>{
  assert.match(sandboxWorld,/camera\.position\.set\(0, 16, 0\)/);
  assert.match(sandboxWorld,/camera\.up\.set\(0, 0, -1\)/);
  assert.match(physics,/camera\.up\.set\(0,0,-1\)/);
  assert.match(sandboxWorld,/indices\.push\(0, next, current\)/);
  assert.match(sandboxWorld,/indices\.push\(1, current, next\)/);
  assert.match(physics,/indices\.push\(0,next,current\)/);
  assert.match(physics,/indices\.push\(1,current,next\)/);
});

test("sandbox converges natural rigid-body motion to authoritative faces before revealing arithmetic",()=>{
  assert.match(sandboxWorld,/authoritativeValues: number\[\]/);
  assert.match(sandboxWorld,/GUIDANCE_START_MS = 680/);
  assert.match(sandboxWorld,/CONVERGENCE_LOCK_MS = 980/);
  assert.match(sandboxWorld,/CONVERGENCE_DURATION_MS = 220/);
  assert.match(sandboxWorld,/setFromUnitVectors\(worldNormal, up\)/);
  assert.match(sandboxWorld,/body\.angularVelocity\.x \+=/);
  assert.match(sandboxWorld,/rawProgress \* rawProgress \* \(3 - 2 \* rawProgress\)/);
  assert.match(sandboxMain,/secureDieRoll/);
  assert.match(sandboxMain,/resolveResultPresentation/);
  assert.match(sandboxHtml,/id="result-presentation"/);
  assert.match(sandboxCss,/data-tone="natural-20"/);
  assert.match(sandboxCss,/data-tone="natural-1"/);
});

test("authoritative replay drives a slot reel notice and exposes final arithmetic without becoming mechanics authority",()=>{
  assert.match(bridge,/buildVisualDiceRoll/);
  assert.match(bridge,/setInterval\(\(\)=>setReelValue/);
  assert.match(bridge,/,42\)/);
  assert.match(bridge,/visual-roll-notice/);
  assert.match(bridge,/visual-roll-notice-extension/);
  assert.match(bridge,/replay\.roll\.notice\.modifier/);
  assert.match(bridge,/replay\.roll\.notice\.total/);
  assert.match(css,/\.visual-roll-notice\.resolved \.visual-roll-notice-extension/);
  assert.doesNotMatch(physics,/resolveAction|advanceResolution|mockAdapter/);
});

test("natural d20 extremes have semantic result states independent from user accent color",()=>{
  assert.match(projection,/"natural-20"/);
  assert.match(projection,/"natural-1"/);
  assert.match(bridge,/tone=resolved\?replay\.roll\.notice\.tone:"normal"/);
  assert.match(css,/\.visual-roll-notice\.natural-20/);
  assert.match(css,/#48b875/);
  assert.match(css,/\.visual-roll-notice\.natural-1/);
  assert.match(css,/#d85359/);
});

test("physics presentation converges to the supplied result without changing game state",()=>{
  assert.match(physics,/desiredIndex/);
  assert.match(physics,/setFromUnitVectors/);
  assert.match(physics,/body\.angularVelocity\.x\+=/);
  assert.match(physics,/slerpQuaternions/);
  assert.match(physics,/onResolvedRef\.current\?\.\(\)/);
  assert.match(bridge,/onResolved=\{\(\)=>settleReplay/);
  assert.match(physics,/if \(reducedMotion\)[\s\S]*runtime\.mesh\.position\.set\(centeredX,FLOOR_Y\+\.95,bounds\.focusZ/);
  assert.match(bridge,/resolution\.authoritativeDice/);
  assert.doesNotMatch(physics,/resolveAction|advanceResolution|mockAdapter/);
});
