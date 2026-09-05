/**
 * C1-04 Legendary Resistance: the DM flips a failed saving throw to a success. The timing adapter undoes the
 * resolution, registers the creature here, and re-resolves the same action; the spell runtime reads the
 * registration once and judges that creature's save as an automatic success.
 */
const forcedByAdapter=new WeakMap<object,Set<string>>();

export function forceSaveSuccess(adapter:object,targetId:string) {
  const set=forcedByAdapter.get(adapter)??new Set<string>();
  set.add(targetId);
  forcedByAdapter.set(adapter,set);
}

/** Consumes and returns the registered ids among the given targets. */
export function takeForcedSaveSuccess(adapter:object,targetIds:string[]):string[] {
  const set=forcedByAdapter.get(adapter);
  if (!set) return [];
  const taken=targetIds.filter((id)=>set.has(id));
  for (const id of taken) set.delete(id);
  return taken;
}
