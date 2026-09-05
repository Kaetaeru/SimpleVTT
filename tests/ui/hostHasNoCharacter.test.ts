import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import type { CharacterSheet, CharacterSummary, SessionCompatibilityManifest } from "../../src/app/contracts";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport, type SessionTransportStatus } from "../../src/app/tauriSessionTransport";

const HOST_STATUS:SessionTransportStatus={role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0};
const STOPPED_STATUS:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};

function installHostTransport() {
  const original={ available:tauriSessionTransport.available, startHost:tauriSessionTransport.startHost, send:tauriSessionTransport.send, sendTo:tauriSessionTransport.sendTo, stop:tauriSessionTransport.stop, onMessage:tauriSessionTransport.onMessage, onState:tauriSessionTransport.onState, onPeerLifecycle:tauriSessionTransport.onPeerLifecycle };
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(HOST_STATUS);
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>structuredClone(STOPPED_STATUS);
  tauriSessionTransport.onMessage=async()=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return ()=>Object.assign(tauriSessionTransport,original);
}

type Internal={ activeCharacter:CharacterSheet; characters:CharacterSummary[] };

/** The DM edited a real saved character last (the reported bug: it walked into the hosted scene). */
async function dmWithSavedCharacter() {
  const adapter=new MockAdapter();
  const template=await adapter.getSnapshot();
  const character={ ...structuredClone(template.activeCharacter), id:"char.dm-edited-last", name:"DM이 마지막으로 편집한 캐릭터", saveState:"saved" as const };
  const internal=adapter as unknown as Internal;
  internal.activeCharacter=structuredClone(character);
  internal.characters=[...internal.characters,structuredClone(character)];
  return { adapter, character };
}

test("C1-01: hosting never projects the DM's own character into the scene", async () => {
  const restore=installHostTransport();
  try {
    const { adapter, character }=await dmWithSavedCharacter();
    let snapshot=await adapter.hostSession();
    assert.equal(snapshot.session.role,"host");
    assert.equal(snapshot.session.lifecycle,"live");
    const characters=snapshot.scene.entities.filter((entity)=>entity.kind==="character");
    assert.deepEqual(characters,[],`host scene must hold no character, got ${characters.map((entity)=>entity.id).join(",")}`);
    assert.equal((snapshot.scene.actionsByActor[character.id]??[]).length,0);
    assert.equal(snapshot.scene.economyByActor[character.id],undefined);
    assert.ok(!snapshot.session.participants.some((participant)=>participant.characterName===character.name),"the DM is not listed as a playing character");

    // Later snapshots (the reconcile runs on every read) keep it out, even after the DM starts initiative.
    await adapter.setReferenceRole("dm");
    snapshot=await adapter.startInitiative();
    assert.equal(snapshot.scene.entities.some((entity)=>entity.id===character.id),false);
    assert.notEqual(snapshot.scene.currentActorId,character.id);
  } finally { restore(); }
});

test("C1-01: a player's projected character still joins the host scene", async () => {
  const restore=installHostTransport();
  try {
    const { adapter }=await dmWithSavedCharacter();
    await adapter.hostSession();
    const template=await adapter.getSnapshot();
    const sheet={
      id:"char.player-one",name:"플레이어 원",className:"파이터",level:1,species:"인간",background:"군인",
      hp:12,maxHp:12,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
      abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],equipment:[],items:[],
      resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],attacks:[],
      rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:1,runtimeRevision:1,
      classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
    } as unknown as CharacterSheet;
    const manifest:SessionCompatibilityManifest={ protocolVersion:1, rulesProfileId:"dnd.srd-5.2.1", capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"], character:{ characterId:sheet.id, sourceRevision:1, runtimeRevision:1 } };
    const accepted=acceptHostCharacterSessionProjection(adapter,"peer.one",manifest,buildCharacterSessionProjectionV1(sheet,template.catalog));
    assert.equal(accepted.status,"accepted",JSON.stringify(accepted));
    const snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.player-one")?.name,"플레이어 원");
    assert.equal(snapshot.scene.entities.some((entity)=>entity.id==="char.dm-edited-last"),false);
  } finally { restore(); }
});

test("C1-01: the host workspace does not name a DM character", () => {
  const source=readFileSync(new URL("../../src/ProductionSessionWorkspaceBridge.tsx",import.meta.url),"utf8");
  assert.match(source,/snapshot\.session\.role==="client"&&<div><span>Character<\/span>/);
});
