import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { projectCharacterLongRest } from "../../src/app/characterLongRestProjection";

test("Character long rest projection reuses domain recovery for durable HP life flags and declared resources",async()=>{
  const snapshot=await new MockAdapter().getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.hp=Math.max(1,sheet.maxHp-5);
  sheet.tempHp=4;
  sheet.durableLifeFlags={stable:true,unconscious:true,dead:false};
  sheet.resources=[...sheet.resources,{id:"resource:test.long-rest",label:"Long Rest Test",current:0,max:3,source:"test",recovery:{longRest:"all"}}];

  const result=projectCharacterLongRest(sheet);
  assert.equal(result.sheet.hp,sheet.maxHp);
  assert.equal(result.sheet.tempHp,0);
  assert.deepEqual(result.sheet.durableLifeFlags,{stable:false,unconscious:false,dead:false});
  assert.equal(result.sheet.resources.find((resource)=>resource.id==="resource:test.long-rest")?.current,3);
  assert.equal(result.sheet.name,sheet.name,"rest must not rewrite Character source identity");
  assert.ok(result.provenance.some((entry)=>entry.source==="rest:long"));
});

test("Character long rest projection rejects a dead or zero-HP Character instead of inventing resurrection",async()=>{
  const snapshot=await new MockAdapter().getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.hp=0;
  sheet.durableLifeFlags={stable:false,unconscious:true,dead:false};
  assert.throws(()=>projectCharacterLongRest(sheet),/Long Rest requires a living creature/i);
});
