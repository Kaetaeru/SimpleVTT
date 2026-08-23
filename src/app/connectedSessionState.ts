import type { ConnectedActionRequest, SessionCompatibilityManifest } from "./connectedSessionProtocol";
import type { ConnectedResolutionPresentationV1 } from "./connectedResolutionPresentation";
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
  peerParticipants:Map<string,string>;
  sessionStarted:boolean;
  reconnectTimer:ReturnType<typeof setTimeout>|null;
  reconnectAttempts:number;
  reconnectInFlight:boolean;
  nextPresentationSequence:number;
  lastAppliedPresentationSequence:number;
  lastPublishedPresentationKey:string;
  pendingPresentations:ConnectedResolutionPresentationV1[];
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
      peerParticipants:new Map<string,string>(),
      sessionStarted:false,
      reconnectTimer:null,
      reconnectAttempts:0,
      reconnectInFlight:false,
      nextPresentationSequence:1,
      lastAppliedPresentationSequence:0,
      lastPublishedPresentationKey:"",
      pendingPresentations:[],
    };
    states.set(adapter,state);
  }
  return state;
}

export function resetConnectedState(adapter:MockAdapter,mode:"host"|"client"|null) {
  const state=connectedStateFor(adapter);
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  state.mode=mode;
  state.sessionId=null;
  state.ledger=null;
  state.replica=null;
  state.pendingRemoteAction=null;
  state.publishedResolutionIds.clear();
  state.peerManifests.clear();
  state.peerParticipants.clear();
  state.sessionStarted=false;
  state.reconnectTimer=null;
  state.reconnectAttempts=0;
  state.reconnectInFlight=false;
  state.nextPresentationSequence=1;
  state.lastAppliedPresentationSequence=0;
  state.lastPublishedPresentationKey="";
  state.pendingPresentations=[];
  return state;
}
