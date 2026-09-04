import type { ResolutionEvent } from "../domain/resolutionTypes";

const committedByResolutionId=new Map<string,ResolutionEvent[]>();

export function recordCommittedResolutionEvents(resolutionId:string,events:ResolutionEvent[]) {
  if (!events.length) return;
  committedByResolutionId.set(resolutionId,events.map((event)=>structuredClone(event)));
}

/** Non-consuming read of the events recorded so far for a Resolution (a later stage may extend them). */
export function peekCommittedResolutionEvents(resolutionId:string) {
  const events=committedByResolutionId.get(resolutionId);
  return events ? events.map((event)=>structuredClone(event)) : undefined;
}

export function takeCommittedResolutionEvents(resolutionId:string) {
  const events=committedByResolutionId.get(resolutionId);
  if (!events) return undefined;
  committedByResolutionId.delete(resolutionId);
  return events.map((event)=>structuredClone(event));
}

export function clearCommittedResolutionEvents(resolutionId:string) {
  committedByResolutionId.delete(resolutionId);
}
