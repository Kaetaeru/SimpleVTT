import assert from "node:assert/strict";
import test from "node:test";

import { MockAdapter } from "../../src/app/mockAdapter";
import {
  applyConnectedCommonPlayAuthorityFactRequest,
  registerConnectedCommonPlayAuthorityFactPersistence,
  registerConnectedCommonPlayAuthorityFactTransport,
  requestConnectedCommonPlayAuthorityFact,
  routeConnectedCommonPlayAuthorityFactResponse,
  submitConnectedCommonPlayAuthorityFactResponse,
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

const sessionId="session.c9-family-g-restart";
const ownerId="char.owner.restart";
const ownerPeer="peer.owner.restart";

function manifest():SessionCompatibilityManifest {
  return {
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:"dnd.srd521",
    capabilities:["common-play-authority-fact-v1"],
    character:{characterId:ownerId,sourceRevision:1,runtimeRevision:1},
  };
}

function hostAdapter() {
  const adapter=new MockAdapter();
  const connected=connectedStateFor(adapter);
  connected.mode="host";
  connected.sessionId=sessionId;
  connected.peerManifests.set(ownerPeer,manifest());
  return adapter;
}

function clientAdapter() {
  const adapter=new MockAdapter();
  const connected=connectedStateFor(adapter);
  connected.mode="client";
  connected.sessionId=sessionId;
  return adapter;
}

function transportMessage(peer:string,message:ConnectedWireMessage):SessionTransportMessage {
  return {peer,message:encodeConnectedWireMessage(message)};
}

test("Family G in-flight spatial authority survives fresh Host and Client adapters",async()=>{
  const stored=new Map<string,string>();
  registerConnectedCommonPlayAuthorityFactPersistence({
    read:(key)=>stored.get(key)??null,
    write:(key,payload)=>{stored.set(key,payload);},
  });

  const targeted:Array<{peer:string;message:ConnectedWireMessage}>=[];
  const clientOutbound:ConnectedWireMessage[]=[];
  registerConnectedCommonPlayAuthorityFactTransport({
    sendTo:async(peer,message)=>{targeted.push({peer,message});},
    send:async(message)=>{clientOutbound.push(message);},
  });

  try {
    const pending=await resolveCommonPlayFactQuery({
      registry:COMMON_PLAY_STANDARD_FACTS,
      query:{
        id:"restart-area",
        fact:"spatial.area-members",
        subject:"combatant.external-origin",
        authority:"target-owner",
        visibility:"authority-only",
        unknownPolicy:"request-authority",
      },
      resolutionId:"resolution.c9-family-g-restart",
      expectedRevision:17,
    });
    assert.equal(pending.status,"awaiting-authority");
    if(pending.status!=="awaiting-authority")return;

    const firstHost=hostAdapter();
    const firstClient=clientAdapter();
    const initial=await requestConnectedCommonPlayAuthorityFact(firstHost,{
      request:pending.request,
      responderId:ownerId,
      currentRevision:()=>17,
      onResolution:()=>{},
    });
    assert.equal(initial.status,"queued");
    assert.equal(targeted.length,1);
    const firstPrompt=targeted[0].message;
    assert.equal(firstPrompt.type,"common-play-fact-request");
    if(firstPrompt.type!=="common-play-fact-request")return;
    const firstApplied=await applyConnectedCommonPlayAuthorityFactRequest(firstClient,firstPrompt,ownerId);
    assert.equal(firstApplied.status,"applied");

    const restartedHost=hostAdapter();
    const restartedClient=clientAdapter();
    const resolutions:CommonPlayFactResolution[]=[];
    const resumed=await requestConnectedCommonPlayAuthorityFact(restartedHost,{
      request:pending.request,
      responderId:ownerId,
      currentRevision:()=>17,
      onResolution:(resolution)=>{resolutions.push(resolution);},
    });
    assert.equal(resumed.status,"queued");
    assert.equal(targeted.length,2,"fresh Host must restore and resend the unresolved request after callback rebind");
    const resumedPrompt=targeted[1].message;
    assert.equal(resumedPrompt.type,"common-play-fact-request");
    if(resumedPrompt.type!=="common-play-fact-request")return;

    const replayedPending=await applyConnectedCommonPlayAuthorityFactRequest(restartedClient,resumedPrompt,ownerId);
    assert.equal(replayedPending.status,"duplicate","fresh Client must restore the unresolved owner prompt");
    const submitted=await submitConnectedCommonPlayAuthorityFactResponse(
      restartedClient,
      pending.request.id,
      ["combatant.gamma","combatant.alpha","combatant.gamma"],
    );
    assert.equal(submitted.status,"sent");
    assert.equal(clientOutbound.length,1);
    const response=clientOutbound[0];
    assert.equal(response.type,"common-play-fact-response");
    if(response.type!=="common-play-fact-response")return;

    const resolved=await routeConnectedCommonPlayAuthorityFactResponse(
      restartedHost,
      transportMessage(ownerPeer,response),
      response,
    );
    assert.equal(resolved.status,"resolved");
    assert.equal(resolutions.length,1);
    assert.equal(resolutions[0].status,"resolved");
    if(resolutions[0].status==="resolved"){
      assert.deepEqual(resolutions[0].answer.value,["combatant.alpha","combatant.gamma"]);
    }

    const completedHost=hostAdapter();
    const duplicate=await routeConnectedCommonPlayAuthorityFactResponse(
      completedHost,
      transportMessage(ownerPeer,response),
      response,
    );
    assert.equal(duplicate.status,"duplicate","fresh Host must retain completed-request idempotency history");

    const answeredClient=clientAdapter();
    const replayedAnswer=await applyConnectedCommonPlayAuthorityFactRequest(answeredClient,resumedPrompt,ownerId);
    assert.equal(replayedAnswer.status,"replayed-response","fresh Client must retain and replay its answered spatial fact");
    assert.equal(clientOutbound.length,2);
    assert.deepEqual(clientOutbound[1],response);
  } finally {
    registerConnectedCommonPlayAuthorityFactPersistence(null);
  }
});
