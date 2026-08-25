import type { MockAdapter } from "./mockAdapter";

export interface SessionLastRollPresentationState {
  sessionId:string|null;
  revision:number;
  dismissedResolutionId:string|null;
}

type Listener=(state:SessionLastRollPresentationState)=>void;
const states=new WeakMap<MockAdapter,SessionLastRollPresentationState>();
const listeners=new WeakMap<MockAdapter,Set<Listener>>();
const initial=():SessionLastRollPresentationState=>({sessionId:null,revision:0,dismissedResolutionId:null});
const current=(adapter:MockAdapter)=>states.get(adapter)??initial();
const publish=(adapter:MockAdapter,state:SessionLastRollPresentationState)=>{states.set(adapter,state);for(const listener of listeners.get(adapter)??[])listener(structuredClone(state));return structuredClone(state);};

export const getSessionLastRollPresentationState=(adapter:MockAdapter)=>structuredClone(current(adapter));
export const resetSessionLastRollPresentationState=(adapter:MockAdapter)=>publish(adapter,initial());
export function subscribeSessionLastRollPresentation(adapter:MockAdapter,listener:Listener){const set=listeners.get(adapter)??new Set<Listener>();set.add(listener);listeners.set(adapter,set);listener(getSessionLastRollPresentationState(adapter));return()=>{set.delete(listener);};}
export function setHostSessionLastRollDismissed(adapter:MockAdapter,sessionId:string,resolutionId:string){const before=current(adapter);return publish(adapter,{sessionId,revision:before.sessionId===sessionId?before.revision+1:1,dismissedResolutionId:resolutionId});}
export function applyRemoteSessionLastRollDismissed(adapter:MockAdapter,sessionId:string,revision:number,resolutionId:string){const before=current(adapter);if(before.sessionId===sessionId&&revision<before.revision)return structuredClone(before);return publish(adapter,{sessionId,revision,dismissedResolutionId:resolutionId});}
