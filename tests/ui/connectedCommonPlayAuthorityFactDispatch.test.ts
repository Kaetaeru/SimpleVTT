import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  CONNECTED_SESSION_PROTOCOL_VERSION,
  type SessionCompatibilityManifest,
} from "../../src/app/connectedSessionProtocol";
import {
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  requestConnectedCommonPlayAuthorityFact,
  submitConnectedCommonPlayAuthorityFactResponse,
} from "../../src/app/connectedCommonPlayAuthorityFactRuntime";
import {
  decodeConnectedWireMessage,
  encodeConnectedWireMessage,
  type ConnectedWireMessage,
} from "../../src/app/connectedSessionWire";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "../../src/app/tauriSessionTransport";
import { resolveCommonPlayFactQuery, type CommonPlayFactResolution } from "../../src/domain/commonPlaySpatialFactRuntime";

const ownerPeer="peer.owner.dispatch";

function ownerManifest(characterId:string):SessionCompatibilityManifest {
  return {
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:"dnd.srd521",
    capabilities:[...connectedManifest(new MockAdapter()).capabilities,"common-play-authority-fact-v1"],
    character:{characterId,sourceRevision:1,runtimeRevision:1},
  };
}

async function requestFor(characterId:string,queryId:string,revision:number) {
  const resolution=await resolveCommonPlayFactQuery({
    registry:{"target.visible":{valueType:"boolean"}},
    query:{
      id:queryId,
      fact:"target.visible",
      subject:characterId,
      authority:"target-owner",
      visibility:"authority-only",
      unknownPolicy:"request-authority",
    },
    resolutionId:`resolution.${queryId}`,
    expectedRevision:revision,
    provider:null,
  });
  assert.equal(resolution.status,"awaiting-authority");
  if(resolution.status!=="awaiting-authority")throw new Error("expected authority request");
  return resolution.request;
}

type TransportHarness={
  inbound:(message:SessionTransportMessage)=>void;
  sent:string[];
  targeted:Array<{peer:string;message:string}>;
  restore:()=>void;
};

async function installTransport(role:"host"|"client"):Promise<TransportHarness> {
  const transport=tauriSessionTransport as unknown as Record<string,unknown>;
  const original={
    available:transport.available,
    startHost:transport.startHost,
    connectClient:transport.connectClient,
    send:transport.send,
    sendTo:transport.sendTo,
    stop:transport.stop,
    onMessage:transport.onMessage,
    onState:transport.onState,
  };
  let inbound:(message:SessionTransportMessage)=>void=()=>{};
  const sent:string[]=[];
  const targeted:Array<{peer:string;message:string}>=[];
  const status:SessionTransportStatus={
    role,
    state:"connected",
    address:role==="host"?"0.0.0.0:3210":"127.0.0.1:3210",
    peerCount:role==="host"?0:1,
  };
  transport.available=()=>true;
  transport.startHost=async()=>status;
  transport.connectClient=async()=>status;
  transport.send=async(message:string)=>{sent.push(message);return 1;};
  transport.sendTo=async(peer:string,message:string)=>{targeted.push({peer,message});return 1;};
  transport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0} satisfies SessionTransportStatus);
  transport.onMessage=async(handler:(message:SessionTransportMessage)=>void)=>{inbound=handler;return ()=>{};};
  transport.onState=async()=>()=>{};
  return {
    get inbound(){return inbound;},
    sent,
    targeted,
    restore:()=>{Object.assign(transport,original);},
  };
}

async function flushMessages() {
  await new Promise<void>((resolve)=>setTimeout(resolve,0));
}

test("production Host message loop routes a Common Play authority fact response back into the pending resolution",async()=>{
  const harness=await installTransport("host");
  try {
    const host=new MockAdapter();
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.equal(state.mode,"host");
    assert.ok(state.sessionId);
    const characterId="char.remote.owner";
    state.peerManifests.set(ownerPeer,ownerManifest(characterId));
    const request=await requestFor(characterId,"dispatch.host",5);
    const resolutions:CommonPlayFactResolution[]=[];
    const queued=await requestConnectedCommonPlayAuthorityFact(host,{
      request,
      responderId:characterId,
      currentRevision:()=>5,
      onResolution:(resolution)=>{resolutions.push(resolution);},
    });
    assert.equal(queued.status,"queued");
    assert.equal(harness.targeted.length,1);
    const outbound=decodeConnectedWireMessage(harness.targeted[0].message);
    assert.equal(outbound.status,"ok");
    if(outbound.status!=="ok"||outbound.message.type!=="common-play-fact-request")throw new Error("expected Common Play fact request");

    const response:ConnectedWireMessage={
      type:"common-play-fact-response",
      sessionId:state.sessionId!,
      response:{
        requestId:request.id,
        idempotencyKey:request.idempotencyKey,
        expectedRevision:request.expectedRevision,
        responderId:characterId,
        value:true,
      },
    };
    harness.inbound({peer:ownerPeer,message:encodeConnectedWireMessage(response)});
    await flushMessages();
    assert.equal(resolutions.length,1,"Host session message loop must dispatch the response into Common Play authority routing");
    assert.equal(resolutions[0].status,"resolved");
  } finally {
    harness.restore();
  }
});

test("production Client message loop accepts its private Common Play fact request and can return the generic response",async()=>{
  const harness=await installTransport("client");
  try {
    const client=new MockAdapter();
    await client.joinSession("127.0.0.1:3210");
    const localCharacterId=connectedManifest(client).character!.characterId;
    const sessionId="session.dispatch.client";
    harness.inbound({
      peer:"host",
      message:encodeConnectedWireMessage({
        type:"hello-ack",
        sessionId,
        compatibility:{status:"compatible",message:"ok"},
        hostCursor:0,
        events:[],
      }),
    });
    await flushMessages();
    const request=await requestFor(localCharacterId,"dispatch.client",3);
    harness.inbound({
      peer:"host",
      message:encodeConnectedWireMessage({
        type:"common-play-fact-request",
        sessionId,
        responderId:localCharacterId,
        request,
      }),
    });
    await flushMessages();
    const submitted=await submitConnectedCommonPlayAuthorityFactResponse(client,request.id,false);
    assert.equal(submitted.status,"sent","Client session message loop must register the private authority request before UI submits an answer");
    const decoded=harness.sent.map(decodeConnectedWireMessage).filter((entry)=>entry.status==="ok");
    assert.ok(decoded.some((entry)=>entry.status==="ok"&&entry.message.type==="common-play-fact-response"));
  } finally {
    harness.restore();
  }
});
