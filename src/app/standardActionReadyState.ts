import type { MockAdapter } from "./mockAdapter";

export interface ReadyActionConfiguration {
  actorId:string;
  actionId:string;
  trigger:string;
}

export const READY_MOVEMENT_ACTION_ID="ready.movement";

const configurations=new WeakMap<MockAdapter,Map<string,ReadyActionConfiguration>>();

function configurationsFor(adapter:MockAdapter,create=false) {
  const current=configurations.get(adapter);
  if (current||!create) return current;
  const next=new Map<string,ReadyActionConfiguration>();
  configurations.set(adapter,next);
  return next;
}

export function readyActionConfigurationFor(adapter:MockAdapter,actorId?:string) {
  const values=configurationsFor(adapter);
  if (!values) return undefined;
  if (actorId) {
    const value=values.get(actorId);
    return value ? { ...value } : undefined;
  }
  if (values.size!==1) return undefined;
  const value=values.values().next().value as ReadyActionConfiguration|undefined;
  return value ? { ...value } : undefined;
}

export function readyActionConfigurationsFor(adapter:MockAdapter) {
  const values=configurationsFor(adapter);
  return values ? [...values.values()].map((value)=>({ ...value })) : [];
}

export function setReadyActionConfiguration(adapter:MockAdapter,value:ReadyActionConfiguration) {
  configurationsFor(adapter,true)!.set(value.actorId,{ ...value });
}

export function clearReadyActionConfiguration(adapter:MockAdapter,actorId?:string) {
  if (!actorId) {
    configurations.delete(adapter);
    return;
  }
  const values=configurationsFor(adapter);
  if (!values) return;
  values.delete(actorId);
  if (values.size===0) configurations.delete(adapter);
}
