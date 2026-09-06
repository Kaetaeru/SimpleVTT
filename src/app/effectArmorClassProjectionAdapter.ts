import { MockAdapter } from "./mockAdapter";
import type { AppSnapshot } from "./contracts";
import { effectIsActive } from "../domain/effects";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";

/**
 * V1.6 S1-04 — the AC the table sees is the AC attacks are judged against.
 *
 * Authored effects such as 신앙의 방패 carry `metadata.acBonus` / `metadata.acFloor` on a `modifier` effect; the attack
 * judge (resolutionActionOps) already raises the target AC by them. The scene view still showed the base AC, so
 * 무너진 종탑 장면 1 read "카엘 AC 16" on every peer while attacks were judged against 18. This projection adds the
 * active bonuses to `entity.ac` for display on the Host and every replica (the effects replicate with the runtime
 * state); it changes no mechanics.
 */
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;

function bonusFor(entityId:string,effects:ReturnType<typeof snapshotAdapterTurnRuntimeState> extends infer S ? S extends {effects:infer E} ? E : never : never):{bonus:number;floor:number} {
  let bonus=0,floor=0;
  for(const effect of effects as Array<{targetId:string;kind:string;metadata?:Record<string,string|number|boolean>;suppression?:unknown}>){
    if(effect.targetId!==entityId||effect.kind!=="modifier"||!effectIsActive(effect as never)) continue;
    const acBonus=effect.metadata?.acBonus;if(typeof acBonus==="number") bonus+=acBonus;
    const acFloor=effect.metadata?.acFloor;if(typeof acFloor==="number") floor=Math.max(floor,acFloor);
  }
  return {bonus,floor};
}

export function projectEffectArmorClass(snapshot:AppSnapshot,effects:Array<{targetId:string;kind:string;metadata?:Record<string,string|number|boolean>;suppression?:unknown}>|undefined):AppSnapshot {
  if(!effects?.length) return snapshot;
  for(const entity of snapshot.scene.entities){
    const {bonus,floor}=bonusFor(entity.id,effects as never);
    if(!bonus&&!floor) continue;
    entity.ac=Math.max(entity.ac+bonus,floor);
  }
  return snapshot;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithEffectArmorClass() {
  const snapshot=await previousGetSnapshot.call(this);
  const internal=this as unknown as {scene:AppSnapshot["scene"]};
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  return projectEffectArmorClass(snapshot,state?.effects);
};
