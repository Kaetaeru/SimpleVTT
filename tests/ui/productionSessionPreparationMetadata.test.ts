import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function installFakeDesktopTransport() {
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    send:tauriSessionTransport.send,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async()=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return { restore() {
    tauriSessionTransport.available=original.available;
    tauriSessionTransport.startHost=original.startHost;
    tauriSessionTransport.send=original.send;
    tauriSessionTransport.stop=original.stop;
    tauriSessionTransport.onMessage=original.onMessage;
    tauriSessionTransport.onState=original.onState;
    tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
  }};
}

test("production Host live session replaces reference metadata and exposes real rules/content from the moment it opens",async()=>{
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

    const live=await adapter.hostSession();
    const liveSession=live.session as typeof live.session & { rulesProfileId?:string };
    assert.equal(live.session.lifecycle,"live");
    assert.equal(live.sessionMode,"freeform");
    assert.equal(live.session.name,"새 플레이 세션");
    assert.equal(liveSession.rulesProfileId,connectedManifest(adapter).rulesProfileId);
    assert.ok(live.session.sessionContent.some((entry)=>entry.includes("준비 메타데이터 모듈")));
    assert.ok(live.session.sessionContent.every((entry)=>!entry.includes("철벽 수호자")));
    assert.ok(live.session.sessionContent.every((entry)=>!entry.includes("고블린")));

    const production=adapter as MockAdapter & { setPreparedSessionName(name:string):Promise<typeof live> };
    const renamed=await production.setPreparedSessionName("  토요일 원정  ");
    assert.equal(renamed.session.lifecycle,"live");
    assert.equal(renamed.session.name,"토요일 원정");

    const emptyRejected=await production.setPreparedSessionName("   ");
    assert.equal(emptyRejected.session.name,"토요일 원정");
  } finally {
    transport.restore();
  }
});

test("Host entry keeps editable setup metadata before Open while live status has no second Start gate",()=>{
  const entrySource=readFileSync(new URL("../../src/ProductionSessionDirectNetworkBridge.tsx",import.meta.url),"utf8");
  const liveSource=readFileSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url),"utf8");
  assert.match(entrySource,/세션 이름/);
  assert.match(entrySource,/세션 열기/);
  assert.match(entrySource,/setPreparedSessionName/);
  assert.match(entrySource,/current\.session\.lifecycle!=="live"/);
  assert.match(liveSource,/rulesProfileId/);
  assert.match(liveSource,/sessionContent/);
  assert.match(liveSource,/활성 콘텐츠/);
  assert.match(liveSource,/snapshot\.session\.compatibilityMessage/);
  assert.doesNotMatch(liveSource,/시작 모드|플레이 시작|Ready여야/);
  assert.doesNotMatch(liveSource,/setReferenceRole|loadReferenceScenario|Ctrl\+Shift\+D/);
});
