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
import { connectedManifest, CONNECTED_CAPABILITIES } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger, type ConnectedActionRequest, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { decodeConnectedWireMessage } from "../../src/app/connectedSessionWire";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function fighter(id:string,name:string):CharacterSheet {
  return {
    id,name,className:"파이터",level:1,species:"인간",background:"군인",hp:12,maxHp:12,tempHp:0,ac:16,speed:30,proficiencyBonus:2,saveState:"saved",
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
type Wire={type:string;code?:string;message?:string;events?:ConnectedSessionEvent[]};

async function complete(host:MockAdapter) {
  let snapshot=await host.getSnapshot();
  for (let step=0;step<10&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) {
    if (!snapshot.resolution.canAdvance) break;
    snapshot=await host.advanceResolution();
  }
  return snapshot;
}

// Reproduced on real Windows H+P1+P2 (W9-02 family C, MP-C06): the Cleric's Help on the Fighter completed on the Host
// ("도움 받음" on the Fighter) but committed no canonical ResolutionEvent, so the Host refused to broadcast it
// ("remote-action-not-event-native") and neither Client ever saw the status.
test("a remote Character's Help commits an effect event, broadcasts a valid presentation, and the helped attack consumes it",async()=>{
  const host=new MockAdapter();await host.setReferenceRole("dm");
  const catalog=structuredClone((await host.getSnapshot()).catalog) as CatalogEntry[];
  const a=fighter("char.status.a","Status A"),b=fighter("char.status.b","Status B");
  for(const [peer,sheet] of [["peer.a",a],["peer.b",b]] as const){const accepted=acceptHostCharacterSessionProjection(host,peer,manifest(sheet),buildCharacterSessionProjectionV1(sheet,catalog));assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:"");}
  await host.startInitiative();
  const state=connectedStateFor(host);state.mode="host";state.sessionId="session.status-effects";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set("peer.a",manifest(a));state.peerManifests.set("peer.b",manifest(b));
  const broadcasts:string[]=[],direct:Array<{peer:string;wire:Wire}>=[];
  const send=tauriSessionTransport.send,sendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,wire:JSON.parse(message) as Wire});return 1;};
  try{
    await host.setCurrentActor(a.id);
    const help=(await host.getSnapshot()).scene.actionsByActor[a.id]?.find((action)=>action.id==="action.standard.help");
    assert.ok(help,"the projected Character must project Help");
    const request:ConnectedActionRequest={sessionId:state.sessionId!,requestId:"req.help",actorId:a.id,actionId:help.id,targetIds:[b.id],knownEventCursor:state.ledger!.cursor,character:manifest(a).character!,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:"peer.a",message:""},request),true);
    const done=await complete(host);
    assert.equal(done.resolution?.stage,"complete");
    const errors=direct.filter((entry)=>entry.wire.type==="error").map((entry)=>`${entry.wire.code}: ${entry.wire.message}`);
    assert.deepEqual(errors,[],"the owner must not be told the action was not event-native");
    assert.equal(state.pendingRemoteAction,null);
    const batches=broadcasts.map((raw)=>JSON.parse(raw) as Wire).filter((wire)=>wire.type==="event-batch");
    const committed=batches.flatMap((wire)=>wire.events??[]).find((event)=>event.payload.kind==="resolution");
    assert.ok(committed,"Help must commit a Host resolution event");
    if(committed.payload.kind!=="resolution")throw new Error("unreachable");
    const changes=committed.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="effect"&&change.targetId===b.id&&change.operation==="added"),`the committed events must add the Helped effect on the target; got ${JSON.stringify(changes.map((change)=>`${change.kind}:${change.targetId}`))}`);
    assert.ok(changes.some((change)=>change.kind==="economy"&&change.targetId===a.id&&change.field==="action"&&change.after===false),"Help spends the helper's action");
    assert.ok(done.scene.entities.find((entry)=>entry.id===b.id)?.status.some((status)=>/도움 받음/.test(status)),JSON.stringify(done.scene.entities.find((entry)=>entry.id===b.id)?.status));
    for(const raw of broadcasts){const decoded=decodeConnectedWireMessage(raw);assert.equal(typeof decoded==="string"?decoded:"ok","ok",`every Host broadcast must decode on a Client: ${typeof decoded==="string"?decoded:""}`);}
    const runtime=snapshotAdapterTurnRuntimeState(host,(host as unknown as {scene:import("../../src/app/contracts").SceneVm}).scene);
    const helped=runtime?.effects.find((effect)=>effect.targetId===b.id&&effect.metadata?.sessionStatus==="도움 받음");
    assert.ok(helped,"the Helped effect lives in the turn runtime");
    assert.equal(helped.tags.includes("hidden"),false,"ending on the next attack must not mark the helped Character as hidden");

    // The helped Character's next attack rolls with advantage and consumes the effect.
    await host.setCurrentActor(b.id);
    const attack=(await host.getSnapshot()).scene.actionsByActor[b.id]?.find((action)=>action.resolutionKind==="attack"&&!action.readyActionRole);
    assert.ok(attack);
    await host.setQueuedD20(9);
    const attackRequest:ConnectedActionRequest={sessionId:state.sessionId!,requestId:"req.helped-attack",actorId:b.id,actionId:attack.id,targetIds:["combatant.goblin-a"],knownEventCursor:state.ledger!.cursor,character:manifest(b).character!,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:"peer.b",message:""},attackRequest),true);
    const attacked=await complete(host);
    assert.equal(attacked.resolution?.stage,"complete");
    const detail=(attacked.activity[0]?.detail??[]).find((line)=>/selected d20/.test(line))??"";
    assert.match(detail,/advantage/,`the helped attack must roll with advantage; detail=${detail}`);
    assert.equal(attacked.scene.entities.find((entry)=>entry.id===b.id)?.status.some((status)=>/도움 받음/.test(status)),false,"the Helped status is consumed by the attack");
    const runtimeAfter=snapshotAdapterTurnRuntimeState(host,(host as unknown as {scene:import("../../src/app/contracts").SceneVm}).scene);
    assert.equal(runtimeAfter?.effects.some((effect)=>effect.targetId===b.id&&effect.metadata?.sessionStatus==="도움 받음"),false,"the Helped effect is removed from the turn runtime by the attack");
  }finally{tauriSessionTransport.send=send;tauriSessionTransport.sendTo=sendTo;}
});

test("Dodge and Disengage commit turn-bound effect events for the acting Character",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  for(const [actionId,status] of [["action.standard.dodge","회피"],["action.standard.disengage","이탈"]] as const){
    const before=(await adapter.getSnapshot()).scene.actionsByActor["char.aelar"]?.find((action)=>action.id===actionId);
    if(!before||!before.available){for(let step=0;step<8;step+=1){const next=await adapter.endTurn();if(next.scene.currentActorId==="char.aelar")break;}}
    await adapter.resolveAction(actionId,["char.aelar"]);
    const done=await complete(adapter);
    assert.equal(done.resolution?.stage,"complete");
    assert.ok(done.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.some((entry)=>entry.includes(status)),`${status} must be applied; got ${JSON.stringify(done.scene.entities.find((entry)=>entry.id==="char.aelar")?.status)}`);
    const runtime=snapshotAdapterTurnRuntimeState(adapter,(adapter as unknown as {scene:import("../../src/app/contracts").SceneVm}).scene);
    const effect=runtime?.effects.find((entry)=>entry.targetId==="char.aelar"&&entry.metadata?.sessionStatus===status);
    assert.ok(effect,`${status} must live in the turn runtime as a canonical effect`);
    assert.equal(effect.expiry.kind,"turn-boundary");
  }
});
