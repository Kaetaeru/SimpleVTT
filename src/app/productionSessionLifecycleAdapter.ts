import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { connectedInternal } from "./connectedSessionRuntimeAdapter";
import { connectedStateFor, resetConnectedState } from "./connectedSessionState";
import { projectedCharacterIds } from "./characterSessionProjectionRegistry";
import { unmountAllReconstructedCharacterSessionProjections } from "./characterSessionProjectionMount";
import { tauriSessionTransport } from "./tauriSessionTransport";

export type ProductionSessionLifecycle = "offline" | "preparing" | "lobby" | "live";

declare module "./contracts" {
  interface SessionVm {
    lifecycle?: ProductionSessionLifecycle;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    stopSession():Promise<AppSnapshot>;
  }
}

const lifecycleByAdapter=new WeakMap<MockAdapter,ProductionSessionLifecycle>();

function lifecycleFor(adapter:MockAdapter):ProductionSessionLifecycle {
  const stored=lifecycleByAdapter.get(adapter);
  if (stored) return stored;
  return connectedInternal(adapter).session.role==="offline" ? "offline" : "lobby";
}

function setLifecycle(adapter:MockAdapter,lifecycle:ProductionSessionLifecycle) {
  lifecycleByAdapter.set(adapter,lifecycle);
  connectedInternal(adapter).session.lifecycle=lifecycle;
}

function stopBlockedReason(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if (state.pendingRemoteAction) return "Host stop blocked while a remote action is pending resolution.";
  const projected=new Set(projectedCharacterIds(adapter));
  if (projected.has(connectedInternal(adapter).activeCharacter.id)) {
    return "Host stop blocked while a projected Character resolution context is active.";
  }
  return undefined;
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithProductionSessionLifecycle() {
  const snapshot=await previousGetSnapshot.call(this);
  snapshot.session.lifecycle=lifecycleFor(this);
  return snapshot;
};

MockAdapter.prototype.stopSession=async function stopProductionSession() {
  const app=connectedInternal(this);
  const blocked=stopBlockedReason(this);
  if (blocked) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=blocked;
    return app.getSnapshot();
  }

  try {
    await tauriSessionTransport.stop();
  } catch(error) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=`Session stop failed: ${error instanceof Error?error.message:String(error)}`;
    return app.getSnapshot();
  }

  unmountAllReconstructedCharacterSessionProjections(this);
  resetConnectedState(this,null);
  setLifecycle(this,"offline");
  app.connectionState="disconnected";
  app.session.role="offline";
  app.session.address="";
  app.session.participants=[];
  app.session.compatibility="warning";
  app.session.compatibilityMessage="Session stopped. Start Host to open a fresh preparation lobby.";
  return app.getSnapshot();
};

const previousHostSession=MockAdapter.prototype.hostSession;
MockAdapter.prototype.hostSession=async function hostProductionSessionWithLifecycle() {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  if (state.mode!==null || app.session.role!=="offline") {
    const stopped=await this.stopSession();
    if (stopped.session.role!=="offline") return stopped;
  }

  try {
    const started=await previousHostSession.call(this);
    if (started.session.role!=="host" || started.connectionState!=="connected") {
      setLifecycle(this,"offline");
      return app.getSnapshot();
    }
    setLifecycle(this,"preparing");
    app.session.compatibility="compatible";
    app.session.compatibilityMessage=`Host listening at ${started.session.address} · preparation lobby open.`;
    return app.getSnapshot();
  } catch(error) {
    await tauriSessionTransport.stop().catch(()=>undefined);
    resetConnectedState(this,null);
    setLifecycle(this,"offline");
    app.connectionState="disconnected";
    app.session.role="offline";
    app.session.address="";
    app.session.participants=[];
    app.session.compatibility="incompatible";
    app.session.compatibilityMessage=`Host start failed: ${error instanceof Error?error.message:String(error)}`;
    return app.getSnapshot();
  }
};
