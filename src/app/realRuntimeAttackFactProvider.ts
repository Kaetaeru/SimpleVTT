import "./combatantRuntimeContracts";
import type { ActionVm, SceneVm } from "./contracts";
import type { Phase09AttackFact, Phase09TargetingFact } from "./phase09ReferenceRulesFacts";
import { authoritativeSpatialModuleRelation } from "./realSpatialRuntimeService";

export interface RuntimeTargetingFact extends Phase09TargetingFact {
  provenance:string[];
}

export type RuntimeAttackTargetingFact=(RuntimeTargetingFact&{authority:"authoritative"})|{
  authority:"manual-unconstrained";
  provenance:string[];
};

export function resolveRuntimeAttackFact(action:ActionVm,fixedFaces:number[]):Phase09AttackFact {
  const actionDamage = action.damage?.[0];
  if (!actionDamage) throw new Error(`runtime attack is missing structured ActionVm damage: ${action.id}`);
  const fact=action.runtimeAttack;
  if (!fact) throw new Error(`runtime attack requires authored runtimeAttack facts: ${action.id}`);
  const expected=`${fact.diceCount}d${fact.diceSides}`;
  if (actionDamage.dice!==expected) throw new Error(`runtime action damage drift: ${action.id} ${actionDamage.dice} != ${expected}`);
  if (fixedFaces.length < fact.diceCount*2) throw new Error(`runtime attack fixture requires ${fact.diceCount*2} fixed faces for critical replay: ${action.id}`);
  return {
    sourceKind:fact.sourceKind,
    ability:fact.sourceKind==="unarmed" ? "str" : fact.ability,
    rangeFeet:fact.rangeFeet,
    damageDice:[{ source:fact.damageSource,sides:fact.diceSides,count:fact.diceCount,faces:fixedFaces.slice(0,fact.diceCount*2) }],
    flatDamage:[{ source:`runtime:action:${action.id}:damage-flat`,value:actionDamage.flat }],
  };
}

export function resolveRuntimeTargetingFact(scene:SceneVm,sourceId:string,targetId:string):RuntimeTargetingFact {
  const relation=authoritativeSpatialModuleRelation(scene,sourceId,targetId);
  if (!relation) {
    return {
      distanceFeet:0,
      visible:true,
      cover:"none",
      targetCanSeeAttacker:true,
      provenance:[
        `runtime:spatial:${sourceId}->${targetId}:unconstrained:no-authoritative-module-fact`,
        "SimpleVTT V0.9 · optional spatial module absent for this pair · otherwise-valid target treated in range",
      ],
    };
  }
  return {
    distanceFeet:relation.distanceFeet,
    visible:relation.visible,
    cover:relation.cover,
    targetCanSeeAttacker:relation.targetCanSeeAttacker,
    provenance:[
      relation.provenance,
      `runtime:spatial:${sourceId}->${targetId}:distance:${relation.distanceFeet}ft`,
      `runtime:spatial:${sourceId}->${targetId}:visibility:${relation.visible ? "visible" : "hidden"}:cover:${relation.cover}:target-sight:${relation.targetCanSeeAttacker}`,
    ],
  };
}

export function phase09DeterministicAttackFaces(action:ActionVm) {
  if (!action.runtimeAttack) throw new Error(`runtime attack requires authored runtimeAttack facts: ${action.id}`);
  const {diceCount,diceSides}=action.runtimeAttack;
  const faces=Array.from({length:diceCount},()=>Math.max(1,Math.ceil(diceSides/2)));
  return [...faces,...faces];
}

export function resolveRuntimeAttackTargetingFact(scene:SceneVm,sourceId:string,targetId:string):RuntimeAttackTargetingFact {
  const relation=authoritativeSpatialModuleRelation(scene,sourceId,targetId);
  if(!relation)return {
    authority:"manual-unconstrained",
    provenance:[
      `runtime:manual-targeting:${sourceId}->${targetId}:unconstrained`,
      "explicit target selection supplied mapless theater-of-mind authority; no distance, visibility, or cover fact fabricated",
    ],
  };
  return {...resolveRuntimeTargetingFact(scene,sourceId,targetId),authority:"authoritative"};
}
