import type { RulesRuntimeState } from "../../domain/combatState";
import { LEGENDARY_ACTIONS_POOL, rechargePoolId, timedSpecsOf } from "../actors";
import { cloneState } from "../state";
import type { HandlerContext } from "./types";

/**
 * Stat-block counters at the start of a monster's turn (RULES_RUNTIME_SPECS.md §3, §22.14): the legendary action
 * pool refills, and every spent recharge action rolls its d6. Pure over the rules it is given; the caller commits.
 */
export function monsterTurnStart(ctx:HandlerContext,rules:RulesRuntimeState,actorId:string):{rules:RulesRuntimeState;lines:string[]} {
  const actor=ctx.state.actors[actorId];
  const combatant=rules.combatants[actorId];
  if(!actor||actor.source.kind!=="monster"||!combatant) return {rules,lines:[]};
  const lines:string[]=[];
  const next=cloneState(rules);
  const pools=next.combatants[actorId].resources;
  const legendary=pools.find((pool)=>pool.id===LEGENDARY_ACTIONS_POOL);
  if(legendary&&legendary.current<legendary.maximum) { lines.push(`${actor.name} 전설 행동 ${legendary.current} → ${legendary.maximum}`); legendary.current=legendary.maximum; }
  for(const spec of timedSpecsOf(actor.source.definition)) {
    const recharge=spec.timing.recharge;
    if(!recharge) continue;
    const pool=pools.find((entry)=>entry.id===rechargePoolId(spec.id));
    if(!pool||pool.current>=pool.maximum) continue;
    const sides=recharge.sides??6;
    const face=ctx.dice.faces(sides,1,`${actor.name} ${spec.name} 재충전`)[0];
    const ready=face>=recharge.min;
    if(ready) pool.current=pool.maximum;
    lines.push(`${actor.name} ${spec.name} 재충전 d${sides} ${face} → ${ready?"준비됨":"아직"}`);
  }
  if(!lines.length) return {rules,lines};
  next.revision+=1;
  return {rules:next,lines};
}
