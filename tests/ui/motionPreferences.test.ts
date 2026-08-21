import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MOTION_PREFERENCE,
  MOTION_STORAGE_KEY,
  applyMotionPreference,
  isReducedMotionPreferred,
  persistMotionPreference,
  readMotionPreference,
  sanitizeMotionPreference,
} from "../../src/app/motionPreferences";

test("motion preference sanitizes storage and defaults to the operating system",()=>{
  assert.equal(sanitizeMotionPreference("full"),"full");
  assert.equal(sanitizeMotionPreference("reduced"),"reduced");
  assert.equal(sanitizeMotionPreference("normal"),DEFAULT_MOTION_PREFERENCE);
  assert.equal(readMotionPreference({getItem:()=>"full"}),"full");
  assert.equal(readMotionPreference({getItem:()=>"unexpected"}),"system");
});

test("explicit full motion overrides reduced OS media while system mode follows it",()=>{
  const root={dataset:{}} as unknown as HTMLElement;
  const reducedMedia={matches:true} as MediaQueryList;
  applyMotionPreference("system",root);
  assert.equal(isReducedMotionPreferred(root,reducedMedia),true);
  applyMotionPreference("full",root);
  assert.equal(isReducedMotionPreferred(root,reducedMedia),false);
  applyMotionPreference("reduced",root);
  assert.equal(isReducedMotionPreferred(root,{matches:false} as MediaQueryList),true);
});

test("motion preference persists under the v1 presentation key",()=>{
  const writes:Array<[string,string]>=[];
  persistMotionPreference("full",{setItem:(key,value)=>writes.push([key,value])});
  assert.deepEqual(writes,[[MOTION_STORAGE_KEY,"full"]]);
});
