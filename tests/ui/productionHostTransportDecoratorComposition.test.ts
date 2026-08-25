import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

test("production transport decorator composition starts Host without recursive listeners",async()=>{
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
  let starts=0;
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async(bindAddress="0.0.0.0:3210")=>{
    starts+=1;
    return {role:"host",state:"connected",address:bindAddress,peerCount:0};
  };
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async()=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};

  try {
    await import("../../src/app/offlineRuntimeAdapters");
    await import("../../src/app/connectedSessionRuntimeAdapter");
    await import("../../src/app/connectedLongRestSessionAdapter");
    await import("../../src/app/directNetworkSessionRuntimeAdapter");
    await import("../../src/app/connectedProjectionLifecycleAdapter");
    await import("../../src/app/connectedRoleRoutingAdapter");
    await import("../../src/app/connectedActionRoutingAdapter");
    await import("../../src/app/connectedTurnRoutingAdapter");
    await import("../../src/app/connectedCorrectionRoutingAdapter");
    await import("../../src/app/productionSessionLifecycleAdapter");
    await import("../../src/app/sessionImageHandoutRuntimeAdapter");
    await import("../../src/app/sessionContentParityRuntimeAdapter");
    await import("../../src/app/connectedCampaignSystemsRuntimeAdapter");
    await import("../../src/app/connectedPartyStashApprovalRuntimeAdapter");
    await import("../../src/app/connectedOwnerInventoryJournalAdapter");

    const snapshot=await new MockAdapter().hostSession();
    assert.equal(starts,1);
    assert.equal(snapshot.session.role,"host");
    assert.equal(snapshot.connectionState,"connected");
    assert.doesNotMatch(snapshot.session.compatibilityMessage,/Maximum call stack/i);
  } finally {
    tauriSessionTransport.available=original.available;
    tauriSessionTransport.startHost=original.startHost;
    tauriSessionTransport.send=original.send;
    tauriSessionTransport.sendTo=original.sendTo;
    tauriSessionTransport.stop=original.stop;
    tauriSessionTransport.onMessage=original.onMessage;
    tauriSessionTransport.onState=original.onState;
    tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
  }
});
