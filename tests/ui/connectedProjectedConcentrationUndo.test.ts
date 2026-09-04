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
import { CONNECTED_CAPABILITIES, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { HostSessionLedger, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
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
type Wire={type:string;events?:ConnectedSessionEvent[]};

// Reproduced on real Windows H+P1+P2 (W9-02 family D, MP-D12): after the goblin's hit broke the projected Bard's
// concentration (failed save), the DM's Undo was a silent no-op on the Host — no compensating event, HP unchanged.
// The damage that rides on a concentration save was committed to the turn runtime only, never written back to the
// (projected) Character sheet, so the inverse write-back saw drift ("expected 5, current 10") and gave up.
test("Host Undo after a failed concentration save on a projected Character commits a compensating event and restores HP",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const catalog=structuredClone((await host.getSnapshot()).catalog) as CatalogEntry[];
  const remote=bard("char.remote.bard");
  const accepted=acceptHostCharacterSessionProjection(host,"peer.bard",manifest(remote),buildCharacterSessionProjectionV1(remote,catalog));
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:"");
  await host.startInitiative();
  const state=connectedStateFor(host);state.mode="host";state.sessionId="session.undo-concentration";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set("peer.bard",manifest(remote));
  const broadcasts:string[]=[];const send=tauriSessionTransport.send,sendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async()=>1;
  try{
    const scene=(host as unknown as {scene:SceneVm}).scene;
    const before=snapshotAdapterTurnRuntimeState(host,scene)!;
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
    for (let step=0;step<8&&snapshot.resolution&&snapshot.resolution.stage!=="save-animation";step+=1) {if(!snapshot.resolution.canAdvance)break;snapshot=await host.advanceResolution();}
    assert.equal(snapshot.resolution?.stage,"save-animation",`the hit must stage the owner's concentration save; got ${snapshot.resolution?.stage}`);
    snapshot=await host.submitConcentrationSaveD20(3);
    for (let step=0;step<8&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) {if(!snapshot.resolution.canAdvance)break;snapshot=await host.advanceResolution();}
    assert.equal(snapshot.resolution?.stage,"complete");
    const resolutionId=snapshot.resolution!.id;
    const hpAfterHit=snapshot.scene.entities.find((entry)=>entry.id===remote.id)!.hp;
    assert.ok(hpAfterHit<10,"the hit must damage the Bard");
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.hp,hpAfterHit,"the damage is written back to the projected Character sheet");
    assert.equal(snapshotAdapterTurnRuntimeState(host,(host as unknown as {scene:SceneVm}).scene)?.concentration[remote.id],undefined,"the failed save ends concentration");

    const cursorBefore=state.ledger!.cursor;
    const undone=await host.undoLastResolution();
    assert.ok(undone.activity.some((entry)=>entry.undoOf===resolutionId),`the Host Undo must record a compensating entry; top=${JSON.stringify(undone.activity.slice(0,2).map((entry)=>entry.title))}`);
    assert.equal(state.ledger!.cursor,cursorBefore+1,"the Host commits exactly one compensating event");
    assert.equal(undone.scene.entities.find((entry)=>entry.id===remote.id)!.hp,10,"Undo restores the Bard's HP");
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.hp,10,"Undo restores the projected Character sheet");
    assert.ok(undone.activity.some((entry)=>entry.id===resolutionId),"the original entry stays in history");
    const undoBatch=broadcasts.map((raw)=>JSON.parse(raw) as Wire).filter((wire)=>wire.type==="event-batch").flatMap((wire)=>wire.events??[]).find((event)=>event.payload.kind==="resolution-undo");
    assert.ok(undoBatch,"the compensating event is broadcast to the Clients");
  }finally{tauriSessionTransport.send=send;tauriSessionTransport.sendTo=sendTo;}
});
