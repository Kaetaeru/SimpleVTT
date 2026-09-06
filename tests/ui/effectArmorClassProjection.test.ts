import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { createEffect } from "../../src/domain/effects";
import { projectEffectArmorClass } from "../../src/app/effectArmorClassProjectionAdapter";

test("S1-04: an active AC-bonus effect (신앙의 방패) raises the entity's displayed AC; an inactive one does not", async () => {
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  const internal=adapter as unknown as {scene:SceneVm};
  const base=(await adapter.getSnapshot()).scene.entities.find((entry)=>entry.id==="char.aelar")!.ac;
  const state=ensureAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state);
  const seeded=state!;
  seeded.effects.push(createEffect({id:"test:shield-of-faith",sourceId:"dnd.srd521.spell.shield-of-faith",targetId:"char.aelar",kind:"modifier",duration:{kind:"minutes",amount:10},metadata:{acBonus:2}},seeded.clock));
  const expectedRevision=seeded.revision;seeded.revision+=1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,internal.scene,expectedRevision,seeded),true);
  const shielded=(await adapter.getSnapshot()).scene.entities.find((entry)=>entry.id==="char.aelar")!;
  assert.equal(shielded.ac,base+2,"the displayed AC includes the effect bonus");
  const others=(await adapter.getSnapshot()).scene.entities.filter((entry)=>entry.id!=="char.aelar");
  assert.ok(others.every((entry)=>Number.isInteger(entry.ac)),"other entities keep their AC");
});

test("S1-04: the projection is pure over the effect list — suppressed effects and non-modifier effects are ignored, a floor applies", () => {
  const snapshot={scene:{entities:[{id:"a",ac:12},{id:"b",ac:15}]}} as never;
  const projected=projectEffectArmorClass(structuredClone(snapshot),[
    {targetId:"a",kind:"modifier",metadata:{acBonus:2}},
    {targetId:"a",kind:"modifier",metadata:{acBonus:1},suppression:{reason:"paused",pauseDuration:true}},
    {targetId:"a",kind:"condition",metadata:{acBonus:5}},
    {targetId:"b",kind:"modifier",metadata:{acFloor:16}},
  ]);
  assert.deepEqual(projected.scene.entities.map((entry:{id:string;ac:number})=>[entry.id,entry.ac]),[["a",14],["b",16]]);
  assert.deepEqual(projectEffectArmorClass(structuredClone(snapshot),[]).scene.entities.map((entry:{ac:number})=>entry.ac),[12,15]);
});
