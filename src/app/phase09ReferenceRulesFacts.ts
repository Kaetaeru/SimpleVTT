import type { AbilityKey, ActionVm } from "./contracts";
import { d20BackedFormulaFaces } from "./phase09ReferenceEffectFacts";
import type { FixedDamageDice, FlatDamageContribution } from "../domain/damageRoll";
import type { FixedFormulaDice, FlatFormulaContribution } from "../domain/diceFormula";
import { parseCommonPlayDamageDiceFormula } from "../domain/commonPlayOperationRuntime";

export interface Phase09AttackFact {
  sourceKind:"weapon"|"unarmed"|"wild-shape";
  ability?:AbilityKey;
  rangeFeet:number;
  damageDice:FixedDamageDice[];
  flatDamage:FlatDamageContribution[];
}

export interface Phase09HealingFact {
  dice:FixedFormulaDice[];
  flat:FlatFormulaContribution[];
}

export interface Phase09TargetingFact {
  distanceFeet:number;
  visible:boolean;
  cover:"none"|"half"|"three-quarters"|"total";
  targetCanSeeAttacker:boolean;
}

export function healingFactFromFaces(action:ActionVm,faces:number[]):Phase09HealingFact {
  if(action.resolutionKind!=="healing"||!action.healing)throw new Error(`healing fact requires a healing action: ${action.id}`);
  const parsed=parseCommonPlayDamageDiceFormula(action.healing.dice,`healing action ${action.id}`);
  const flat=parsed.flat+action.healing.flat;
  if(faces.length!==parsed.count||faces.some((face)=>!Number.isInteger(face)||face<1||face>parsed.sides))throw new Error(`healing faces do not match ${parsed.count}d${parsed.sides}: ${action.id}`);
  return {
    dice:[{source:`action:${action.id}:healing-d${parsed.sides}`,sides:parsed.sides,count:parsed.count,faces:[...faces]}],
    flat:flat?[{source:`action:${action.id}:healing-flat`,value:flat}]:[],
  };
}

export function rollHealingFact(action:ActionVm,drawD20:(index:number)=>number):Phase09HealingFact {
  if(!action.healing)throw new Error(`healing fact requires a healing action: ${action.id}`);
  const parsed=parseCommonPlayDamageDiceFormula(action.healing.dice,`healing action ${action.id}`);
  return healingFactFromFaces(action,d20BackedFormulaFaces(parsed.count,parsed.sides,drawD20));
}
