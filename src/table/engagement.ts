import type { RulesRuntimeState } from "../domain/combatState";
import { type EngagementRecord, engagedWith, pruneEngagementsToPresent } from "../domain/engagement";
import type { ActionVm } from "../app/contracts";
import type { TableState } from "./state";

/**
 * P0b — the table's glue over the domain's engagement policy (domain/engagement.ts, theater-of-mind-play.md).
 * The policy itself (which attacks engage, when a pair ends) is the pure domain module; this file only reads the
 * action data to tell melee from ranged and keeps the record set consistent with who is still on the table.
 */
export const ENGAGEMENT_RANGED_IN_MELEE_SOURCE="engagement:ranged-in-melee";

/**
 * Melee is read from the attack's own wording (`attackMode`): reach attacks and thrown weapons engage, ranged attacks
 * never do. Without a mode the old table policy applies: reach up to 10 feet is melee. No distance is ever typed in.
 */
export function isMeleeAttack(action:Pick<ActionVm,"resolutionKind"|"runtimeAttack">):boolean {
  if(action.resolutionKind!=="attack"||!action.runtimeAttack) return false;
  const mode=action.runtimeAttack.attackMode;
  if(mode) return mode!=="ranged";
  return action.runtimeAttack.rangeFeet<=10;
}

export function isRangedAttack(action:Pick<ActionVm,"resolutionKind"|"runtimeAttack">):boolean {
  return action.resolutionKind==="attack"&&Boolean(action.runtimeAttack)&&!isMeleeAttack(action);
}

/** Living creatures of the other side the actor is engaged with — the ones that make a ranged attack "in melee". */
export function hostileEngagedIds(state:TableState,actorId:string):string[] {
  const actor=state.actors[actorId];
  if(!actor) return [];
  return engagedWith(state.engagements,actorId).filter((id)=>{
    const other=state.actors[id],combatant=state.rules.combatants[id];
    return Boolean(other&&combatant&&other.side!==actor.side&&!combatant.life.dead&&combatant.life.hp.current>0);
  });
}

/** Records whose both members are still on the table and alive under `rules`. */
export function engagementsAmongLiving(state:TableState,records:readonly EngagementRecord[],rules:RulesRuntimeState=state.rules):EngagementRecord[] {
  const living=new Set(Object.keys(state.actors).filter((id)=>rules.combatants[id]&&!rules.combatants[id].life.dead));
  return pruneEngagementsToPresent(records,living);
}

export function engagementsEqual(left:readonly EngagementRecord[],right:readonly EngagementRecord[]):boolean {
  if(left.length!==right.length) return false;
  return left.every((record,index)=>{
    const other=right[index];
    return record.a===other.a&&record.b===other.b&&record.sinceRound===other.sinceRound&&record.lastMeleeRound===other.lastMeleeRound;
  });
}

export function pairLabel(state:TableState,record:Pick<EngagementRecord,"a"|"b">):string {
  const name=(id:string)=>state.actors[id]?.name??id;
  return `${name(record.a)} ↔ ${name(record.b)}`;
}
