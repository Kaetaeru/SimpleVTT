import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignPartyStashPolicyRuntimeAdapter";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import type { CharacterSheet, PartyStashTransferCommand } from "../../src/app/contracts";
import type { SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  mountCharacterSessionProjection,
  rebindCharacterSessionProjectionPeer,
  unmountAllCharacterSessionProjections,
} from "../../src/app/characterSessionProjectionRegistry";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import {
  tauriSessionTransport,
  type SessionTransportMessage,
  type SessionTransportStatus,
} from "../../src/app/tauriSessionTransport";

const CAMPAIGN_ID="campaign.connected-stash-transport";
const PARTICIPANT_ID="participant.connected-stash-transport";
const PEER_A="peer.connected-stash-transport.a";
const PEER_B="peer.connected-stash-transport.b";
const ADDRESS="127.0.0.1:3210";

async function configureCampaign(adapter:MockAdapter,character:CharacterSheet){
  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Connected Stash Transport"});
  await adapter.upsertCampaignRosterMember(CAMPAIGN_ID,{
    rosterMemberId:"roster.connected-stash-transport",
    label:character.name,
    kind:"player-character-ref",
    characterRef:{ownerHint:PARTICIPANT_ID,characterId:character.id},
    active:true,
    countsForRations:true,
    rationUnitsPerDay:1,
    stashPermission:"request",
  });
  await adapter.configureCampaignPartyStashPolicy(CAMPAIGN_ID,"dm-approval");
}

function withdrawal(actorId:string,requestId:string,amount=5):PartyStashTransferCommand{
  return {requestId,campaignId:CAMPAIGN_ID,actorId,direction:"stash-to-character",asset:"currency",amount};
}

const hostStatus:SessionTransportStatus={role:"host",state:"connected",address:"0.0.0.0:3210",peerCount:0};
const clientStatus:SessionTransportStatus={role:"client",state:"connected",address:ADDRESS,peerCount:1};
const stoppedStatus:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};

test("connected dm-approval request transport is idempotent, non-mutating, reconnect-safe, and session-transient",async()=>{
  const listeners:Array<(message:SessionTransportMessage)=>void>=[];
  let requestPeer=PEER_A;
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    connectClient:tauriSessionTransport.connectClient,
    send:tauriSessionTransport.send,
    sendTo:tauriSessionTransport.sendTo,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(hostStatus);
  tauriSessionTransport.connectClient=async()=>structuredClone(clientStatus);
  tauriSessionTransport.stop=async()=>structuredClone(stoppedStatus);
  tauriSessionTransport.onMessage=async(listener)=>{listeners.push(listener);return ()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  tauriSessionTransport.send=async(message)=>{
    let type="";try{type=String((JSON.parse(message) as {type?:unknown}).type??"");}catch{}
    if(type==="campaign-stash-approval-request"){
      assert.ok(listeners[0],"Host connected listener must be registered before approval transport");
      listeners[0]({peer:requestPeer,message});
    }
    return 1;
  };
  tauriSessionTransport.sendTo=async(_peer,message)=>{
    let type="";try{type=String((JSON.parse(message) as {type?:unknown}).type??"");}catch{}
    if(type==="campaign-stash-approval-request-result"){
      assert.ok(listeners[1],"Client connected listener must be registered before approval acknowledgement");
      listeners[1]({peer:"host",message});
    }
    return 1;
  };

  const host=new MockAdapter();
  const client=new MockAdapter();
  setCampaignLibraryStoreForTests(host,new MemoryCampaignLibraryStore());
  setCampaignLibraryStoreForTests(client,new MemoryCampaignLibraryStore());
  let hostStopped=false;

  try{
    await import("../../src/app/connectedSessionRuntimeAdapter");
    await import("../../src/app/connectedPartyStashHostPolicyAdapter");
    await import("../../src/app/connectedCampaignSystemsRuntimeAdapter");
    await import("../../src/app/connectedPartyStashClientPolicyAdapter");
    const approvalRuntime=await import("../../src/app/connectedPartyStashApprovalRuntimeAdapter");

    const character=(await client.getSnapshot()).activeCharacter;
    await configureCampaign(client,character);
    await configureCampaign(host,character);

    await host.hostSession();
    await client.joinSession(ADDRESS);
    assert.ok(listeners.length>=2,"Host and Client must register connected transport listeners");

    const hostState=connectedStateFor(host);
    const clientState=connectedStateFor(client);
    assert.ok(hostState.sessionId,"Host Session must allocate an authoritative sessionId");
    clientState.mode="client";
    clientState.sessionId=hostState.sessionId;

    const hostCampaign=(await host.getSnapshot()).campaignSessionSystems;
    assert.ok(hostCampaign,"Host Campaign projection must exist before Player approval requests");
    listeners[1]({
      peer:"host",
      message:JSON.stringify({
        type:"campaign-systems-projection",
        sessionId:hostState.sessionId,
        revision:1,
        projection:hostCampaign,
      }),
    });
    assert.equal((await client.getSnapshot()).campaignSessionSystems?.partyStash.policy,"dm-approval","Client must consume the Host Campaign projection through the connected listener stack");

    const manifest={
      protocolVersion:1,
      rulesProfileId:"dnd.srd-5.2.1",
      capabilities:[],
      character:{characterId:character.id,sourceRevision:0,runtimeRevision:0},
    } satisfies SessionCompatibilityManifest;
    hostState.peerParticipants.set(PEER_A,PARTICIPANT_ID);
    hostState.peerManifests.set(PEER_A,structuredClone(manifest));
    mountCharacterSessionProjection(host,{
      peerId:PEER_A,
      characterId:character.id,
      sourceRevision:0,
      runtimeRevision:0,
      projection:{} as CharacterSessionProjectionV1,
      sheet:character,
    });

    const hostBefore=await host.getSnapshot();
    const clientBefore=await client.getSnapshot();
    const command=withdrawal(character.id,"stash-approval.transport-primary");

    await client.transferPartyStash(command);
    const queue=approvalRuntime.partyStashApprovalQueueFor(host);
    assert.equal(queue.active().length,1);
    assert.equal(queue.pending().length,1);
    assert.deepEqual(queue.pending()[0].command,command);
    assert.equal(queue.pending()[0].state,"pending");

    const hostAfterRequest=await host.getSnapshot();
    const clientAfterRequest=await client.getSnapshot();
    assert.deepEqual(hostAfterRequest.campaignSessionSystems?.partyStash,hostBefore.campaignSessionSystems?.partyStash,"request acknowledgement must not mutate Host Party Stash assets");
    assert.deepEqual(hostAfterRequest.activeCharacter,hostBefore.activeCharacter,"request acknowledgement must not mutate Host Character assets");
    assert.deepEqual(clientAfterRequest.campaignSessionSystems?.partyStash,clientBefore.campaignSessionSystems?.partyStash,"request acknowledgement must not mutate Player Party Stash projection");
    assert.deepEqual(clientAfterRequest.activeCharacter,clientBefore.activeCharacter,"request acknowledgement must not mutate Player Character assets");

    await client.transferPartyStash(command);
    assert.equal(queue.active().length,1,"duplicate requestId with identical payload must reuse one Host queue record");
    await assert.rejects(
      ()=>client.transferPartyStash(withdrawal(character.id,command.requestId,6)),
      /does not match the original request/,
    );
    assert.equal(queue.active().length,1,"payload drift must not create another Host queue record");

    hostState.peerParticipants.delete(PEER_A);
    hostState.peerManifests.delete(PEER_A);
    hostState.peerParticipants.set(PEER_B,PARTICIPANT_ID);
    hostState.peerManifests.set(PEER_B,structuredClone(manifest));
    rebindCharacterSessionProjectionPeer(host,character.id,PEER_B);
    requestPeer=PEER_B;
    await client.transferPartyStash(command);
    assert.equal(queue.active().length,1,"same participant/Character reconnect must preserve request identity across peer rebinding");

    const rejectCommand=withdrawal(character.id,"stash-approval.transport-reject",7);
    await client.transferPartyStash(rejectCommand);
    await host.rejectPartyStashApproval(rejectCommand.requestId);
    assert.equal(queue.lookup(rejectCommand.requestId)?.state,"rejected");

    const cancelCommand=withdrawal(character.id,"stash-approval.transport-cancel",8);
    await client.transferPartyStash(cancelCommand);
    await host.cancelPartyStashApproval(cancelCommand.requestId);
    assert.equal(queue.lookup(cancelCommand.requestId)?.state,"cancelled");
    assert.equal(queue.active().length,1,"only the original pending request should remain active before Session stop");

    await host.stopSession();
    hostStopped=true;
    assert.equal(queue.active().length,0,"Session stop must clear pending Party Stash approval state");
  }finally{
    if(!hostStopped)await host.stopSession().catch(()=>undefined);
    await client.stopSession().catch(()=>undefined);
    unmountAllCharacterSessionProjections(host);
    tauriSessionTransport.available=original.available;
    tauriSessionTransport.startHost=original.startHost;
    tauriSessionTransport.connectClient=original.connectClient;
    tauriSessionTransport.send=original.send;
    tauriSessionTransport.sendTo=original.sendTo;
    tauriSessionTransport.stop=original.stop;
    tauriSessionTransport.onMessage=original.onMessage;
    tauriSessionTransport.onState=original.onState;
    tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
  }
});
