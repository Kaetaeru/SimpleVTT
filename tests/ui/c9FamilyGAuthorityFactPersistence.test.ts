import assert from "node:assert/strict";
import test from "node:test";

import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import type { SessionTransportMessage } from "../../src/app/tauriSessionTransport";
import {
  applyConnectedCommonPlayAuthorityFactRequest,
  registerConnectedCommonPlayAuthorityFactPersistence,
  registerConnectedCommonPlayAuthorityFactTransport,
  requestConnectedCommonPlayAuthorityFact,
  routeConnectedCommonPlayAuthorityFactResponse,
  submitConnectedCommonPlayAuthorityFactResponse,
} from "../../src/app/connectedCommonPlayAuthorityFactRuntime";
import {
  COMMON_PLAY_STANDARD_FACTS,
  resolveCommonPlayFactQuery,
  type CommonPlayFactResolution,
} from "../../src/domain/commonPlaySpatialFactRuntime";
import {
  encodeConnectedWireMessage,
  type ConnectedWireMessage,
} from "../../src/app/connectedSessionWire";
import { CONNECTED_SESSION_PROTOCOL_VERSION, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";

const sessionId="session.c9-family-g.restart";
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

function adapterFor(mode:"host"|"client") {
  const adapter=new MockAdapter();
  const state=connectedStateFor(adapter);
  state.mode=mode;
  state.sessionId=sessionId;
  if(mode==="host")state.peerManifests.set(ownerPeer,manifest());
  return adapter;
}

function transportMessage(peer:string,message:ConnectedWireMessage):SessionTransportMessage {
  return {peer,message:encodeConnectedWireMessage(message)};
}

test("Family G in-flight authority facts survive adapter restart and retain exactly-once completion",async()=>{
  const storage=new Map<string,string>();
  const targeted:Array<{peer:string;message:ConnectedWireMessage}>=[];
  const outbound:ConnectedWireMessage[]=[];
  registerConnectedCommonPlayAuthorityFactPersistence({
    read:(key)=>storage.get(key)??null,
    write:(key,payload)=>{storage.set(key,payload);},
  });
  registerConnectedCommonPlayAuthorityFactTransport({
    sendTo:async(peer,message)=>{targeted.push({peer,message});},
    send:async(message)=>{outbound.push(message);},
  });

  try {
    const requested=await resolveCommonPlayFactQuery({
      registry:COMMON_PLAY_STANDARD_FACTS,
      query:{
        id:"query.c9-family-g.restart-area",
        fact:"spatial.area-members",
        subject:"area.external.restart",
        authority:"target-owner",
        visibility:"authority-only",
        unknownPolicy:"request-authority",
      },
      resolutionId:"resolution.external.restart-area",
      expectedRevision:17,
      provider:null,
    });
    assert.equal(requested.status,"awaiting-authority");
    if(requested.status!=="awaiting-authority")return;

    const hostBeforeRestart=adapterFor("host");
    const clientBeforeRestart=adapterFor("client");
    const firstResults:CommonPlayFactResolution[]=[];
    const queued=await requestConnectedCommonPlayAuthorityFact(hostBeforeRestart,{
      request:requested.request,
      responderId:ownerId,
      currentRevision:()=>17,
      onResolution:(resolution)=>{firstResults.push(resolution);},
    });
    assert.equal(queued.status,"queued");
    const firstPrompt=targeted.at(-1)?.message;
    assert.equal(firstPrompt?.type,"common-play-fact-request");
    if(firstPrompt?.type!=="common-play-fact-request")return;
    assert.equal((await applyConnectedCommonPlayAuthorityFactRequest(clientBeforeRestart,firstPrompt,ownerId)).status,"applied");
    assert.equal(storage.size,2,"Host and Client in-flight checkpoints should be durable independently");

    const hostAfterRestart=adapterFor("host");
    const clientAfterRestart=adapterFor("client");
    const resumedResults:CommonPlayFactResolution[]=[];
    const sendsBeforeResume=targeted.length;
    const resumed=await requestConnectedCommonPlayAuthorityFact(hostAfterRestart,{
      request:requested.request,
      responderId:ownerId,
      currentRevision:()=>17,
      onResolution:(resolution)=>{resumedResults.push(resolution);},
    });
    assert.equal(resumed.status,"queued","restored Host pending state must reattach the live continuation and resend");
    assert.equal(targeted.length,sendsBeforeResume+1);
    const resumedPrompt=targeted.at(-1)?.message;
    assert.equal(resumedPrompt?.type,"common-play-fact-request");
    if(resumedPrompt?.type!=="common-play-fact-request")return;
    assert.equal((await applyConnectedCommonPlayAuthorityFactRequest(clientAfterRestart,resumedPrompt,ownerId)).status,"duplicate","restored Client pending state must not create a second prompt");

    const submitted=await submitConnectedCommonPlayAuthorityFactResponse(clientAfterRestart,requested.request.id,["combatant.z","combatant.a","combatant.z"]);
    assert.equal(submitted.status,"sent");
    const response=outbound.at(-1);
    assert.equal(response?.type,"common-play-fact-response");
    if(response?.type!=="common-play-fact-response")return;
    const resolved=await routeConnectedCommonPlayAuthorityFactResponse(hostAfterRestart,transportMessage(ownerPeer,response),response);
    assert.equal(resolved.status,"resolved");
    if(resolved.status!=="resolved")return;
    assert.deepEqual(resolved.answer.value,["combatant.a","combatant.z"]);
    assert.equal(firstResults.length,0,"pre-restart callback must not be required after restart");
    assert.equal(resumedResults.length,1,"reattached continuation must resolve exactly once");

    const hostAfterCompletionRestart=adapterFor("host");
    const sendsBeforeCompletedReplay=targeted.length;
    const completedReplay=await requestConnectedCommonPlayAuthorityFact(hostAfterCompletionRestart,{
      request:requested.request,
      responderId:ownerId,
      currentRevision:()=>17,
      onResolution:()=>{throw new Error("completed durable replay must not invoke a second continuation");},
    });
    assert.equal(completedReplay.status,"duplicate");
    if(completedReplay.status==="duplicate"){
      assert.equal(completedReplay.resolution.status,"resolved");
      if(completedReplay.resolution.status==="resolved")assert.deepEqual(completedReplay.resolution.answer.value,["combatant.a","combatant.z"]);
    }
    assert.equal(targeted.length,sendsBeforeCompletedReplay,"completed durable history must suppress retransmission after another restart");
  } finally {
    registerConnectedCommonPlayAuthorityFactPersistence(null);
  }
});
