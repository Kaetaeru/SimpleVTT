import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import "../../src/app/productionSessionEmptyEncounterAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function installFakeDesktopHost() {
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
  return { restore() {
    tauriSessionTransport.available=original.available;
    tauriSessionTransport.startHost=original.startHost;
    tauriSessionTransport.send=original.send;
    tauriSessionTransport.sendTo=original.sendTo;
    tauriSessionTransport.stop=original.stop;
    tauriSessionTransport.onMessage=original.onMessage;
    tauriSessionTransport.onState=original.onState;
    tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
  }};
}

test("production Session page has one stable state-driven workspace",()=>{
  const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
  const session=readFileSync(new URL("../../src/ProductionSessionWorkspaceBridge.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../../src/production-session-workspace.css",import.meta.url),"utf8");

  assert.match(main,/<ProductionSessionWorkspaceBridge \/>/);
  assert.doesNotMatch(main,/<ProductionSessionLifecycleBridge \/>/);
  assert.doesNotMatch(main,/<ProductionPlayerLobbyBridge \/>/);
  assert.match(session,/새 세션 만들기/);
  assert.match(session,/세션 참가하기/);
  assert.match(session,/세션 이름/);
  assert.match(session,/Host 주소/);
  assert.match(session,/snapshot\.session\.role\s*===\s*"offline"/);
  assert.match(session,/snapshot\.session\.role\s*===\s*"host"/);
  assert.match(session,/snapshot\.session\.role\s*===\s*"client"/);
  assert.doesNotMatch(session,/snapshot\.role\s*===\s*"dm"|snapshot\.role\s*!==\s*"player"/);
  assert.match(css,/session-grid\s*>\s*:not\(\.production-session-workspace\)/);
  assert.match(css,/screen-head/);
});

test("routine Session workspace prioritizes user actions over implementation diagnostics",()=>{
  const session=readFileSync(new URL("../../src/ProductionSessionWorkspaceBridge.tsx",import.meta.url),"utf8");
  assert.match(session,/Host 중지/);
  assert.match(session,/플레이 시작/);
  assert.match(session,/Ready/);
  assert.match(session,/재연결/);
  assert.match(session,/다시 참가|참가하기/);
  assert.doesNotMatch(session,/>Role</);
  assert.doesNotMatch(session,/RulesProfile/);
  assert.doesNotMatch(session,/Reference 흐름|Reference Host|Reference Join/);
  assert.doesNotMatch(session,/Ctrl\+Shift\+D/);
});

test("starting a production Host clears reference fixture actors from the encounter",async()=>{
  const transport=installFakeDesktopHost();
  try {
    const adapter=new MockAdapter();
    const snapshot=await adapter.hostSession();
    const ids=new Set(snapshot.scene.entities.map((entity)=>entity.id));
    for (const id of [
      "char.aelar",
      "char.mira",
      "combatant.goblin-a",
      "combatant.goblin-b",
      "combatant.wolf",
      "combatant.training-guardian",
    ]) assert.equal(ids.has(id),false,`${id} must not preload into a production Host encounter`);
    assert.equal(snapshot.scene.entities.length,0,"a fresh production Host encounter should start empty");
  } finally {
    transport.restore();
  }
});
