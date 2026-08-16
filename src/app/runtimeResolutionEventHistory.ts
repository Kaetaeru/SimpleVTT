import type { MockAdapter } from "./mockAdapter";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import { recordCommittedResolutionEvents } from "./resolutionEventCommitRegistry";

export interface RuntimeResolutionEventHistory {
  resolutionId:string;
  events:ResolutionEvent[];
}

const historyByAdapter=new WeakMap<MockAdapter,RuntimeResolutionEventHistory>();

export function recordRuntimeResolutionEvents(
  adapter:MockAdapter,
  resolutionId:string,
  events:ResolutionEvent[],
) {
  const committed=events.map((event)=>structuredClone(event));
  historyByAdapter.set(adapter,{
    resolutionId,
    events:committed,
  });
  recordCommittedResolutionEvents(resolutionId,committed);
}

export function runtimeResolutionEventHistory(adapter:MockAdapter) {
  const history=historyByAdapter.get(adapter);
  return history
    ? { resolutionId:history.resolutionId,events:history.events.map((event)=>structuredClone(event)) }
    : undefined;
}

export function clearRuntimeResolutionEventHistory(adapter:MockAdapter) {
  historyByAdapter.delete(adapter);
}

export const runtimeResolutionEventHistories={
  get:runtimeResolutionEventHistory,
  set:(adapter:MockAdapter,history:RuntimeResolutionEventHistory)=>{
    recordRuntimeResolutionEvents(adapter,history.resolutionId,history.events);
    return runtimeResolutionEventHistories;
  },
  delete:(adapter:MockAdapter)=>{
    const existed=Boolean(historyByAdapter.get(adapter));
    clearRuntimeResolutionEventHistory(adapter);
    return existed;
  },
};
