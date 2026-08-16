import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/productionPlayRuntimeAdapter";
import type { ActionVm, CharacterSheet, CharacterSummary, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import {
  isEphemeralSessionProjectionCharacter,
  mountCharacterSessionProjection,
  projectedCharacterForPeer,
  projectedCharacterIds,
} from "../../src/app/characterSessionProjectionRegistry";
import {
  activateProjectedCharacterResolutionContext,
  restoreProjectionResolutionContext,
} from "../../src/app/characterSessionProjectionMount";
import { productionCharacterEntity } from "../../src/app/productionPlayRuntimeAdapter";

type Internal={
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  scene:SceneVm;
};

function internal(adapter:MockAdapter) {
  return adapter as unknown as Internal;
}

function savedClone(template:CharacterSheet,id:string,name:string):CharacterSheet {
  return {
    ...structuredClone(template),
    id,
    name,
    saveState:"saved",
  };
}

function remoteSentinelAction(actorId:string):ActionVm {
  return {
    id:"action.remote-authoritative-sentinel",
    actorId,
    name:"Remote authoritative sentinel",
    category:"basic",
    target:"none",
    economy:"없음",
    resolutionKind:"no-roll",
    summary:"SessionProjection-owned action",
    available:true,
    eligibleTargetIds:[],
    details:[{label:"authority",value:"remote SessionProjection"}],
  };
}

test("switching saved local Characters replaces only the prior local projection and preserves remote SessionProjection authority",async()=>{
  const adapter=new MockAdapter();
  const initial=await adapter.getSnapshot();
  const app=internal(adapter);
  const localA=savedClone(initial.activeCharacter,"char.phase14.local-a","Phase14 Local A");
  const localB=savedClone(initial.activeCharacter,"char.phase14.local-b","Phase14 Local B");
  app.characters=[structuredClone(localA),structuredClone(localB)];

  const first=await adapter.selectProductionCharacter(localA.id);
  assert.equal(first.activeCharacter.id,localA.id);
  assert.ok(first.scene.entities.some((entity)=>entity.id===localA.id));

  const remote=savedClone(initial.activeCharacter,"char.phase14.remote-projection","Phase14 Remote Projection");
  const projection={
    characterId:remote.id,
    sourceRevision:remote.sourceRevision??0,
    runtimeRevision:remote.runtimeRevision??0,
  } as CharacterSessionProjectionV1;
  mountCharacterSessionProjection(adapter,{
    peerId:"peer.phase14.remote",
    characterId:remote.id,
    sourceRevision:projection.sourceRevision,
    runtimeRevision:projection.runtimeRevision,
    projection,
    sheet:remote,
  });
  app.scene.entities.push(productionCharacterEntity(remote));
  app.scene.actionsByActor[remote.id]=[remoteSentinelAction(remote.id)];
  app.scene.economyByActor[remote.id]={action:false,bonusAction:true,reaction:false,movement:7,movementMax:30};
  app.scene.currentActorId=localA.id;
  app.scene.selectedActorId=localA.id;

  const switched=await adapter.selectProductionCharacter(localB.id);
  assert.equal(switched.activeCharacter.id,localB.id);
  assert.ok(switched.scene.entities.some((entity)=>entity.id===localB.id));
  assert.ok(!switched.scene.entities.some((entity)=>entity.id===localA.id),"previous local-owned actor must be removed");
  assert.ok(switched.scene.entities.some((entity)=>entity.id===remote.id),"remote projected actor must survive local Character switch");
  assert.equal(switched.scene.actionsByActor[localA.id],undefined);
  assert.equal(switched.scene.economyByActor[localA.id],undefined);
  assert.equal(switched.scene.actionsByActor[remote.id]?.[0]?.id,"action.remote-authoritative-sentinel");
  assert.deepEqual(switched.scene.economyByActor[remote.id],{action:false,bonusAction:true,reaction:false,movement:7,movementMax:30});
  assert.equal(switched.scene.currentActorId,localB.id);
  assert.equal(switched.scene.selectedActorId,localB.id);
  assert.deepEqual(projectedCharacterIds(adapter),[remote.id]);
  assert.equal(projectedCharacterForPeer(adapter,"peer.phase14.remote")?.characterId,remote.id);
  assert.equal(isEphemeralSessionProjectionCharacter(adapter,remote.id),true);

  const activated=activateProjectedCharacterResolutionContext(adapter,"peer.phase14.remote");
  assert.equal(activated.status,"accepted");
  if (activated.status!=="accepted") return;

  const duringRemoteResolution=await adapter.getSnapshot();
  assert.equal(duringRemoteResolution.activeCharacter.id,remote.id);
  assert.equal(duringRemoteResolution.scene.actionsByActor[remote.id]?.[0]?.id,"action.remote-authoritative-sentinel","local reconciliation must not overwrite a temporary remote resolution context");
  assert.ok(duringRemoteResolution.scene.entities.some((entity)=>entity.id===localB.id),"local actor must remain mounted during remote resolution context");

  restoreProjectionResolutionContext(adapter,activated.context);
  const restored=await adapter.getSnapshot();
  assert.equal(restored.activeCharacter.id,localB.id);
  assert.ok(restored.scene.entities.some((entity)=>entity.id===localB.id));
  assert.ok(restored.scene.entities.some((entity)=>entity.id===remote.id));
  assert.ok(!restored.scene.entities.some((entity)=>entity.id===localA.id));
  assert.equal(restored.scene.actionsByActor[remote.id]?.[0]?.id,"action.remote-authoritative-sentinel");
  assert.deepEqual(projectedCharacterIds(adapter),[remote.id]);
});
