import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger, type ConnectedActionRequest, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const SOURCE_ID="dnd.srd-5.2.1";
const VERSION="2024";
const PEER="peer.phase13.remote";

function entry(contentId:string,category:CatalogEntry["category"],nameKo:string,nameEn:string):CatalogEntry & {contentId:string;sourceId:string} {
  return {
    id:catalogQualifiedId(contentId,SOURCE_ID,VERSION),contentId,sourceId:SOURCE_ID,category,nameKo,nameEn,
    scope:"builtin",source:"SRD 5.2.1",version:VERSION,description:"test",relationships:[],capabilities:[],
  };
}

const catalog:CatalogEntry[]=[
  entry("dnd.srd521.class.fighter","class","파이터","Fighter"),
  entry("dnd.srd521.species.human","species","인간","Human"),
  entry("dnd.srd521.background.soldier","background","군인","Soldier"),
];

function remoteCharacter():CharacterSheet {
  return {
    id:"char.phase13.remote-fighter",name:"Remote Fighter",className:"파이터",level:1,species:"인간",background:"군인",
    hp:4,maxHp:12,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],equipment:[],items:[],
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
  };
}

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {
    protocolVersion:1,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
    character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0},
  };
}

async function finishResolution(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<8&&snapshot.resolution?.stage!=="complete";step+=1) {
    assert.equal(snapshot.resolution?.canAdvance,true,`projected resolution stalled at ${snapshot.resolution?.stage}`);
    snapshot=await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

test("host-unknown projected Fighter resolves Second Wind through host authority without creating a host Character record", async () => {
  const host=new MockAdapter();
  const app=host as unknown as {catalog:CatalogEntry[];role:"player"|"dm"};
  app.catalog=structuredClone(catalog);
  app.role="dm";
  const before=await host.getSnapshot();
  const remote=remoteCharacter();
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  assert.equal(acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection).status,"accepted");

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.phase13.projected";
  state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));
  state.peerManifests.set(PEER,structuredClone(remoteManifest));

  const sentToPeer:string[]=[];
  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  const originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async (message:string)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async (_peer:string,message:string)=>{sentToPeer.push(message);return 1;};

  try {
    const request:ConnectedActionRequest={
      sessionId:state.sessionId,
      requestId:"request.phase13.second-wind",
      actorId:remote.id,
      actionId:"action.second-wind",
      targetIds:[remote.id],
      knownEventCursor:0,
      character:remoteManifest.character,
      capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const pending=await host.getSnapshot();
    assert.equal(pending.activeCharacter.id,remote.id,"host staged resolution must run in the projected Character context");
    assert.equal(connectedStateFor(host).pendingRemoteAction?.request.requestId,request.requestId);

    const completed=await finishResolution(host);
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"host local Character context must be restored after canonical commit");
    assert.equal(connectedStateFor(host).pendingRemoteAction,null);
    assert.equal(connectedStateFor(host).ledger?.cursor,1);
    assert.equal(completed.characters.some((entry)=>entry.id===remote.id),false,"host permanent Character library must not gain a SessionProjection record");
    assert.deepEqual(completed.characters,before.characters);

    const mounted=projectedCharacterById(host,remote.id);
    assert.ok(mounted);
    assert.equal(mounted?.sheet.resources.find((resource)=>resource.id==="resource.second-wind")?.current,1);
    assert.ok((mounted?.sheet.hp??0)>remote.hp,"host ephemeral projected HP must receive the committed healing event");
    assert.ok((mounted?.sheet.hp??0)<=remote.maxHp);

    assert.equal(broadcasts.length,1,"canonical remote commit must broadcast exactly one ordered event batch");
    const batch=JSON.parse(broadcasts[0]) as {type:string;events:Array<{sequence:number;actorId?:string;payload:{kind:string;resolutionEvents?:unknown[]}}>};
    assert.equal(batch.type,"event-batch");
    assert.equal(batch.events.length,1);
    assert.equal(batch.events[0].sequence,1);
    assert.equal(batch.events[0].actorId,remote.id);
    assert.equal(batch.events[0].payload.kind,"resolution");
    assert.ok((batch.events[0].payload.resolutionEvents?.length??0)>0);
    assert.equal(sentToPeer.length,0);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.length,1,"duplicate request must not create a second host broadcast");
    assert.equal(sentToPeer.length,1,"duplicate request should return the already committed event directly to the peer");
    const duplicate=JSON.parse(sentToPeer[0]) as {type:string;events:Array<{sequence:number}>};
    assert.equal(duplicate.type,"event-batch");
    assert.equal(duplicate.events[0].sequence,1);
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
