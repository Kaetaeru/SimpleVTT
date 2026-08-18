import type { MockAdapter } from "./mockAdapter";
import type { LocalImageAssetV1 } from "./localImageAsset";

export interface SessionImageHandoutState {
  sessionId:string|null;
  revision:number;
  asset:LocalImageAssetV1|null;
  dismissed:boolean;
  error?:string;
}

type Listener=(state:SessionImageHandoutState)=>void;
const states=new WeakMap<MockAdapter,SessionImageHandoutState>();
const listeners=new WeakMap<MockAdapter,Set<Listener>>();

function initialState():SessionImageHandoutState {
  return {sessionId:null,revision:0,asset:null,dismissed:false};
}

function current(adapter:MockAdapter) {
  const existing=states.get(adapter);
  if (existing) return existing;
  const created=initialState();
  states.set(adapter,created);
  return created;
}

function publish(adapter:MockAdapter,next:SessionImageHandoutState) {
  states.set(adapter,next);
  for (const listener of listeners.get(adapter)??[]) listener(structuredClone(next));
  return structuredClone(next);
}

export function getSessionImageHandoutState(adapter:MockAdapter) {
  return structuredClone(current(adapter));
}

export function subscribeSessionImageHandout(adapter:MockAdapter,listener:Listener) {
  const set=listeners.get(adapter)??new Set<Listener>();
  set.add(listener);
  listeners.set(adapter,set);
  listener(getSessionImageHandoutState(adapter));
  return ()=>{ set.delete(listener); };
}

export function resetSessionImageHandout(adapter:MockAdapter) {
  return publish(adapter,initialState());
}

export function setHostSessionImageHandout(adapter:MockAdapter,sessionId:string,asset:LocalImageAssetV1|null) {
  const before=current(adapter);
  const revision=before.sessionId===sessionId?before.revision+1:1;
  return publish(adapter,{sessionId,revision,asset:asset?structuredClone(asset):null,dismissed:false});
}

export function applyRemoteSessionImageHandout(adapter:MockAdapter,sessionId:string,revision:number,asset:LocalImageAssetV1|null) {
  const before=current(adapter);
  if (before.sessionId===sessionId&&revision<before.revision) return structuredClone(before);
  return publish(adapter,{sessionId,revision,asset:asset?structuredClone(asset):null,dismissed:false});
}

export function dismissSessionImageHandoutState(adapter:MockAdapter) {
  const before=current(adapter);
  if (!before.asset) return structuredClone(before);
  return publish(adapter,{...before,dismissed:true,error:undefined});
}

export function reopenSessionImageHandoutState(adapter:MockAdapter) {
  const before=current(adapter);
  if (!before.asset) return structuredClone(before);
  return publish(adapter,{...before,dismissed:false,error:undefined});
}

export function setSessionImageHandoutError(adapter:MockAdapter,error:string) {
  return publish(adapter,{...current(adapter),error});
}
