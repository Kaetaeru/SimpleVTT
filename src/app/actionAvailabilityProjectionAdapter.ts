import { MockAdapter } from "./mockAdapter";
import type { AppSnapshot } from "./contracts";
import { makeRefusal, spellRejectionMessage } from "./sessionRefusal";

/**
 * V1.6 S1-04 (무너진 종탑 장면 2) — two truths the table must not lose, applied outermost.
 *
 * 1. Availability truth. Production projections rebuild a character's spell actions on every snapshot with
 *    `available:true`, after the base adapter has already judged the turn economy — so after 세라 cast 인도 (an action)
 *    her 신성한 불길 and 상처 치료 tiles still read available on every peer, and the kernel then refused the cast. The base
 *    judgement (turn, action/bonus/reaction spent, 0 HP, resources, items) is re-applied to every projected action;
 *    it only ever narrows availability, never widens it.
 *
 * 2. A refused cast is a refusal. The spell adapters presented a kernel rejection ("action is not available",
 *    "already expended a spell slot") as a completed resolution card titled 시전 거부, which the connected layer then
 *    reported to the player as "not event-native". It becomes `snapshot.refusal` in the rules' words instead.
 */
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

/** Both spell adapters mint a rejected cast under one of these prefixes. */
export const REJECTED_CAST_ID=/^(production-)?spell-rejected./;

export function narrowProjectedAvailability(adapter:MockAdapter,snapshot:AppSnapshot):AppSnapshot {
  for(const actions of Object.values(snapshot.scene.actionsByActor)){
    for(const action of actions){
      if(!action.available) continue;
      const live=adapter.projectedAvailability(action);
      if(live.available) continue;
      action.available=false;
      action.disabledReason=live.reason;
    }
  }
  return snapshot;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithNarrowedAvailability() {
  return narrowProjectedAvailability(this,await previousGetSnapshot.call(this));
};

MockAdapter.prototype.resolveAction=async function resolveActionWithCastRefusal(actionId:string,targetIds:string[]) {
  const internal=this as unknown as {resolution:AppSnapshot["resolution"];refusal:AppSnapshot["refusal"]};
  const before=internal.resolution?.id;
  const snapshot=await previousResolveAction.call(this,actionId,targetIds);
  const resolution=snapshot.resolution;
  if(resolution&&REJECTED_CAST_ID.test(resolution.id)&&resolution.id!==before){
    const error=resolution.detail[0]??resolution.compact.replace(/^시전 거부 · /,"");
    internal.refusal=makeRefusal("spell-rejected",spellRejectionMessage(error),{actionId,actorId:resolution.actorId});
    internal.resolution=null;
    return this.getSnapshot();
  }
  return snapshot;
};
