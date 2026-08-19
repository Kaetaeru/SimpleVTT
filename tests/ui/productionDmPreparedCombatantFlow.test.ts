import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import "../../src/app/productionCombatantPreparationAdapter";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const SCOUT_PAYLOAD=JSON.stringify({
  id:"combatant.phase14.prepared-scout",
  name:"준비된 정찰병",
  ac:14,
  maxHp:20,
  speed:35,
  proficiencyBonus:2,
  abilities:{str:8,dex:16,con:12,int:10,wis:14,cha:10},
  savingThrowProficiencies:["wis"],
  resistances:[],
  immunities:[],
  vulnerabilities:[],
  runtimeActions:[{
    id:"dagger",
    name:"단검",
    category:"weapon",
    sourceKind:"weapon",
    attackBonus:5,
    rangeFeet:5,
    damage:{type:"관통",dice:"1d4",flat:3},
  }],
});

function installFakeDesktopTransport() {
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
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async()=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    restore() {
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

test("Host can add/remove Encounter Combatants in active Freeform and Initiative blocks unsafe removal",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    let snapshot=await adapter.hostSession();
    assert.equal(snapshot.session.lifecycle,"preparing");

    await adapter.previewCombatantImport(SCOUT_PAYLOAD);
    await adapter.activateCombatantImport();
    snapshot=await adapter.instantiateCombatant("combatant.phase14.prepared-scout");
    const first=snapshot.scene.entities.find((entity)=>entity.id==="combatant.phase14.prepared-scout.instance-1");
    assert.ok(first);
    const firstDagger=(snapshot.scene.actionsByActor[first.id]??[]).find((action)=>action.name==="단검");
    assert.equal(firstDagger?.attackBonus,5);
    assert.equal(firstDagger?.damage?.[0]?.dice,"1d4");

    const encounter=adapter as MockAdapter & {removeCombatant(combatantId:string):Promise<typeof snapshot>};
    snapshot=await encounter.removeCombatant(first.id);
    assert.equal(snapshot.scene.entities.some((entity)=>entity.id===first.id),false);

    snapshot=await adapter.instantiateCombatant("combatant.phase14.prepared-scout");
    const liveScout=snapshot.scene.entities.find((entity)=>entity.id==="combatant.phase14.prepared-scout.instance-1");
    assert.ok(liveScout);

    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    state.peerManifests.set("peer.player",connectedManifest(adapter));
    state.peerParticipants.set("peer.player","client:char.phase14.player");
    app.session.participants=[
      {id:"host",name:"DM Host",state:"connected",ready:false},
      {id:"client:char.phase14.player",name:"Phase14 Player",characterName:"Phase14 Player",state:"connected",ready:true},
    ];

    snapshot=await adapter.startPreparedSession("freeform");
    assert.equal(snapshot.session.lifecycle,"live");
    assert.equal(snapshot.sessionMode,"freeform");
    assert.ok(snapshot.scene.entities.some((entity)=>entity.id===liveScout.id));

    snapshot=await encounter.removeCombatant(liveScout.id);
    assert.equal(snapshot.scene.entities.some((entity)=>entity.id===liveScout.id),false,"active Freeform removal uses the same Scene authority");
    assert.equal(snapshot.scene.actionsByActor[liveScout.id],undefined);
    assert.equal(snapshot.scene.economyByActor[liveScout.id],undefined);

    snapshot=await adapter.instantiateCombatant("combatant.phase14.prepared-scout");
    const initiativeScout=snapshot.scene.entities.find((entity)=>entity.id==="combatant.phase14.prepared-scout.instance-1");
    assert.ok(initiativeScout);
    snapshot=await adapter.startInitiative();
    assert.equal(snapshot.sessionMode,"initiative");
    assert.ok(snapshot.scene.economyByActor[initiativeScout.id]);

    const blocked=await encounter.removeCombatant(initiativeScout.id);
    assert.ok(blocked.scene.entities.some((entity)=>entity.id===initiativeScout.id),"Initiative removal must not silently mutate turn runtime");
    assert.match(blocked.session.compatibilityMessage,/active Freeform/i);
  } finally {
    transport.restore();
  }
});

test("legacy Host preparation bridge still exposes the canonical Combatant commands without debug setup",()=>{
  const source=readFileSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url),"utf8");
  assert.match(source,/Combatant 준비/);
  assert.match(source,/combatantDefinitions/);
  assert.match(source,/instantiateCombatant/);
  assert.match(source,/removeCombatant/);
  assert.doesNotMatch(source,/setReferenceRole|loadReferenceScenario|Ctrl\+Shift\+D/);
});
