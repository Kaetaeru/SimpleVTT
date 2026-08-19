import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";

test("reference demo exposes a legal melee attack and resolves it through the authoritative runtime",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  assert.equal(actorId,"char.aelar");

  const attack=(snapshot.scene.actionsByActor[actorId]??[]).find((action)=>action.resolutionKind==="attack"&&action.runtimeAttack?.rangeFeet===5);
  assert.ok(attack,"reference Character must expose a melee attack");
  assert.equal(attack.available,true);
  assert.ok(attack.eligibleTargetIds.includes("combatant.wolf"),"reference demo must expose at least one legal melee target");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.wolf")?.distance,"5피트");

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
