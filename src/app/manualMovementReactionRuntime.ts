import type { ManualMovementReactionKind } from "./manualMovementReactionContracts";
import type { RuntimeTargetingFact } from "./realRuntimeAttackFactProvider";

export interface PendingManualMovementReaction {
  kind:ManualMovementReactionKind;
  provokerId:string;
  reactorId:string;
  attackActionId:string;
  triggerId:string;
  triggerLabel:string;
  optionId:string;
  source:string;
  baseTargetAc:number;
  targetingFact:RuntimeTargetingFact;
}

const pending = new WeakMap<object,PendingManualMovementReaction>();

export function setPendingManualMovementReaction(owner:object,value:PendingManualMovementReaction) {
  pending.set(owner,structuredClone(value));
}

export function manualMovementReactionFor(
  owner:object,
  reactorId:string,
  actionId:string,
  provokerId:string,
) {
  const value=pending.get(owner);
  if (!value) return undefined;
  if (value.reactorId!==reactorId || value.attackActionId!==actionId || value.provokerId!==provokerId) return undefined;
  return structuredClone(value);
}

export function clearPendingManualMovementReaction(owner:object) {
  pending.delete(owner);
}
