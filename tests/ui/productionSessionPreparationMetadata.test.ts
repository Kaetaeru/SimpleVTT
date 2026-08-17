import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function installFakeDesktopTransport() {
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async()=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return { restore() {
    tauriSessionTransport.available=original.available;
    tauriSessionTransport.startHost=original.startHost;
    tauriSessionTransport.stop=original.stop;
    tauriSessionTransport.onMessage=original.onMessage;
    tauriSessionTransport.onState=original.onState;
    tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
  }};
}

test("production Host preparation replaces reference metadata, exposes real rules/content, and edits the session name only before start",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    const fixture=await adapter.getSnapshot();
    assert.equal(fixture.session.name,"금요일 세션");
    assert.ok(fixture.session.sessionContent.some((entry)=>entry.includes("철벽 수호자")));

    await adapter.previewContentImport(JSON.stringify({
      id:"local.phase14.preparation-module",
      category:"subclass",
      nameKo:"준비 메타데이터 모듈",
      nameEn:"Preparation Metadata Module",
      sourceId:"phase14.preparation-metadata",
      source:"Phase14 Test",
      version:"1.0",
    }));
    await adapter.activateContentImport();

    const prepared=await adapter.hostSession();
    const preparedSession=prepared.session as typeof prepared.session & { rulesProfileId?:string };
    assert.equal(prepared.session.lifecycle,"preparing");
    assert.equal(prepared.session.name,"새 플레이 세션");
    assert.equal(preparedSession.rulesProfileId,connectedManifest(adapter).rulesProfileId);
    assert.ok(prepared.session.sessionContent.some((entry)=>entry.includes("준비 메타데이터 모듈")));
    assert.ok(prepared.session.sessionContent.every((entry)=>!entry.includes("철벽 수호자")));
    assert.ok(prepared.session.sessionContent.every((entry)=>!entry.includes("고블린")));

    const production=adapter as MockAdapter & { setPreparedSessionName(name:string):Promise<typeof prepared> };
    const renamed=await production.setPreparedSessionName("  토요일 원정  ");
    assert.equal(renamed.session.name,"토요일 원정");

    const emptyRejected=await production.setPreparedSessionName("   ");
    assert.equal(emptyRejected.session.name,"토요일 원정");

    connectedStateFor(adapter).sessionStarted=true;
    const liveRejected=await production.setPreparedSessionName("라이브 중 변경 금지");
    assert.equal(liveRejected.session.lifecycle,"live");
    assert.equal(liveRejected.session.name,"토요일 원정");
  } finally {
    transport.restore();
  }
});

test("production Host preparation surface exposes editable name, mode intent, rules compatibility, and active content without debug controls",()=>{
  const source=readFileSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url),"utf8");
  assert.match(source,/세션 이름/);
  assert.match(source,/setPreparedSessionName/);
  assert.match(source,/rulesProfileId/);
  assert.match(source,/sessionContent/);
  assert.match(source,/활성 콘텐츠/);
  assert.match(source,/시작 모드/);
  assert.match(source,/snapshot\.session\.compatibilityMessage/);
  assert.doesNotMatch(source,/setReferenceRole|loadReferenceScenario|Ctrl\+Shift\+D/);
});
