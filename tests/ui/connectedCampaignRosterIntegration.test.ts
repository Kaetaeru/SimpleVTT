import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/connectedSessionRuntimeAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { projectedCharacterForPeer } from "../../src/app/characterSessionProjectionRegistry";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";

function installFakeDesktopTransport(){
  const original={available:tauriSessionTransport.available,startHost:tauriSessionTransport.startHost,send:tauriSessionTransport.send,sendTo:tauriSessionTransport.sendTo,stop:tauriSessionTransport.stop,onMessage:tauriSessionTransport.onMessage,onState:tauriSessionTransport.onState};
  let messageHandler:((message:SessionTransportMessage)=>void)|undefined;
  const sentTo:Array<{peer:string;message:ConnectedWireMessage}>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.sendTo=async(peer,message)=>{sentTo.push({peer,message:JSON.parse(message) as ConnectedWireMessage});return 1;};
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{messageHandler=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  return {
    sentTo:()=>[...sentTo],
    emitFrom(peer:string,message:ConnectedWireMessage){messageHandler?.({peer,message:encodeConnectedWireMessage(message)});},
    restore(){Object.assign(tauriSessionTransport,original);},
  };
}

function remoteHello(adapter:MockAdapter,name="Remote Hero"){
  const app=connectedInternal(adapter);
  const sheet=structuredClone(app.activeCharacter);
  const classEntry=app.catalog.find((entry)=>entry.category==="class");
  const speciesEntry=app.catalog.find((entry)=>entry.category==="species");
  const backgroundEntry=app.catalog.find((entry)=>entry.category==="background");
  assert.ok(classEntry&&speciesEntry&&backgroundEntry);
  const classContentId=(classEntry as typeof classEntry&{contentId:string}).contentId;
  assert.ok(classContentId);
  sheet.id="char.connected.campaign";
  sheet.name=name;
  sheet.className=classEntry.nameKo;
  sheet.species=speciesEntry.nameKo;
  sheet.background=backgroundEntry.nameKo;
  sheet.classLevels=[{classId:classContentId,level:sheet.level}];
  sheet.items=[];
  sheet.equipment=[];
  sheet.attacks=[];
  sheet.sourceRevision=41;
  sheet.runtimeRevision=7;
  const optional=sheet as typeof sheet&{subclassName?:string;cantrips?:string[];preparedSpells?:string[];spellbookSpells?:string[];masteryWeapons?:string[]};
  delete optional.subclassName;
  optional.cantrips=[];
  optional.preparedSpells=[];
  optional.spellbookSpells=[];
  optional.masteryWeapons=[];
  const manifest=connectedManifest(adapter);
  manifest.character={characterId:sheet.id,sourceRevision:sheet.sourceRevision,runtimeRevision:sheet.runtimeRevision};
  return {
    type:"hello" as const,
    manifest,
    participantId:`client:${sheet.id}`,
    participantName:sheet.name,
    knownEventCursor:0,
    projection:buildCharacterSessionProjectionV1(sheet,app.catalog),
  };
}

async function waitUntil(predicate:()=>boolean){
  for(let attempt=0;attempt<30;attempt+=1){if(predicate())return;await new Promise<void>((resolve)=>setTimeout(resolve,5));}
  assert.fail("timed out waiting for connected Campaign integration");
}

async function preparedHost(store=new MemoryCampaignLibraryStore()){
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.connected",name:"Connected Campaign"});
  await adapter.configureCampaignRations("campaign.connected",{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.prepareCampaignSessionSnapshot("campaign.connected",{sessionName:"Connected Session"});
  await adapter.hostSession();
  return {adapter,store};
}

test("accepted remote Character becomes one durable Campaign roster reference across reconnects",async()=>{
  const transport=installFakeDesktopTransport();
  try{
    const {adapter}=await preparedHost();
    const hello=remoteHello(adapter);
    transport.emitFrom("peer.first",hello);
    await waitUntil(()=>Boolean(connectedStateFor(adapter).peerParticipants.get("peer.first")));

    let snapshot=await adapter.getSnapshot();
    let campaign=snapshot.campaigns?.find((entry)=>entry.campaignId==="campaign.connected");
    assert.ok(campaign);
    assert.equal(campaign.roster.length,1);
    assert.deepEqual(campaign.roster[0],{
      rosterMemberId:"connected:char.connected.campaign",
      label:"Remote Hero",
      kind:"player-character-ref",
      characterRef:{ownerHint:"client:char.connected.campaign",characterId:"char.connected.campaign"},
      level:5,
      active:true,
      countsForRations:true,
      rationUnitsPerDay:1,
      stashPermission:"request",
    });
    assert.equal(snapshot.campaignSessionSystems?.rations.dailyRequired,1);

    await adapter.upsertCampaignRosterMember("campaign.connected",{...campaign.roster[0],countsForRations:false,rationUnitsPerDay:3,stashPermission:"manage"});
    snapshot=await adapter.getSnapshot();
    campaign=snapshot.campaigns?.find((entry)=>entry.campaignId==="campaign.connected");
    assert.ok(campaign);
    const revisionBeforeReconnect=campaign.revision;

    transport.emitFrom("peer.reconnected",hello);
    await waitUntil(()=>connectedStateFor(adapter).peerParticipants.get("peer.reconnected")===hello.participantId);
    snapshot=await adapter.getSnapshot();
    campaign=snapshot.campaigns?.find((entry)=>entry.campaignId==="campaign.connected");
    assert.ok(campaign);
    assert.equal(campaign.revision,revisionBeforeReconnect,"unchanged reconnect must not write another Campaign generation");
    assert.equal(campaign.roster.length,1);
    assert.equal(campaign.roster[0].countsForRations,false,"DM ration policy survives reconnect");
    assert.equal(campaign.roster[0].rationUnitsPerDay,3);
    assert.equal(campaign.roster[0].stashPermission,"manage");
  }finally{transport.restore();}
});

test("Campaign write failure rejects hello and removes the mounted remote projection",async()=>{
  const transport=installFakeDesktopTransport();
  try{
    const store=new MemoryCampaignLibraryStore();
    const {adapter}=await preparedHost(store);
    store.failNextWrite("Campaign disk unavailable");
    const hello=remoteHello(adapter,"Rejected Hero");
    transport.emitFrom("peer.rejected",hello);
    await waitUntil(()=>transport.sentTo().some((entry)=>entry.peer==="peer.rejected"&&entry.message.type==="hello-ack"));

    const ack=transport.sentTo().find((entry)=>entry.peer==="peer.rejected"&&entry.message.type==="hello-ack")?.message;
    assert.equal(ack?.type,"hello-ack");
    if(ack?.type!=="hello-ack")throw new Error("expected hello-ack");
    assert.equal(ack.compatibility.status,"incompatible");
    assert.match(ack.compatibility.message,/Campaign roster reference rejected/);
    assert.equal(projectedCharacterForPeer(adapter,"peer.rejected"),undefined);
    assert.equal(connectedInternal(adapter).scene.entities.some((entry)=>entry.id===hello.manifest.character?.characterId),false);
    assert.equal((await adapter.getSnapshot()).campaigns?.[0].roster.length,0);
  }finally{transport.restore();}
});
