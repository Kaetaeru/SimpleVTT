import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import "../../src/app/productionSessionEmptyEncounterAdapter";
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

test("C1-08: hosting drops the reference fixture's 기록 entries (Aelar, Mira) from the session activity", async () => {
  const restore=installHostTransport();
  try {
    const { adapter }=await dmWithSavedCharacter();
    const before=await adapter.getSnapshot();
    assert.ok(before.activity.some((entry)=>entry.actor==="Aelar"),"the reference seed is present while offline (preview data)");
    const snapshot=await adapter.hostSession();
    assert.equal(snapshot.session.role,"host");
    const fixture=snapshot.activity.filter((entry)=>entry.id==="evt.201"||entry.id==="evt.200"||entry.actor==="Aelar"||entry.actor==="Mira");
    assert.deepEqual(fixture,[],`hosted 기록 must not carry the reference fixture; got ${fixture.map((entry)=>entry.title).join(",")}`);
  } finally { restore(); }
});

test("C1-08: a client snapshot drops the reference fixture's 기록 entries too", async () => {
  const adapter=new MockAdapter();
  (adapter as unknown as { session:{ role:string } }).session.role="client";
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activity.some((entry)=>entry.id==="evt.201"||entry.id==="evt.200"),false);
});
