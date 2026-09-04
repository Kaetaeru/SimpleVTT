import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { connectedManifest, CONNECTED_CAPABILITIES } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger, type ConnectedActionRequest, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function fighter(id:string,name:string):CharacterSheet {
  return {
    id,name,className:"파이터",level:1,species:"인간",background:"군인",hp:12,maxHp:12,tempHp:0,ac:10,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:16,dex:12,con:14,int:10,wis:10,cha:8},saves:[],skills:["운동"],features:[],equipment:[],attacks:[],
    resources:[{id:"resource:fighter.second-wind",label:"Second Wind",current:2,max:2,source:"파이터"}],
    items:[{id:`item.${id}.greatsword`,definitionId:"dnd.srd521.item.weapon.greatsword",name:"대검",nameEn:"Greatsword",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"two-hand",passiveEffects:["2d6 slashing"],grantedActionIds:[],provenance:["test"]}],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:1,runtimeRevision:1,
    classLevels:[{classId:"dnd.srd521.class.fighter",className:"파이터",level:1}],
  };
}
function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",capabilities:[...CONNECTED_CAPABILITIES],character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0}};
}
async function complete(host:MockAdapter) {
  let snapshot=await host.getSnapshot();
  for (let step=0;step<10&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) {
    if (!snapshot.resolution.canAdvance) break;
    snapshot=await host.advanceResolution();
  }
  return snapshot;
}

// Reproduced on real Windows H+P1+P2 (W9-02 family C, MP-C03 → MP-C29): P1's attack on P2 damaged P2 in the Scene, but
// only the attacker's projected sheet received the durable write-back; P2's projected sheet kept its full HP. The
// goblin's later hit on P2 was refused: "적용 거부: Character write-back drift for <P2>/hp.current: expected 4, current 10".
test("a remote Character's attack on another projected Character writes the damage back to the target's projected sheet",async()=>{
  const host=new MockAdapter();await host.setReferenceRole("dm");
  const catalog=structuredClone((await host.getSnapshot()).catalog) as CatalogEntry[];
  const a=fighter("char.wb.a","WriteBack A"),b=fighter("char.wb.b","WriteBack B");
  for(const [peer,sheet] of [["peer.a",a],["peer.b",b]] as const){const accepted=acceptHostCharacterSessionProjection(host,peer,manifest(sheet),buildCharacterSessionProjectionV1(sheet,catalog));assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:"");}
  await host.startInitiative();
  const state=connectedStateFor(host);state.mode="host";state.sessionId="session.projected-write-back";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set("peer.a",manifest(a));state.peerManifests.set("peer.b",manifest(b));
  const send=tauriSessionTransport.send,sendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async()=>1;tauriSessionTransport.sendTo=async()=>1;
  try{
    await host.setCurrentActor(a.id);
    const attack=(await host.getSnapshot()).scene.actionsByActor[a.id]?.find((action)=>action.resolutionKind==="attack"&&!action.readyActionRole);
    assert.ok(attack,"A needs an attack action");
    await host.setQueuedD20(18);
    const request:ConnectedActionRequest={sessionId:state.sessionId!,requestId:"req.a-attacks-b",actorId:a.id,actionId:attack.id,targetIds:[b.id],knownEventCursor:state.ledger!.cursor,character:manifest(a).character!,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:"peer.a",message:""},request),true);
    const done=await complete(host);
    assert.equal(done.resolution?.stage,"complete");
    assert.equal(done.resolution?.attackOutcome,"명중",done.resolution?.finalOutcome);
    const sceneHp=done.scene.entities.find((entry)=>entry.id===b.id)!.hp;
    assert.ok(sceneHp<12,"the hit must damage B in the Scene");
    assert.equal(projectedCharacterById(host,b.id)?.sheet.hp,sceneHp,"B's projected sheet carries the same damage");
    assert.equal(projectedCharacterById(host,a.id)?.sheet.hp,12,"the attacker's sheet is untouched");

    // The Host's own NPC then hits B: the durable write-back must not see drift.
    await host.setCurrentActor("combatant.goblin-a");
    const goblinAttack=(await host.getSnapshot()).scene.actionsByActor["combatant.goblin-a"]?.find((action)=>action.resolutionKind==="attack"&&action.available);
    assert.ok(goblinAttack,"the goblin needs an attack action");
    await host.setQueuedD20(19);
    await host.resolveAction(goblinAttack.id,[b.id]);
    const second=await complete(host);
    assert.equal(second.resolution?.stage,"complete");
    assert.doesNotMatch(second.resolution?.finalOutcome??"",/적용 거부|write-back drift/,second.resolution?.finalOutcome);
    const afterSecond=second.scene.entities.find((entry)=>entry.id===b.id)!.hp;
    assert.ok(afterSecond<sceneHp,"the second hit lands");
    assert.equal(projectedCharacterById(host,b.id)?.sheet.hp,afterSecond);
  }finally{tauriSessionTransport.send=send;tauriSessionTransport.sendTo=sendTo;}
});
