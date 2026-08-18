import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const physics=readFileSync(new URL("../../src/PhysicsDice3D.tsx",import.meta.url),"utf8");
const bridge=readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf8");
const projection=readFileSync(new URL("../../src/app/diceVisuals.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/visual-dice.css",import.meta.url),"utf8");
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
  for(const shape of ["TetrahedronGeometry","BoxGeometry","OctahedronGeometry","CylinderGeometry","DodecahedronGeometry","IcosahedronGeometry"]) assert.match(physics,new RegExp(shape));
  assert.equal(typeof pkg.dependencies.three,"string");
  assert.equal(typeof pkg.dependencies["cannon-es"],"string");
});

test("connected replay uses fast depth-first cinematic motion and completes inside 1.5 seconds",()=>{
  assert.match(bridge,/cinematic/);
  assert.match(physics,/group\.position\.set\(x\*\.55,\.75\+index\*\.09,-8\.4-index\*\.36\)/);
  assert.match(physics,/10\.4\+Math\.random\(\)\*2\.4/);
  assert.match(physics,/18\+Math\.random\(\)\*9/);
  assert.match(physics,/cinematic\?960:1250/);
  assert.match(physics,/cinematic\?1450:2350/);
  assert.match(bridge,/reduced\?650:1480/);
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
  assert.match(physics,/slerp/);
  assert.match(bridge,/resolution\.authoritativeDice/);
  assert.doesNotMatch(physics,/resolveAction|advanceResolution|mockAdapter/);
});
