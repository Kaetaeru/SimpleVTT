import type { AppSnapshot } from "./contracts";

type SnapshotListener=(snapshot:AppSnapshot)=>void;
const listeners=new Set<SnapshotListener>();

export function publishExternalAdapterSnapshot(snapshot:AppSnapshot) {
  for (const listener of [...listeners]) listener(structuredClone(snapshot));
}

export function subscribeExternalAdapterSnapshot(listener:SnapshotListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
