import assert from "node:assert/strict";
import test from "node:test";

import { MockAdapter } from "../../src/app/mockAdapter";
import {
  requestConnectedCommonPlayAuthorityFact,
  resumeConnectedCommonPlayAuthorityFactRequestsForCharacter,
  routeConnectedCommonPlayAuthorityFactResponse,
  registerConnectedCommonPlayAuthorityFactTransport,
} from "../../src/app/connectedCommonPlayAuthorityFactRuntime";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  CONNECTED_SESSION_PROTOCOL_VERSION,
  type SessionCompatibilityManifest,
} from "../../src/app/connectedSessionProtocol";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import type { SessionTransportMessage } from "../../src/app/tauriSessionTransport";
import {
  COMMON_PLAY_STANDARD_FACTS,
  resolveCommonPlayFactQuery,
  type CommonPlayFactResolution,
} from "../../src/domain/commonPlaySpatialFactRuntime";

const sessionId="session.c9-family-g-standard-spatial";
const ownerId="char.owner";
const originalPeer="peer.owner.original";
const reboundPeer="peer.owner.rebound";

function manifest():SessionCompatibilityManifest {
  return {
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:"dnd.srd521",
    capabilities:["common-play-authority-fact-v1"],
    character:{characterId:ownerId,sourceRevision:1,runtimeRevision:1},
  };
}

function transportMessage(peer:string,message:ConnectedWireMessage):SessionTransportMessage {
  return {peer,message:encodeConnectedWireMessage(message)};
}

test("Family G standard within-reach authority request resumes on owner reconnect and resolves once",async()=>{
  const host=new MockAdapter();
  const connected=connectedStateFor(host);
  connected.mode="host";
  connected.sessionId=sessionId;
  connected.peerManifests.set(originalPeer,manifest());

  const targeted:Array<{peer:string;message:ConnectedWireMessage}>=[];
  registerConnectedCommonPlayAuthorityFactTransport({
    sendTo:async(peer,message)=>{targeted.push({peer,message});},
    send:async()=>{},
  });

  const pending=await resolveCommonPlayFactQuery({
    registry:COMMON_PLAY_STANDARD_FACTS,
    query:{
      id:"reach",
      fact:"spatial.within-reach",
      subject:"combatant.external-target",
      authority:"target-owner",
      visibility:"authority-only",
      unknownPolicy:"request-authority",
    },
    resolutionId:"resolution.c9-family-g-reach",
    expectedRevision:7,
  });
  assert.equal(pending.status,"awaiting-authority");
  if(pending.status!=="awaiting-authority") return;

  const resolutions:CommonPlayFactResolution[]=[];
  await requestConnectedCommonPlayAuthorityFact(host,{
    request:pending.request,
    responderId:ownerId,
    currentRevision:()=>7,
    onResolution:(resolution)=>{resolutions.push(resolution);},
  });
  assert.equal(targeted.length,1);
  assert.equal(targeted[0].peer,originalPeer);
  assert.equal(targeted[0].message.type,"common-play-fact-request");

  connected.peerManifests.delete(originalPeer);
  connected.peerManifests.set(reboundPeer,manifest());
  await resumeConnectedCommonPlayAuthorityFactRequestsForCharacter(host,ownerId);
  assert.equal(targeted.length,2);
  assert.equal(targeted[1].peer,reboundPeer);
  assert.equal(targeted[1].message.type,"common-play-fact-request");

  const response:ConnectedWireMessage={
    type:"common-play-fact-response",
    sessionId,
    response:{
      requestId:pending.request.id,
      idempotencyKey:pending.request.idempotencyKey,
      expectedRevision:7,
      responderId:ownerId,
      value:true,
    },
  };
  const stalePeer=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(originalPeer,response),response);
  assert.equal(stalePeer.status,"rejected");
  const resolved=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(reboundPeer,response),response);
  assert.equal(resolved.status,"resolved");
  assert.equal(resolutions.length,1);
  assert.equal(resolutions[0].status,"resolved");
  if(resolutions[0].status!=="resolved") return;
  assert.equal(resolutions[0].answer.fact,"spatial.within-reach");
  assert.equal(resolutions[0].answer.value,true);

  const duplicate=await routeConnectedCommonPlayAuthorityFactResponse(host,transportMessage(reboundPeer,response),response);
  assert.equal(duplicate.status,"duplicate");
  assert.equal(resolutions.length,1);
});
