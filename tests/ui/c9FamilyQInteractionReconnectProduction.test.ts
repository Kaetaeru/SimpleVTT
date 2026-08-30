import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const MODULE_ID="homebrew.q-reconnect-consent";
const CONTENT_ID="option.q-reconnect-consent";
const MECHANIC_ID="external.unknown.q-reconnect-consent";
const ENTRY_POINT_ID="approve";

function payload(){return JSON.stringify({
  schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
  source:{document:"Q Reconnect Consent Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
  content:[{id:CONTENT_ID,category:"option",presentation:{defaultLocale:"en",originalName:"Q Reconnect Consent",locales:{en:{name:"Q Reconnect Consent"}}},mechanics:[{kind:"common-play",config:{
    schemaVersion:"0.2-draft",id:MECHANIC_ID,
    payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
    entryPoints:[{id:ENTRY_POINT_ID,invocation:"manual",interaction:{id:"owner-consent",kind:"consent",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},operations:[{kind:"healing.apply",amount:{value:5},target:"self"}]}],
  }}]}]
});}

async function install(adapter:MockAdapter){
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),mechanicId:MECHANIC_ID,entryPointId:ENTRY_POINT_ID});
}

function damageActor(adapter:MockAdapter){
  const internal=adapter as unknown as {activeCharacter:{id:string;hp:number;maxHp:number};scene:{entities:Array<{id:string;hp:number}>}};
  internal.activeCharacter.hp=Math.max(0,internal.activeCharacter.maxHp-10);
  internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=internal.activeCharacter.hp;
  return internal.activeCharacter.id;
}

test("accepted actor-owner interaction replays into a fresh connected replica",async()=>{
  const sessionId="session.q-reconnect-consent",host=new MockAdapter();
  const actionId=await install(host),actorId=damageActor(host);
  await host.startInitiative();await host.setCurrentActor(actorId);
  const before=await host.getSnapshot();
  const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));hostState.peerManifests.set("peer.owner",connectedManifest(host));
  const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async()=>1;tauriSessionTransport.sendTo=async()=>1;
  try{
    await host.resolveAction(actionId,[actorId]);
    let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.owner",message:""},{sessionId,resolutionId:snapshot.resolution!.id,promptId:snapshot.resolution!.interrupt!.id,accept:true}),true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp+5);
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,false);
    assert.ok(hostState.ledger!.eventsAfter(0).length>0);

    const reconnect=new MockAdapter();await install(reconnect);damageActor(reconnect);
    await reconnect.startInitiative();await reconnect.setCurrentActor(actorId);
    const reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
    assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
    const replayed=await reconnect.getSnapshot();
    assert.equal(replayed.activeCharacter.hp,snapshot.activeCharacter.hp);
    assert.equal(replayed.scene.economyByActor[actorId]?.reaction,snapshot.scene.economyByActor[actorId]?.reaction);
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
});
