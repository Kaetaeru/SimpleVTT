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
import { connectedManifest, CONNECTED_CAPABILITIES, publishConnectedSnapshot, broadcastConnectedWire } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger, type ConnectedActionRequest, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

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

async function twoPlayerHost() {
  const host=new MockAdapter();await host.setReferenceRole("dm");
  const catalog=structuredClone((await host.getSnapshot()).catalog) as CatalogEntry[];
  const a=fighter("char.guard.a","Guard A"),b=fighter("char.guard.b","Guard B");
  for(const [peer,sheet] of [["peer.a",a],["peer.b",b]] as const){const accepted=acceptHostCharacterSessionProjection(host,peer,manifest(sheet),buildCharacterSessionProjectionV1(sheet,catalog));assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:"");}
  await host.startInitiative();
  const state=connectedStateFor(host);state.mode="host";state.sessionId="session.guards";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set("peer.a",manifest(a));state.peerManifests.set("peer.b",manifest(b));
  const broadcasts:Wire[]=[],direct:Array<{peer:string;wire:Wire}>=[];
  const send=tauriSessionTransport.send,sendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(JSON.parse(message) as Wire);return 1;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,wire:JSON.parse(message) as Wire});return 1;};
  const restore=()=>{tauriSessionTransport.send=send;tauriSessionTransport.sendTo=sendTo;};
  const attackOf=async(actorId:string)=>{const snapshot=await host.getSnapshot();const action=(snapshot.scene.actionsByActor[actorId]??[]).find((entry)=>entry.resolutionKind==="attack"&&!entry.readyActionRole);assert.ok(action,`attack action missing for ${actorId}`);return action;};
  const request=async(requestId:string,actorId:string,actionId:string):Promise<ConnectedActionRequest>=>({sessionId:state.sessionId!,requestId,actorId,actionId,targetIds:["combatant.goblin-a"],knownEventCursor:state.ledger!.cursor,character:manifest(actorId===a.id?a:b).character!,capabilities:[...CONNECTED_CAPABILITIES]});
  return {host,state,a,b,broadcasts,direct,restore,attackOf,request};
}

async function completeHost(host:MockAdapter) {
  let snapshot=await host.getSnapshot();
  for (let step=0;step<10&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) {
    assert.equal(snapshot.resolution.canAdvance,true,`resolution stalled at ${snapshot.resolution.stage}`);
    snapshot=await host.advanceResolution();
  }
  return snapshot;
}

// Reproduced on real Windows H+P1+P2 (W9-02 family D, MP-D03): the Host accepted P1's attack while P2's Character
// held the Initiative turn, because the DM-facing availability projection does not gate a remote Character by turn.
test("a remote Character cannot act on another Character's Initiative turn; the refusal is explicit and nothing is reserved",async()=>{
  const h=await twoPlayerHost();
  try{
    await h.host.setCurrentActor(h.b.id);
    const attack=await h.attackOf(h.a.id);
    await h.host.setQueuedD20(15);
    assert.equal(await routeConnectedActionRequest(h.host,{peer:"peer.a",message:""},await h.request("req.off-turn",h.a.id,attack.id)),true);
    const snapshot=await h.host.getSnapshot();
    assert.equal(h.state.pendingRemoteAction,null,"an off-turn intent must not open a pending remote action");
    assert.equal(snapshot.resolution?.actorId===h.a.id?snapshot.resolution.stage:null,null,"an off-turn intent must not start a Resolution on the Host");
    assert.equal(h.state.ledger!.cursor,0,"an off-turn intent must not commit");
    const refusal=h.direct.find((entry)=>entry.peer==="peer.a"&&entry.wire.type==="error");
    assert.ok(refusal,"the owner must receive an explicit refusal");
    assert.equal(refusal.wire.code,"action-off-turn");
    assert.match(refusal.wire.message??"",/턴이 아닙니다/);
    assert.equal(h.broadcasts.filter((wire)=>wire.type==="event-batch").length,0);

    // The same intent on the Character's own turn is accepted and commits once.
    await h.host.setCurrentActor(h.a.id);
    assert.equal(await routeConnectedActionRequest(h.host,{peer:"peer.a",message:""},await h.request("req.own-turn",h.a.id,attack.id)),true);
    assert.ok(h.state.pendingRemoteAction,"the owner's own-turn intent opens the pending remote action");
    await completeHost(h.host);
    assert.equal(h.state.ledger!.cursor,1);
    assert.equal(h.broadcasts.filter((wire)=>wire.type==="event-batch").length,1);
  }finally{h.restore();}
});

// Reproduced on real Windows H+P1+P2 (W9-02 family H, MP-H02): P2 dropped while P1's attack was pending on the Host;
// the participant lifecycle event advanced the ledger and the Host refused to commit P1's finished Resolution.
test("a peer leaving while a remote action is pending does not prevent the Host from committing that action",async()=>{
  const h=await twoPlayerHost();
  try{
    await h.host.setCurrentActor(h.a.id);
    const attack=await h.attackOf(h.a.id);
    await h.host.setQueuedD20(16);
    assert.equal(await routeConnectedActionRequest(h.host,{peer:"peer.a",message:""},await h.request("req.pending",h.a.id,attack.id)),true);
    assert.ok(h.state.pendingRemoteAction);
    assert.equal((await h.host.getSnapshot()).resolution?.stage,"roll-animation");

    // Exactly what the Host does when the transport reports another peer gone.
    const left=h.state.ledger!.commitHostEvent({actorId:"participant.b",payload:{kind:"participant",participantId:"participant.b",participantName:"Guard B",characterName:h.b.name,state:"disconnected",ready:false,stateChanges:["Guard B disconnected"],provenance:["host-authoritative exact transport disconnect: peer.b"]}});
    await broadcastConnectedWire({type:"event-batch",sessionId:h.state.ledger!.sessionId,afterCursor:left.sequence-1,events:[left]});
    await publishConnectedSnapshot(h.host);

    const done=await completeHost(h.host);
    assert.equal(done.resolution?.stage,"complete");
    assert.equal(h.state.pendingRemoteAction,null,"the pending action settles once the Resolution completes");
    assert.equal(h.state.ledger!.cursor,2,"participant event, then the committed Resolution");
    const errors=h.direct.filter((entry)=>entry.peer==="peer.a"&&entry.wire.type==="error");
    assert.deepEqual(errors.map((entry)=>entry.wire.code),[],"the owner must not be refused because another peer left");
    const kinds=h.broadcasts.filter((wire)=>wire.type==="event-batch").flatMap((wire)=>(wire.events??[]).map((event)=>event.payload.kind));
    assert.deepEqual(kinds,["participant","resolution"]);
    const committed=h.broadcasts.flatMap((wire)=>wire.events??[]).find((event)=>event.payload.kind==="resolution");
    assert.ok(committed&&committed.sequence===2&&committed.actorId===h.a.id);
  }finally{h.restore();}
});
