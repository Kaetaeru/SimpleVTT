import type { ConnectedActionRequest, SessionCompatibilityManifest } from "./connectedSessionProtocol";
import type { ConnectedResolutionPresentationV1, ConnectedResolutionTimelineEntryV1 } from "./connectedResolutionPresentation";
import type { InterruptView } from "./contracts";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { ConcentrationSaveVm } from "./concentrationSaveRuntimeContracts";
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
  presentationTimelineByResolution:Map<string,ConnectedResolutionTimelineEntryV1[]>;
  privateInterruptsByResolution:Map<string,InterruptView>;
  publishedResolutionEvents:Map<string,ResolutionEvent[]>;
  privateConcentrationByResolution:Map<string,ConcentrationSaveVm>;
  interruptTimeout:ReturnType<typeof setTimeout>|null;
  interruptTimeoutResolutionId:string|null;
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
      presentationTimelineByResolution:new Map<string,ConnectedResolutionTimelineEntryV1[]>(),
      privateInterruptsByResolution:new Map<string,InterruptView>(),
      publishedResolutionEvents:new Map<string,ResolutionEvent[]>(),
      privateConcentrationByResolution:new Map<string,ConcentrationSaveVm>(),
      interruptTimeout:null,
      interruptTimeoutResolutionId:null,
    };
    states.set(adapter,state);
  }
  return state;
}

export function resetConnectedState(adapter:MockAdapter,mode:"host"|"client"|null) {
  const state=connectedStateFor(adapter);
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  if(state.interruptTimeout)clearTimeout(state.interruptTimeout);
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
  state.presentationTimelineByResolution.clear();
  state.privateInterruptsByResolution.clear();
  state.publishedResolutionEvents.clear();
  state.privateConcentrationByResolution.clear();
  state.interruptTimeout=null;
  state.interruptTimeoutResolutionId=null;
  return state;
}
