import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { takeCommittedResolutionEvents } from "../../src/app/resolutionEventCommitRegistry";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { CONSUMABLE_D20_BONUS_INTERRUPT_ID } from "../../src/app/consumableD20BonusEffectFollowUpRuntimeAdapter";
import type { SceneVm } from "../../src/app/contracts";

function seedInspiration(adapter:MockAdapter,targetId:string) {
  const scene=(adapter as unknown as {scene:SceneVm}).scene;
  const before=snapshotAdapterTurnRuntimeState(adapter,scene);
  assert.ok(before,"initiative runtime must exist");
  const next=structuredClone(before);
  next.effects.push({
    id:"effect:test-bardic-inspiration",sourceId:"action.bard.bardic-inspiration",sourceActorId:"char.mira",targetId,kind:"marker",tags:["bardic-inspiration"],
    expiry:{kind:"time",elapsedSeconds:3600},
    metadata:{dieSides:6,displayName:"바드의 영감",publicLabel:"바드의 영감 · d6",d20FollowUp:"failed-test-add-die",d20Families:"ability-check,saving-throw,attack-roll",consumeOnUse:true},
  } as never);
  next.revision=before.revision+1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,scene,before.revision,next),true);
}

async function advanceUntil(adapter:MockAdapter,predicate:(stage:string|undefined)=>boolean) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<10&&!predicate(snapshot.resolution?.stage);step+=1) {
    assert.equal(snapshot.resolution?.canAdvance,true,`resolution stalled at ${snapshot.resolution?.stage}`);
    snapshot=await adapter.advanceResolution();
  }
  return snapshot;
}

// Reproduced on real Windows H+P1+P2 (W9-02 family D, MP-D05): after the owner accepted the Bardic Inspiration
// follow-up on a missed attack, the Host finished the Resolution but had no committed events left to broadcast
// ("action.starter completed without canonical ResolutionEvent output") and no Activity entry for it.
for (const [label,face,expectedOutcome] of [["stays a miss",1,"빗나감"],["turns into a hit",6,"명중"]] as const) {
  test(`an accepted d20 follow-up that ${label} still commits canonical events and Activity for the Resolution`,async()=>{
    const adapter=new MockAdapter();
    await adapter.startInitiative();
    await adapter.setCurrentActor("char.aelar");
    seedInspiration(adapter,"char.aelar");
    const goblinBefore=(await adapter.getSnapshot()).scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
    // Longsword +7: natural 7 -> 14 vs AC 15 misses; the d6 face turns 14 into 15 (hit) only with a 6... queue both.
    await adapter.setQueuedD20(7);
    const started=await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
    const resolutionId=started.resolution!.id;
    const offered=await advanceUntil(adapter,(stage)=>stage==="interrupt"||stage==="complete");
    assert.equal(offered.resolution?.stage,"interrupt","the miss must offer the inspiration follow-up");
    assert.equal(offered.resolution?.interrupt?.id,CONSUMABLE_D20_BONUS_INTERRUPT_ID);
    (adapter as unknown as {queuedFollowUpFace?:number}).queuedFollowUpFace=face;
    await adapter.setQueuedD20(face);
    await adapter.respondToInterrupt(true);
    const done=await advanceUntil(adapter,(stage)=>stage==="complete");
    assert.equal(done.resolution?.stage,"complete");
    assert.equal(done.resolution?.id,resolutionId,"the Resolution identity must survive the follow-up");
    const events=takeCommittedResolutionEvents(resolutionId);
    assert.ok(events&&events.length>0,`the completed Resolution must expose committed events (${done.resolution?.attackOutcome}: ${done.resolution?.compact})`);
    const changes=events.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="effect"&&change.targetId==="char.aelar"),"the consumed inspiration effect must be part of the committed history");
    assert.ok(changes.some((change)=>change.kind==="economy"&&change.targetId==="char.aelar"&&change.field==="action"),"the attack's action spend must be part of the committed history");
    const goblinAfter=done.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
    if (done.resolution?.attackOutcome==="명중") assert.ok(goblinAfter<goblinBefore&&changes.some((change)=>change.kind==="hp"&&change.targetId==="combatant.goblin-a"),"a converted hit must commit the damage");
    else assert.equal(goblinAfter,goblinBefore);
    assert.equal(done.activity[0]?.id,resolutionId,`the Host Activity must record the Resolution; top=${done.activity[0]?.title}`);
    void expectedOutcome;
  });
}
