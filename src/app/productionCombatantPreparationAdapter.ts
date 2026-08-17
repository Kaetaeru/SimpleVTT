import type { AppSnapshot, SimpleVttAdapter } from "./contracts";
import { MockAdapter } from "./mockAdapter";

declare module "./contracts" {
  interface SimpleVttAdapter {
    removeCombatant(combatantId:string):Promise<AppSnapshot>;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    removeCombatant(combatantId:string):Promise<AppSnapshot>;
  }
}

interface PreparedCombatantState {
  scene:AppSnapshot["scene"];
  activeCharacter:AppSnapshot["activeCharacter"];
  activity:AppSnapshot["activity"];
  resolution:AppSnapshot["resolution"];
  session:AppSnapshot["session"] & { lifecycle?:string };
  getSnapshot():Promise<AppSnapshot>;
}

function isPreparedCombatantInstance(id:string) {
  return /\.instance-\d+$/.test(id);
}

MockAdapter.prototype.removeCombatant=async function removePreparedCombatant(combatantId:string) {
  const internal=this as unknown as PreparedCombatantState;
  if (internal.session.lifecycle!=="preparing") {
    internal.session.compatibility="warning";
    internal.session.compatibilityMessage="Combatants can only be removed from Host preparation before live play starts.";
    return internal.getSnapshot();
  }

  const combatant=internal.scene.entities.find((entity)=>entity.id===combatantId);
  if (!combatant||combatant.kind!=="combatant"||!isPreparedCombatantInstance(combatant.id)) {
    internal.session.compatibility="warning";
    internal.session.compatibilityMessage="Only prepared Combatant instances can be removed from the preparation Scene.";
    return internal.getSnapshot();
  }
  if (internal.resolution && (internal.resolution.actorId===combatantId||internal.resolution.targetIds.includes(combatantId))) {
    internal.session.compatibility="warning";
    internal.session.compatibilityMessage="Resolve or dismiss the pending Resolution before removing that Combatant.";
    return internal.getSnapshot();
  }

  internal.scene.entities=internal.scene.entities.filter((entity)=>entity.id!==combatantId);
  delete internal.scene.actionsByActor[combatantId];
  delete internal.scene.economyByActor[combatantId];
  const fallbackActorId=internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)?.id
    ?? internal.scene.entities[0]?.id
    ?? "";
  if (internal.scene.currentActorId===combatantId) internal.scene.currentActorId=fallbackActorId;
  if (internal.scene.selectedActorId===combatantId) internal.scene.selectedActorId=fallbackActorId;

  internal.activity.unshift({
    id:`phase14.prepared-combatant-remove.${Date.now()}.${Math.floor(Math.random()*1000)}`,
    time:"지금",
    actor:"DM",
    title:"준비 Combatant 제거",
    summary:combatant.name,
    detail:[`Prepared Scene instance removed: ${combatant.id}`],
    stateChanges:[`Scene participant removed: ${combatant.id}`,"Combatant actions/economy removed"],
  });
  internal.session.compatibilityMessage=`Prepared Combatant removed: ${combatant.name}`;
  return internal.getSnapshot();
};

export type ProductionCombatantPreparationAdapter=SimpleVttAdapter;
