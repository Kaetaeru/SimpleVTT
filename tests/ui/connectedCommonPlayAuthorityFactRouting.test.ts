import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import type { SessionTransportMessage } from "../../src/app/tauriSessionTransport";
import {
  applyConnectedCommonPlayAuthorityFactRequest,
  registerConnectedCommonPlayAuthorityFactTransport,
  requestConnectedCommonPlayAuthorityFact,
  resumeConnectedCommonPlayAuthorityFactRequestsForCharacter,
  routeConnectedCommonPlayAuthorityFactResponse,
  submitConnectedCommonPlayAuthorityFactResponse,
} from "../../src/app/connectedCommonPlayAuthorityFactRuntime";
import {
  resolveCommonPlayFactQuery,
  type CommonPlayAuthorityFactRequest,
  type CommonPlayFactResolution,
} from "../../src/domain/commonPlaySpatialFactRuntime";
import {
  encodeConnectedWireMessage,
  type ConnectedWireMessage,
} from "../../src/app/connectedSessionWire";
import { CONNECTED_SESSION_PROTOCOL_VERSION, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";

const sessionId="session.common-play-fact";
const ownerId="char.owner";
const otherId="char.other";
const ownerPeer="peer.owner";
const otherPeer="peer.other";

function manifest(characterId:string):SessionCompatibilityManifest {
  return {
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:"dnd.srd521",
    capabilities:["common-play-authority-fact-v1"],
    character:{characterId,sourceRevision:1,runtimeRevision:1},
  };
}

async function authorityRequest(queryId:string,expectedRevision=7) {
  const resolution=await resolveCommonPlayFactQuery({
    registry:{"target.visible":{valueType:"boolean"}},
    query:{
      id:queryId,
      fact:"target.visible",
      subject:ownerId,
      authority:"target-owner",
      visibility:"authority-only",
      unknownPolicy:"request-authority",
    },
    resolutionId:`resolution.${queryId}`,
    expectedRevision,
    provider:null,
  });
  assert.equal(resolution.status,"awaiting-authority");
  if(resolution.status!=="awaiting-authority")throw new Error("expected authority request");
  return resolution.request;
}

function hostAdapter() {
  const adapter=new MockAdapter();
  const state=connectedStateFor(adapter);
  state.mode="host";
  state.sessionId=sessionId;
  state.peerManifests.set(ownerPeer,manifest(ownerId));
  state.peerManifests.set(otherPeer,manifest(otherId));
  return adapter;
}

function clientAdapter() {
  const adapter=new MockAdapter();
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  return adapter;
}

function transportMessage(peer:string,message:ConnectedWireMessage):SessionTransportMessage {
  return {peer,message:encodeConnectedWireMessage(message)};
}

test("connected Common Play authority facts stay private to the owner, normalize at Host authority, and are idempotent",async()=>{
  const targeted:Array<{peer:string;message:ConnectedWireMessage}>=[];
  const clientOutbound:ConnectedWireMessage[]=[];
  registerConnectedCommonPlayAuthorityFactTransport({
    sendTo:async(peer,message)=>{targeted.push({peer,message});},
    send:async(message)=>{clientOutbound.push(message);},
  });

  const host=hostAdapter();
  const client=clientAdapter();
  const request=await authorityRequest("query.visible");
  let currentRevision=7;
  const resolutions:CommonPlayFactResolution[]=[];

  const queued=await requestConnectedCommonPlayAuthorityFact(host,{
    request,
    responderId:ownerId,
    currentRevision:()=>currentRevision,
    onResolution:(resolution)=>{resolutions.push(resolution);},
  });
  assert.equal(queued.status,"queued");
  assert.equal(targeted.length,1);
  assert.equal(targeted[0].peer,ownerPeer,"authority-only prompt must use peer-targeted transport only");
  assert.equal(targeted.some((entry)=>entry.peer===otherPeer),false);
  const prompt=targeted[0].message;
  assert.equal(prompt.type,"common-play-fact-request");
  if(prompt.type!=="common-play-fact-request")throw new Error("expected Common Play fact request");
  assert.equal(prompt.sessionId,sessionId);
  assert.equal(prompt.responderId,ownerId);
  assert.equal(prompt.request.visibility,"authority-only");

  const wrongClient=await applyConnectedCommonPlayAuthorityFactRequest(client,prompt,otherId);
  assert.equal(wrongClient.status,"rejected");
  const accepted=await applyConnectedCommonPlayAuthorityFactRequest(client,prompt,ownerId);
  assert.equal(accepted.status,"applied");
  const submitted=await submitConnectedCommonPlayAuthorityFactResponse(client,request.id,true);
  assert.equal(submitted.status,"sent");
  assert.equal(clientOutbound.length,1);
  const responseWire=clientOutbound[0];
  assert.equal(responseWire.type,"common-play-fact-response");
  if(responseWire.type!=="common-play-fact-response")throw new Error("expected Common Play fact response");

  const wrongSession={...responseWire,sessionId:"session.wrong"} as ConnectedWireMessage;
  const wrongSessionResult=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(ownerPeer,wrongSession),wrongSession);
  assert.equal(wrongSessionResult.status,"rejected");

  const wrongOwner={
    ...responseWire,
    response:{...responseWire.response,responderId:otherId},
  } as ConnectedWireMessage;
  const wrongOwnerResult=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(ownerPeer,wrongOwner),wrongOwner);
  assert.equal(wrongOwnerResult.status,"rejected");

  const wrongPeerResult=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(otherPeer,responseWire),responseWire);
  assert.equal(wrongPeerResult.status,"rejected");

  const resolved=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(ownerPeer,responseWire),responseWire);
  assert.equal(resolved.status,"resolved");
  assert.equal(resolutions.length,1);
  assert.equal(resolutions[0].status,"resolved");
  if(resolutions[0].status!=="resolved")throw new Error("expected resolved authority fact");
  assert.equal(resolutions[0].answer.value,true);
  assert.deepEqual(resolutions[0].answer.provenance,{kind:"authority",responderId:ownerId});

  const duplicate=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(ownerPeer,responseWire),responseWire);
  assert.equal(duplicate.status,"duplicate");
  assert.equal(resolutions.length,1,"duplicate delivery must not publish a second authoritative answer");

  const sendsBeforeResume=targeted.length;
  await resumeConnectedCommonPlayAuthorityFactRequestsForCharacter(host,ownerId);
  assert.equal(targeted.length,sendsBeforeResume,"answered request must not revive during reconnect/resume");
  currentRevision=8;
});

test("connected Common Play authority fact rejects stale answers and only resumes unanswered requests on the rebound owner peer",async()=>{
  const targeted:Array<{peer:string;message:ConnectedWireMessage}>=[];
  registerConnectedCommonPlayAuthorityFactTransport({
    sendTo:async(peer,message)=>{targeted.push({peer,message});},
    send:async()=>{},
  });
  const host=hostAdapter();
  const state=connectedStateFor(host);
  let revision=7;
  const staleRequest=await authorityRequest("query.stale",7);
  const staleResults:CommonPlayFactResolution[]=[];
  await requestConnectedCommonPlayAuthorityFact(host,{
    request:staleRequest,
    responderId:ownerId,
    currentRevision:()=>revision,
    onResolution:(resolution)=>{staleResults.push(resolution);},
  });
  const stalePrompt=targeted.at(-1)?.message;
  assert.equal(stalePrompt?.type,"common-play-fact-request");
  if(stalePrompt?.type!=="common-play-fact-request")throw new Error("expected stale prompt");
  revision=8;
  const staleWire:ConnectedWireMessage={
    type:"common-play-fact-response",
    sessionId,
    response:{
      requestId:staleRequest.id,
      idempotencyKey:staleRequest.idempotencyKey,
      expectedRevision:staleRequest.expectedRevision,
      responderId:ownerId,
      value:true,
    },
  };
  const stale=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(ownerPeer,staleWire),staleWire);
  assert.equal(stale.status,"stale");
  assert.equal(staleResults.length,1);
  assert.equal(staleResults[0].status,"stale");
  const afterStale=targeted.length;
  await resumeConnectedCommonPlayAuthorityFactRequestsForCharacter(host,ownerId);
  assert.equal(targeted.length,afterStale,"stale request must close instead of reviving on reconnect");

  revision=11;
  const pendingRequest=await authorityRequest("query.rebind",11);
  const pendingResults:CommonPlayFactResolution[]=[];
  await requestConnectedCommonPlayAuthorityFact(host,{
    request:pendingRequest,
    responderId:ownerId,
    currentRevision:()=>revision,
    onResolution:(resolution)=>{pendingResults.push(resolution);},
  });
  const beforeRebind=targeted.length;
  state.peerManifests.delete(ownerPeer);
  state.peerManifests.set("peer.owner.rebound",manifest(ownerId));
  await resumeConnectedCommonPlayAuthorityFactRequestsForCharacter(host,ownerId);
  assert.equal(targeted.length,beforeRebind+1);
  assert.equal(targeted.at(-1)?.peer,"peer.owner.rebound");
  assert.equal(targeted.at(-1)?.message.type,"common-play-fact-request");

  const response:ConnectedWireMessage={
    type:"common-play-fact-response",
    sessionId,
    response:{
      requestId:pendingRequest.id,
      idempotencyKey:pendingRequest.idempotencyKey,
      expectedRevision:pendingRequest.expectedRevision,
      responderId:ownerId,
      value:false,
    },
  };
  const oldPeer=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(ownerPeer,response),response);
  assert.equal(oldPeer.status,"rejected","old peer must lose owner authority after rebind");
  const rebound=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage("peer.owner.rebound",response),response);
  assert.equal(rebound.status,"resolved");
  assert.equal(pendingResults.length,1);

  state.peerManifests.delete("peer.owner.rebound");
  state.peerManifests.set("peer.owner.newer",manifest(ownerId));
  const afterResolved=targeted.length;
  await resumeConnectedCommonPlayAuthorityFactRequestsForCharacter(host,ownerId);
  assert.equal(targeted.length,afterResolved,"resolved request must not revive after a later rebind");
});
