import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";

test("reference demo exposes a legal melee attack and resolves it through the authoritative runtime",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  assert.equal(actorId,"char.aelar");

  const attack=(snapshot.scene.actionsByActor[actorId]??[]).find((action)=>action.resolutionKind==="attack"&&action.runtimeAttack?.rangeFeet===5);
  assert.ok(attack,"reference Character must expose a melee attack");
  assert.equal(attack.available,true);
  assert.ok(attack.eligibleTargetIds.includes("combatant.wolf"),"reference demo must expose a legal melee target without a spatial module");
  assert.ok(attack.eligibleTargetIds.includes("combatant.goblin-a"),"presentation distance must not constrain targeting without a spatial module");
  assert.deepEqual(attack.eligibleTargetReasons,{});
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.wolf")?.distance,"18피트","target card distance remains presentation-only");

  snapshot=await adapter.resolveAction(attack.id,["combatant.wolf"]);
  assert.equal(snapshot.resolution?.actionId,attack.id);
  assert.equal(snapshot.resolution?.targetIds[0],"combatant.wolf");
  for(let step=0;step<8&&snapshot.resolution?.stage!=="complete";step+=1) {
    snapshot=snapshot.resolution?.stage==="interrupt"
      ? await adapter.respondToInterrupt(false)
      : await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.doesNotMatch(snapshot.resolution?.finalOutcome??"",/적용 거부|out of range|missing pairwise spatial runtime fact/i);
});

test("reference attack projection enforces range only for an authoritative spatial module fact",async()=>{
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {scene:SceneVm};
  setSpatialRelation(internal.scene,{
    sourceId:"char.aelar",
    targetId:"combatant.goblin-a",
    distanceFeet:30,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance:"module:test-grid:spatial:char.aelar",
  });

  const snapshot=await adapter.getSnapshot();
  const attack=(snapshot.scene.actionsByActor["char.aelar"]??[]).find((action)=>action.resolutionKind==="attack"&&action.runtimeAttack?.rangeFeet===5);
  assert.ok(attack);
  assert.equal(attack.eligibleTargetIds.includes("combatant.goblin-a"),false);
  assert.match(attack.eligibleTargetReasons?.["combatant.goblin-a"]??"",/거리 30피트 · 무기 사거리 5피트 밖/);
  assert.ok(attack.eligibleTargetIds.includes("combatant.wolf"),"a pair without an authoritative module fact remains unconstrained");
});

test("reference Character cards switch the active canonical Character instead of reopening one fixed Character",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.id,"char.aelar");

  snapshot=await adapter.selectProductionCharacter("char.mira");
  assert.equal(snapshot.activeCharacter.id,"char.mira");
  assert.equal(snapshot.activeCharacter.name,"Mira");
  assert.ok(snapshot.activeCharacter.attacks.length>0);

  snapshot=await adapter.selectProductionCharacter("char.aelar");
  assert.equal(snapshot.activeCharacter.id,"char.aelar");
  assert.equal(snapshot.activeCharacter.name,"Aelar");
});
