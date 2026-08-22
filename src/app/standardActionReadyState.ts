import type { MockAdapter } from "./mockAdapter";

export interface ReadyActionConfiguration {
  actorId:string;
  actionId:string;
  trigger:string;
}

const configurations=new WeakMap<MockAdapter,ReadyActionConfiguration>();

export function readyActionConfigurationFor(adapter:MockAdapter) {
  const value=configurations.get(adapter);
  return value ? { ...value } : undefined;
}

export function setReadyActionConfiguration(adapter:MockAdapter,value:ReadyActionConfiguration) {
  configurations.set(adapter,{ ...value });
}

export function clearReadyActionConfiguration(adapter:MockAdapter) {
  configurations.delete(adapter);
}
