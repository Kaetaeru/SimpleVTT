import type { MockAdapter } from "./mockAdapter";
import type { ResolutionEvent } from "../domain/resolutionTypes";

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
  historyByAdapter.set(adapter,{
    resolutionId,
    events:events.map((event)=>structuredClone(event)),
  });
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
