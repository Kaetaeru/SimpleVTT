import type { AttackDamageComponent, AttackRetaliation, AttackSourceKind } from "./attack";
import type { RulesRuntimeState } from "./combatState";
import { effectIsActive } from "./effects";
import { deterministicFace } from "./seededFace";

/**
 * Attack damage dice carried by active effects (V1.3 C1-03: Hunter's Mark, Hex, Divine Favor).
 * An effect on the attacker applies to every qualifying attack; a marked-target effect applies only when
 * the caster attacks the marked creature.
 */
export function effectAttackDamageRiders(state:RulesRuntimeState,actorId:string,targetId:string,sourceKind:AttackSourceKind,seed:string):AttackDamageComponent[] {
  return state.effects.flatMap((effect)=>{
    if (!effectIsActive(effect)||effect.kind!=="modifier") return [];
    const meta=effect.metadata??{};
    const count=typeof meta.attackDamageDiceCount==="number"?meta.attackDamageDiceCount:0;
    const sides=typeof meta.attackDamageDiceSides==="number"?meta.attackDamageDiceSides:0;
    if (!count||!sides||typeof meta.attackDamageType!=="string") return [];
    const marked=meta.attackDamageAgainstTargetOnly===true;
    if (marked?!(effect.sourceActorId===actorId&&effect.targetId===targetId):effect.targetId!==actorId) return [];
    if (typeof meta.attackDamageSourceKinds==="string"&&!meta.attackDamageSourceKinds.split(",").includes(sourceKind)) return [];
    const faces=Array.from({length:count*2},(_,die)=>deterministicFace(`${seed}:${effect.id}:${die}`,sides));
    return [{ sourceId:effect.sourceId, damageType:meta.attackDamageType, dice:[{ source:`effect:${effect.id}`, count, sides, faces }], ...(meta.attackDamageConsumeOnUse===true?{ consumeEffectId:effect.id }:{}) }];
  });
}

/** Damage the target's active effects deal back to an attacker that hits it (Fire Shield). */
export function effectRetaliations(state:RulesRuntimeState,targetId:string,attackRangeFeet:number,seed:string):AttackRetaliation[] {
  return state.effects.flatMap((effect)=>{
    if (!effectIsActive(effect)||effect.targetId!==targetId) return [];
    const meta=effect.metadata??{};
    const count=typeof meta.retaliationDiceCount==="number"?meta.retaliationDiceCount:0;
    const sides=typeof meta.retaliationDiceSides==="number"?meta.retaliationDiceSides:0;
    if (!count||!sides||typeof meta.retaliationDamageType!=="string") return [];
    if (meta.retaliationMeleeOnly===true&&attackRangeFeet>10) return [];
    const faces=Array.from({length:count*2},(_,die)=>deterministicFace(`${seed}:retaliation:${effect.id}:${die}`,sides));
    return [{ sourceId:effect.sourceId, damageType:meta.retaliationDamageType, dice:[{ source:`effect:${effect.id}:retaliation`, count, sides, faces }] }];
  });
}
