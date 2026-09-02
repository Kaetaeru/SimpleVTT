import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import type { CatalogEntry, CharacterSheet } from "../../src/app/contracts";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  CONNECTED_CAPABILITIES,
  applyConnectedResolutionPresentation,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import {
  tauriSessionTransport,
  type SessionTransportMessage,
  type SessionTransportStatus,
} from "../../src/app/tauriSessionTransport";

const HOST_STATUS:SessionTransportStatus={role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0};
const STOPPED_STATUS:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type PlayerFixture={
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
  projection:ReturnType<typeof buildCharacterSessionProjectionV1>;
};

function contentEntry(catalog:CatalogEntry[],contentId:string){
  const found=(catalog as ResolvedCatalogEntry[]).find((entry)=>entry.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function installThreePeerHostTransport(){
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    send:tauriSessionTransport.send,
    sendTo:tauriSessionTransport.sendTo,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  let listener:((message:SessionTransportMessage)=>void)|undefined;
  const broadcasts:string[]=[];
  const directed:Array<{peer:string;message:string}>=[];

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(HOST_STATUS);
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  tauriSessionTransport.sendTo=async(peer,message)=>{directed.push({peer,message});return 1;};
  tauriSessionTransport.stop=async()=>structuredClone(STOPPED_STATUS);
  tauriSessionTransport.onMessage=async(handler)=>{listener=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};

  return {
    broadcastCount:()=>broadcasts.length,
    broadcastsAfter:(index:number)=>broadcasts.slice(index).map((entry)=>JSON.parse(entry) as ConnectedWireMessage),
    directed:()=>directed.map((entry)=>({peer:entry.peer,message:JSON.parse(entry.message) as ConnectedWireMessage})),
    emitFrom(peer:string,message:ConnectedWireMessage){
      assert.ok(listener,"Host connected listener must be registered before a peer message is emitted");
      listener({peer,message:encodeConnectedWireMessage(message)});
    },
    restore(){
      tauriSessionTransport.available=original.available;
      tauriSessionTransport.startHost=original.startHost;
      tauriSessionTransport.send=original.send;
      tauriSessionTransport.sendTo=original.sendTo;
      tauriSessionTransport.stop=original.stop;
      tauriSessionTransport.onMessage=original.onMessage;
      tauriSessionTransport.onState=original.onState;
      tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
    },
  };
}

async function eventually(predicate:()=>boolean|Promise<boolean>,message:string){
  for(let attempt=0;attempt<100;attempt+=1){
    if(await predicate())return;
    await new Promise<void>((resolve)=>setImmediate(resolve));
  }
  assert.fail(message);
}

async function createPlayerFixture(host:MockAdapter,characterId:string,name:string,revision:number):Promise<PlayerFixture>{
  const snapshot=await host.getSnapshot();
  const sorcerer=contentEntry(snapshot.catalog,"dnd.srd521.class.sorcerer");
  const human=contentEntry(snapshot.catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(snapshot.catalog,"dnd.srd521.background.soldier");
  const sheet:CharacterSheet={
    id:characterId,
    name,
    className:sorcerer.nameKo||sorcerer.nameEn,
    level:1,
    species:human.nameKo||human.nameEn,
    background:soldier.nameKo||soldier.nameEn,
    hp:8,
    maxHp:8,
    tempHp:0,
    ac:12,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:14,wis:14,cha:16},
    saves:[],
    skills:["설득 +5","지각 +4","조사 +4"],
    features:[],
    equipment:[],
    items:[],
    resources:[],
    attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:revision,
    runtimeRevision:revision,
    classLevels:[{classId:"dnd.srd521.class.sorcerer",level:1}],
  };
  return {characterId,sourceRevision:revision,runtimeRevision:revision,projection:buildCharacterSessionProjectionV1(sheet,snapshot.catalog)};
}

async function connectPlayer(
  host:MockAdapter,
  transport:ReturnType<typeof installThreePeerHostTransport>,
  peer:string,
  name:string,
  fixture:PlayerFixture,
){
  const manifest=connectedManifest(host);
  manifest.character={characterId:fixture.characterId,sourceRevision:fixture.sourceRevision,runtimeRevision:fixture.runtimeRevision};
  transport.emitFrom(peer,{
    type:"hello",
    manifest,
    participantId:`client:${fixture.characterId}`,
    participantName:name,
    knownEventCursor:0,
    projection:fixture.projection,
  });
  await eventually(
    ()=>connectedStateFor(host).peerManifests.get(peer)?.character?.characterId===fixture.characterId,
    `${name} hello must mount an accepted Host SessionProjection`,
  );
  assert.equal(projectedCharacterById(host,fixture.characterId)?.peerId,peer);
  const ack=transport.directed().find((entry)=>entry.peer===peer&&entry.message.type==="hello-ack")?.message;
  assert.equal(ack?.type,"hello-ack");
  if(ack?.type!=="hello-ack")throw new Error(`missing hello-ack for ${name}`);
  assert.notEqual(ack.compatibility.status,"incompatible");
  return manifest.character;
}

async function finishResolution(host:MockAdapter,actorId:string){
  await eventually(async()=>{
    const resolution=(await host.getSnapshot()).resolution;
    return resolution?.actorId===actorId;
  },`Host did not start the requested resolution for ${actorId}`);
  for(let step=0;step<16;step+=1){
    const snapshot=await host.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    if(snapshot.resolution?.rollKind==="check"&&snapshot.resolution.stage==="effect-preview"&&snapshot.resolution.checkTarget===undefined){
      await host.applyDmAdjudication({type:"ability-check-dc",value:15,scope:"resolution"});
      continue;
    }
    assert.ok(snapshot.resolution?.canAdvance,`resolution ${snapshot.resolution?.id??"<missing>"} stopped before complete`);
    await host.advanceResolution();
  }
  assert.fail(`resolution for ${actorId} did not complete within 16 presentation advances`);
}

function prepareClient(adapter:MockAdapter,sessionId:string){
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
}

const CASES=[
  {label:"Influence",actionId:"action.standard.influence.persuasion",name:"영향 주기 · 설득",checkBonus:5},
  {label:"Search",actionId:"action.standard.search.perception",name:"탐색 · 지각",checkBonus:4},
  {label:"Study",actionId:"action.standard.study.investigation",name:"연구 · 조사",checkBonus:4},
] as const;

test("MP-C10 core · Influence/Search/Study picker keeps the selected skill actionId through Host authority and both allowed peers",async()=>{
  for(let index=0;index<CASES.length;index+=1){
    const scenario=CASES[index];
    const transport=installThreePeerHostTransport();
    const host=new MockAdapter();
    let stopped=false;
    try{
      await host.hostSession();
      const state=connectedStateFor(host);
      assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

      const p1=await createPlayerFixture(host,`char.mp-c10.p1.${index}`,`MP-C10 P1 ${scenario.label}`,1300+index*10);
      const p2=await createPlayerFixture(host,`char.mp-c10.p2.${index}`,`MP-C10 P2 ${scenario.label}`,1301+index*10);
      const p1Character=await connectPlayer(host,transport,`peer.mp-c10.p1.${index}`,`MP-C10 P1 ${scenario.label}`,p1);
      await connectPlayer(host,transport,`peer.mp-c10.p2.${index}`,`MP-C10 P2 ${scenario.label}`,p2);
      assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for picker-result fan-out");

      const before=await host.getSnapshot();
      const selected=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.id===scenario.actionId);
      assert.ok(selected,`${scenario.label} picker must expose ${scenario.actionId}`);
      assert.equal(selected.name,scenario.name);
      assert.equal(selected.resolutionKind,"ability-check");
      assert.equal(selected.checkBonus,scenario.checkBonus);

      const actionCursor=state.ledger.cursor;
      const broadcastStart=transport.broadcastCount();
      transport.emitFrom(`peer.mp-c10.p1.${index}`,{
        type:"action-request",
        request:{
          sessionId:state.sessionId,
          requestId:`mp-c10.${scenario.label.toLowerCase()}`,
          actorId:p1.characterId,
          actionId:selected.id,
          targetIds:[],
          knownEventCursor:actionCursor,
          character:p1Character!,
          capabilities:[...CONNECTED_CAPABILITIES],
        },
      });

      const completed=await finishResolution(host,p1.characterId);
      assert.equal(completed.resolution?.stage,"complete");
      assert.equal(completed.resolution?.actorId,p1.characterId);
      assert.equal(completed.resolution?.actionId,scenario.actionId,"Host must resolve the exact picker-selected skill intent");
      assert.equal(state.ledger.cursor,actionCursor+1,"remote picker ability check must commit exactly one Host ledger event");

      const messages=transport.broadcastsAfter(broadcastStart);
      const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
      const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
      assert.ok(live.length>=1,`${scenario.label} check must publish a live public presentation`);
      assert.equal(batches.length,1,`${scenario.label} check must commit exactly one terminal event batch`);
      assert.ok(live.every((message)=>message.presentation.audience.scope==="public"));
      assert.ok(live.every((message)=>message.presentation.actor.id===p1.characterId));
      assert.ok(live.every((message)=>message.presentation.action?.id===scenario.actionId),"public presentation must retain the exact picker-selected actionId");

      const actingClient=new MockAdapter();
      const observingClient=new MockAdapter();
      prepareClient(actingClient,state.sessionId);
      prepareClient(observingClient,state.sessionId);
      for(const message of live){
        const actingApplied=applyConnectedResolutionPresentation(actingClient,message.presentation);
        const observingApplied=applyConnectedResolutionPresentation(observingClient,message.presentation);
        assert.notEqual(actingApplied.status,"rejected");
        assert.equal(observingApplied.status,actingApplied.status);
        const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
        assert.deepEqual(acting.resolution,observing.resolution,"P1 and P2 must consume the same Host check result");
        assert.equal(acting.resolution?.actionId,scenario.actionId);
      }

      await host.stopSession();
      stopped=true;
    }finally{
      if(!stopped)await host.stopSession().catch(()=>undefined);
      transport.restore();
    }
  }
});
