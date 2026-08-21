import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import "../../src/app/productionSessionEmptyEncounterAdapter";
import "../../src/app/productionSessionUiStateAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import {
  clearNextSessionHostEndpointForTests,
  composeSessionEndpoint,
  configureNextSessionHostEndpoint,
  consumeNextSessionHostEndpoint,
} from "../../src/app/sessionEndpointPreferences";

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
  const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
  const session=readFileSync(new URL("../../src/ProductionSessionWorkspaceBridge.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../../src/production-session-workspace.css",import.meta.url),"utf8");

  assert.match(main,/<ProductionSessionWorkspaceBridge \/>/);
  assert.doesNotMatch(main,/<ProductionSessionLifecycleBridge \/>/);
  assert.doesNotMatch(main,/<ProductionPlayerLobbyBridge \/>/);
  assert.match(app,/id="production-session-workspace-root"/);
  assert.match(session,/production-session-workspace-root/);
  assert.match(session,/새 세션 만들기/);
  assert.match(session,/세션 참가하기/);
  assert.match(session,/세션 이름/);
  assert.match(session,/Host 주소/);
  assert.match(session,/snapshot\.session\.role\s*===\s*"offline"/);
  assert.match(session,/snapshot\.session\.role\s*===\s*"host"/);
  assert.match(session,/snapshot\.session\.role\s*===\s*"client"/);
  assert.doesNotMatch(session,/snapshot\.role\s*===\s*"dm"|snapshot\.role\s*!==\s*"player"/);
  assert.doesNotMatch(css,/session-grid\s*>\s*:not\(\.production-session-workspace\)/);
});

test("production Session screen owns a definite viewport scroll container",()=>{
  const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../../src/production-session-workspace.css",import.meta.url),"utf8");
  assert.match(app,/className="screen page-dark production-session-screen"/);
  assert.match(css,/\.production-session-screen\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*height:\s*auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
  assert.match(css,/\.production-session-screen\s*\{[^}]*overscroll-behavior:\s*contain;[^}]*scrollbar-gutter:\s*stable;/s);
  assert.match(css,/\.production-session-mount\s*\{[^}]*min-height:\s*100%;[^}]*align-content:\s*start;/s);
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

test("V0.9 direct network entry exposes explicit Host bind and Join address ports",()=>{
  const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
  const direct=readFileSync(new URL("../../src/ProductionSessionDirectNetworkBridge.tsx",import.meta.url),"utf8");
  const runtime=readFileSync(new URL("../../src/app/directNetworkSessionRuntimeAdapter.ts",import.meta.url),"utf8");
  const css=readFileSync(new URL("../../src/production-session-direct-network.css",import.meta.url),"utf8");

  assert.match(main,/directNetworkSessionRuntimeAdapter/);
  assert.match(main,/<ProductionSessionDirectNetworkBridge \/>/);
  assert.match(direct,/Bind \/ Listen IP/);
  assert.match(direct,/Host IP \/ 주소/);
  assert.match(direct,/포트/);
  assert.match(direct,/configureNextSessionHostEndpoint/);
  assert.match(direct,/composeSessionEndpoint\(joinAddress,joinPort\)/);
  assert.match(direct,/productionJoinCharacters/);
  assert.match(runtime,/consumeNextSessionHostEndpoint/);
  assert.match(runtime,/tauriSessionTransport\.startHost/);
  assert.match(css,/production-session-entry-grid:not\(\.v09-direct-network-entry\)/);
  assert.doesNotMatch(direct,/invite code|초대 코드/i);
});

test("direct network endpoint configuration is validated, explicit, and one-shot",()=>{
  clearNextSessionHostEndpointForTests();
  assert.equal(composeSessionEndpoint("192.168.0.42",4321),"192.168.0.42:4321");
  assert.equal(composeSessionEndpoint("::1",3210),"[::1]:3210");
  assert.throws(()=>composeSessionEndpoint("",3210),/IP|인터페이스/);
  assert.throws(()=>composeSessionEndpoint("127.0.0.1",0),/1~65535/);
  configureNextSessionHostEndpoint({bindAddress:"10.0.0.5",port:4567});
  assert.equal(consumeNextSessionHostEndpoint("0.0.0.0:3210"),"10.0.0.5:4567");
  assert.equal(consumeNextSessionHostEndpoint("0.0.0.0:3210"),"0.0.0.0:3210","configured bind applies to one Host start only");
});

test("starting a production Host clears reference fixture actors and stopping returns to a clean offline shell",async()=>{
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

    const stopped=await adapter.stopSession();
    assert.equal(stopped.session.role,"offline");
    assert.equal(stopped.session.lifecycle,"offline");
    assert.equal(stopped.role,"player","Host stop must not strand the app in the DM shell");
    assert.equal(stopped.session.address,"");
  } finally {
    transport.restore();
  }
});
