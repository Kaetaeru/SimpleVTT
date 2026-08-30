import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/realResolutionService";
import { resolvePendingResolution } from "../../src/domain/resolution";

function internal(adapter:MockAdapter) {
  return adapter as unknown as {scene:SceneVm};
}

function seedHidden(adapter:MockAdapter,actorId:string,targetId:string) {
  const scene=internal(adapter).scene;
  const state=snapshotAdapterTurnRuntimeState(adapter,scene);
  assert.ok(state,"Search discovery requires TurnRuntime authority");
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state!,{
    id:`resolution.search-hidden.${targetId}`,
    actorId,
    sourceId:"external.search-hidden-probe",
    expectedRevision:state!.revision,
    operations:[{
      id:`op.search-hidden.${targetId}`,
      kind:"apply-effect",
      effect:{
        id:`effect.search-hidden.${targetId}`,
        sourceId:"external.search-hidden-probe",
        sourceActorId:targetId,
        targetId,
        kind:"marker",
        tags:["hidden"],
        duration:{kind:"special",key:"hidden-until-discovered"},
      },
    }],
  });
  assert.notEqual(committed.status,"rejected");
  if(committed.status==="rejected")return;
  assert.equal(commitAdapterTurnRuntimeState(adapter,scene,state!.revision,committed.state),true);
}

function isHidden(adapter:MockAdapter,targetId:string) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal(adapter).scene);
  return state?.effects.some((effect)=>effect.targetId===targetId&&effect.tags.includes("hidden"))??false;
}

async function completeSuccessfulSearch(adapter:MockAdapter) {
  await adapter.setQueuedD20(18);
  let snapshot=await adapter.resolveAction("action.standard.search.perception",[]);
  assert.equal(snapshot.resolution?.stage,"roll-animation",JSON.stringify(snapshot.resolution));
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"effect-preview",JSON.stringify(snapshot.resolution));
  const total=snapshot.resolution?.rollTotal;
  assert.equal(typeof total,"number");
  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:total!-1});
  assert.equal(snapshot.resolution?.checkOutcome,"성공",JSON.stringify(snapshot.resolution));
  if(snapshot.resolution?.stage!=="complete")snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  return snapshot;
}

test("Search reveals only provider-detected Hidden effects and Undo restores discovery",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  await adapter.setCurrentActor(actorId);
  snapshot=await adapter.getSnapshot();
  const targets=snapshot.scene.entities.filter((entity)=>entity.id!==actorId).slice(0,2);
  assert.equal(targets.length,2,"Search discovery probe requires two scene targets");
  const detectedTarget=targets[0].id;
  const undetectedTarget=targets[1].id;

  seedHidden(adapter,actorId,detectedTarget);
  seedHidden(adapter,actorId,undetectedTarget);
  setSpatialRelation(internal(adapter).scene,{
    sourceId:actorId,targetId:detectedTarget,distanceFeet:30,visible:false,cover:"none",targetCanSeeAttacker:false,
    detected:true,provenance:"module:test-search:detected",
  });
  setSpatialRelation(internal(adapter).scene,{
    sourceId:actorId,targetId:undetectedTarget,distanceFeet:30,visible:false,cover:"none",targetCanSeeAttacker:false,
    detected:false,provenance:"module:test-search:not-detected",
  });

  snapshot=await completeSuccessfulSearch(adapter);
  assert.equal(isHidden(adapter,detectedTarget),false,"authoritative detected=true must end Hidden after successful Search");
  assert.equal(isHidden(adapter,undetectedTarget),true,"authoritative detected=false must remain Hidden");
  assert.ok(snapshot.resolution?.stateChanges.some((entry)=>entry.includes("Hidden 종료")));

  await adapter.undoLastResolution();
  assert.equal(isHidden(adapter,detectedTarget),true,"event-native Undo must restore the discovered Hidden effect");
  assert.equal(isHidden(adapter,undetectedTarget),true,"Undo must not mutate an undiscovered Hidden effect");
});
