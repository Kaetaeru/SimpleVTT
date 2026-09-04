import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { CONNECTED_CAPABILITIES } from "../../src/app/connectedSessionRuntimeAdapter";
import type { SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { createEffect } from "../../src/domain/effects";

function bard(id:string):CharacterSheet {
  return {
    id,name:"Remote Bard",className:"바드",level:1,species:"인간",background:"군인",hp:10,maxHp:10,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:10,dex:14,con:12,int:10,wis:10,cha:16},saves:[],skills:["공연"],features:[],equipment:[],attacks:[],resources:[],
    items:[{id:`item.${id}.dagger`,definitionId:"dnd.srd521.item.weapon.dagger",name:"단검",nameEn:"Dagger",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:["1d4 piercing"],grantedActionIds:[],provenance:["test"]}],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:1,runtimeRevision:1,
    classLevels:[{classId:"dnd.srd521.class.bard",className:"바드",level:1}],
  };
}
function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",capabilities:[...CONNECTED_CAPABILITIES],character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0}};
}

// Reproduced on real Windows H+P1+P2 (W9-02 family D, MP-D07): the goblin's hit on the concentrating Bard (a projected
// remote Character) was rejected on the Host with "적용 거부: missing runtime CharacterSheet for saving throw" instead
// of requesting the owner's concentration save.
test("a projected remote Character that concentrates gets a concentration save when the Host's NPC hits it",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const catalog=structuredClone((await host.getSnapshot()).catalog) as CatalogEntry[];
  const remote=bard("char.remote.bard");
  const accepted=acceptHostCharacterSessionProjection(host,"peer.bard",manifest(remote),buildCharacterSessionProjectionV1(remote,catalog));
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:"");
  await host.startInitiative();
  const scene=(host as unknown as {scene:SceneVm}).scene;
  const before=snapshotAdapterTurnRuntimeState(host,scene);
  assert.ok(before&&before.combatants[remote.id],"the projected Character must be a runtime combatant");
  const next=structuredClone(before);
  next.concentration[remote.id]={actorId:remote.id,groupId:"bard:faerie-fire",sourceId:"spell:faerie-fire"};
  next.effects.push(createEffect({id:"bard-faerie-fire",sourceId:"spell:faerie-fire",sourceActorId:remote.id,targetId:"combatant.goblin-a",kind:"marker",duration:{kind:"concentration"},concentrationGroupId:"bard:faerie-fire"},next.clock));
  next.revision=before.revision+1;
  assert.equal(commitAdapterTurnRuntimeState(host,scene,before.revision,next),true);

  await host.setCurrentActor("combatant.goblin-a");
  const goblinAttack=(await host.getSnapshot()).scene.actionsByActor["combatant.goblin-a"]?.find((action)=>action.resolutionKind==="attack"&&action.available);
  assert.ok(goblinAttack,"the goblin needs an attack action");
  await host.setQueuedD20(19);
  let snapshot=await host.resolveAction(goblinAttack.id,[remote.id]);
  for (let step=0;step<8&&snapshot.resolution&&snapshot.resolution.stage!=="complete"&&!snapshot.resolution.concentrationSave;step+=1) {
    if (!snapshot.resolution.canAdvance) break;
    snapshot=await host.advanceResolution();
  }
  assert.ok(snapshot.resolution,"the attack must open a Resolution");
  assert.doesNotMatch(snapshot.resolution.finalOutcome??"",/missing runtime CharacterSheet|적용 거부/,`${snapshot.resolution.stage}: ${snapshot.resolution.finalOutcome}`);
  assert.equal(snapshot.resolution.attackOutcome,"명중");
  assert.equal(snapshot.resolution.concentrationSave?.targetId,remote.id,`the hit must request the projected Character's concentration save; got ${JSON.stringify(snapshot.resolution.concentrationSave)} stage=${snapshot.resolution.stage}`);
  assert.equal(snapshot.resolution.concentrationSave?.ability,"con");
  assert.equal(snapshot.resolution.concentrationSave?.modifier,1,"the projected Bard's CON 12 => +1");
});
