import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionContracts";
import "../../src/app/sessionInventoryRuntimeAdapter";
import type { CatalogEntry, CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { projectedCharacterById, projectedCharacterForPeer } from "../../src/app/characterSessionProjectionRegistry";
import type { SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";

const SOURCE_ID="dnd.srd-5.2.1";
const VERSION="2024";

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

function character():CharacterSheet {
  return {
    id:"char.phase13.handshake",name:"Handshake Unknown",className:"파이터",level:1,species:"인간",background:"군인",
    hp:8,maxHp:12,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],equipment:[],items:[],
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],attacks:[],
    goldGp:42,
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:4,runtimeRevision:6,
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

function host() {
  const adapter=new MockAdapter();
  (adapter as unknown as {catalog:CatalogEntry[]}).catalog=structuredClone(catalog);
  return adapter;
}

test("host-unknown Character requires and mounts a validated SessionProjection", async () => {
  const adapter=host();
  const portrait={asset:{mimeType:"image/png" as const,dataUrl:"data:image/png;base64,iVBORw0KGgo=",byteLength:8},focalX:.5,focalY:.5};
  const sheet={...character(),portrait};
  const rejected=acceptHostCharacterSessionProjection(adapter,"peer.1",manifest(sheet));
  assert.equal(rejected.status,"rejected");
  if (rejected.status==="rejected") assert.match(rejected.error,/SessionProjection is required/);

  const projection=buildCharacterSessionProjectionV1(sheet,catalog);
  const accepted=acceptHostCharacterSessionProjection(adapter,"peer.1",manifest(sheet),projection);
  assert.deepEqual(accepted,{status:"accepted",mode:"mounted",characterId:sheet.id});
  assert.equal(projectedCharacterForPeer(adapter,"peer.1")?.sheet.hp,8);
  assert.deepEqual(projectedCharacterForPeer(adapter,"peer.1")?.sheet.portrait,portrait);
  const snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.some((entity)=>entity.id===sheet.id));
  assert.equal(snapshot.characters.some((entry)=>entry.id===sheet.id),false);
  assert.deepEqual(snapshot.sessionCharacterInventories?.[sheet.id],{
    characterId:sheet.id,
    characterName:sheet.name,
    revision:sheet.runtimeRevision,
    goldGp:42,
    items:[],
  },"Host inventory UI must be seeded from the owner projection on its first connected render");
});

test("reconnect rebinds peer without replacing host authoritative runtime with stale client projection", () => {
  const adapter=host();
  const sheet=character();
  const projection=buildCharacterSessionProjectionV1(sheet,catalog);
  assert.equal(acceptHostCharacterSessionProjection(adapter,"peer.old",manifest(sheet),projection).status,"accepted");

  const stale=structuredClone(projection);
  stale.runtime.hp=3;
  stale.portrait={asset:{mimeType:"image/png",dataUrl:"data:image/png;base64,iVBORw0KGgo=",byteLength:8},focalX:.2,focalY:.8};
  const reconnected=acceptHostCharacterSessionProjection(adapter,"peer.new",manifest(sheet),stale);
  assert.deepEqual(reconnected,{status:"accepted",mode:"rebound",characterId:sheet.id});
  assert.equal(projectedCharacterForPeer(adapter,"peer.old"),undefined);
  assert.equal(projectedCharacterForPeer(adapter,"peer.new")?.sheet.hp,8);
  assert.equal(projectedCharacterById(adapter,sheet.id)?.sheet.hp,8);
  assert.deepEqual(projectedCharacterById(adapter,sheet.id)?.sheet.portrait,stale.portrait);
});

test("reconnect rejects source/content drift even if the client reuses the old source revision", () => {
  const adapter=host();
  const sheet=character();
  const projection=buildCharacterSessionProjectionV1(sheet,catalog);
  assert.equal(acceptHostCharacterSessionProjection(adapter,"peer.old",manifest(sheet),projection).status,"accepted");

  const drifted=structuredClone(projection);
  drifted.source.name="Changed Without Source Revision";
  const rejected=acceptHostCharacterSessionProjection(adapter,"peer.new",manifest(sheet),drifted);
  assert.equal(rejected.status,"rejected");
  if (rejected.status==="rejected") assert.match(rejected.error,/source\/content changed/);
});

test("host-known permanent Character keeps the Phase 12 path and does not require a projection", () => {
  const adapter=host();
  const knownManifest:SessionCompatibilityManifest={
    protocolVersion:1,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
    character:{characterId:"char.aelar",sourceRevision:0,runtimeRevision:0},
  };
  const accepted=acceptHostCharacterSessionProjection(adapter,"peer.known",knownManifest);
  assert.deepEqual(accepted,{status:"accepted",mode:"host-known",characterId:"char.aelar"});
});

test("host-known Character with a Client projection is mounted as the peer-owned Scene actor", async () => {
  const adapter=host();
  const sheet={...character(),id:"char.aelar",name:"Remote Aelar Identity"};
  const accepted=acceptHostCharacterSessionProjection(
    adapter,
    "peer.known-projected",
    manifest(sheet),
    buildCharacterSessionProjectionV1(sheet,catalog),
  );

  assert.deepEqual(accepted,{status:"accepted",mode:"mounted",characterId:"char.aelar"});
  assert.equal(projectedCharacterForPeer(adapter,"peer.known-projected")?.sheet.name,"Remote Aelar Identity");
  assert.equal((await adapter.getSnapshot()).scene.entities.find((entry)=>entry.id==="char.aelar")?.name,"Remote Aelar Identity");
});
