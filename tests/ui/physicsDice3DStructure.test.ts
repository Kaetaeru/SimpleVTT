import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const physics=readFileSync(new URL("../../src/PhysicsDice3D.tsx",import.meta.url),"utf8");
const bridge=readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf8");
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

test("authoritative VisualDiceTray delegates physical dice to the physics renderer",()=>{
  assert.match(bridge,/PhysicsDice3D/);
  assert.match(bridge,/authoritative result · physics replay/);
  assert.doesNotMatch(bridge,/visual-die-facet|Array\.from\(\{ length:6 \}/);
});

test("physics presentation converges to the supplied result without changing game state",()=>{
  assert.match(physics,/desiredIndex/);
  assert.match(physics,/setFromUnitVectors/);
  assert.match(physics,/slerp/);
  assert.match(bridge,/resolution\.authoritativeDice/);
  assert.doesNotMatch(physics,/resolveAction|advanceResolution|mockAdapter/);
});
