import type { ConnectedActionRequest, SessionCompatibilityManifest } from "./connectedSessionProtocol";
import { ClientSessionReplica, HostSessionLedger } from "./connectedSessionProtocol";
import type { MockAdapter } from "./mockAdapter";

export interface PendingRemoteAction {
  peer:string;
  request:ConnectedActionRequest;
  resolutionId:string;
}

export interface ConnectedRuntimeState {
  mode:"host"|"client"|null;
  sessionId:string|null;
  ledger:HostSessionLedger|null;
  replica:ClientSessionReplica|null;
  listenersInstalled:boolean;
  pendingRemoteAction:PendingRemoteAction|null;
  publishedResolutionIds:Set<string>;
  peerManifests:Map<string,SessionCompatibilityManifest>;
}

const states=new WeakMap<MockAdapter,ConnectedRuntimeState>();

export function connectedStateFor(adapter:MockAdapter) {
  let state=states.get(adapter);
  if (!state) {
    state={
      mode:null,
      sessionId:null,
      ledger:null,
      replica:null,
      listenersInstalled:false,
      pendingRemoteAction:null,
      publishedResolutionIds:new Set<string>(),
      peerManifests:new Map<string,SessionCompatibilityManifest>(),
    };
    states.set(adapter,state);
  }
  return state;
}

export function resetConnectedState(adapter:MockAdapter,mode:"host"|"client"|null) {
  const state=connectedStateFor(adapter);
  state.mode=mode;
  state.sessionId=null;
  state.ledger=null;
  state.replica=null;
  state.pendingRemoteAction=null;
  state.publishedResolutionIds.clear();
  state.peerManifests.clear();
  return state;
}
