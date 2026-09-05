import type { AbilityKey } from "./contracts";
import type { CombatantRuntimeAttackVm, CombatantRuntimeDamageVm, CombatantRuntimeEconomy, CombatantRuntimeSaveActionVm, CombatantRuntimeTimingVm } from "./combatantRuntimeContracts";
import type { SrdMonster, SrdMonsterSpellcasting, SrdMonsterSpellList } from "./srdMonsterCatalog";
import { spellMechanicById } from "../domain/spellMechanics";
import type { SpellDiceFormula, SpellMechanicDefinition } from "../domain/spellcasting";

/**
 * C1-04: a stat block's spell list becomes runtime attack and saving-throw actions that carry the block's own
 * save DC, spell attack bonus and per-day uses. Only combat-executable mechanics project; utility spells stay in
 * the stat block's spellcasting text.
 */
export interface MonsterSpellSpecs { attacks:CombatantRuntimeAttackVm[]; saves:CombatantRuntimeSaveActionVm[] }

const ECONOMY:Record<SpellMechanicDefinition["castingEconomy"],CombatantRuntimeEconomy>={ "action":"행동", "bonus-action":"추가 행동", "reaction":"반응" };

function cantripSteps(level:number) { return [5,11,17].filter((threshold)=>level>=threshold).length; }

export function monsterSpellSpecs(monster:Pick<SrdMonster,"cr"|"proficiencyBonus">,spellcasting:SrdMonsterSpellcasting,damageLabel:(type:string)=>string):MonsterSpellSpecs {
  const casterLevel=Math.min(20,Math.max(1,Math.round(monster.cr)));
  const modifier=spellcasting.dc-8-monster.proficiencyBonus;
  const attackBonus=spellcasting.attackBonus??(spellcasting.dc-8);
  const specs:MonsterSpellSpecs={ attacks:[], saves:[] };
  spellcasting.lists.forEach((list,listIndex)=>{
    for (const [entryIndex,entry] of (list.entries??[]).entries()) {
      if (!entry.spellId) continue;
      const mechanic=spellMechanicById(entry.spellId);
      if (!mechanic||mechanic.runtimeSupport!=="combat-executable") continue;
      const slotLevel=entry.slotLevel??mechanic.baseLevel;
      const scale=(formula:SpellDiceFormula):CombatantRuntimeDamageVm=>{
        const count=formula.count+(formula.cantripScaling?cantripSteps(casterLevel):0)+Math.max(0,slotLevel-mechanic.baseLevel)*(formula.dicePerSlotAboveBase??0);
        const flat=(formula.flat??0)+Math.max(0,slotLevel-mechanic.baseLevel)*(formula.flatPerSlotAboveBase??0)+(formula.addSpellcastingModifier?modifier:0);
        return { type:"", dice:`${count}d${formula.sides}`, flat };
      };
      const timing=timingFor(list);
      const id=`spell.${listIndex}.${entryIndex}.${entry.spellId.replace(/^dnd\.srd521\.spell\./,"")}`;
      const name=`${entry.name} (주문${entry.slotLevel?` · ${entry.slotLevel}레벨`:""})`;
      const economy=ECONOMY[mechanic.castingEconomy];
      const primary=mechanic.primary;
      const failConditionIds=(mechanic.effects??[]).filter((effect)=>effect.trigger==="failed-save").map((effect)=>effect.conditionId);
      const hitConditionIds=(mechanic.effects??[]).filter((effect)=>effect.trigger==="hit").map((effect)=>effect.conditionId);
      const maxTargets=Math.min(10,Math.max(1,mechanic.targeting.maxTargets));
      if (primary.kind==="attack-damage"||primary.kind==="multi-attack-damage") {
        const formula=primary.kind==="attack-damage"?primary.dice:primary.dicePerAttack;
        const attacks=primary.kind==="multi-attack-damage"?primary.baseAttacks+(primary.cantripAttackScaling?cantripSteps(casterLevel):0)+Math.max(0,slotLevel-mechanic.baseLevel)*(primary.attacksPerSlotAboveBase??0):1;
        specs.attacks.push({
          id, name, category:"magic", sourceKind:"weapon", attackBonus,
          rangeFeet:mechanic.targeting.rangeFeet||5,
          damage:{ ...scale(formula), type:damageLabel(primary.damageType) },
          ...(attacks>1?{ attacksPerAction:attacks }:{}),
          ...(economy!=="행동"?{ economy }:{}),
          ...(hitConditionIds.length?{ riderConditionIds:hitConditionIds }:{}),
          ...(timing?{ timing }:{}),
          hitText:mechanic.executionScope,
        });
        continue;
      }
      if (primary.kind==="save-damage"||primary.kind==="save-compound-damage"||primary.kind==="save-effect") {
        const damage=primary.kind==="save-damage"?[{ ...scale(primary.dice), type:damageLabel(primary.damageType) }]
          :primary.kind==="save-compound-damage"?primary.components.map((component)=>({ ...scale(component.dice), type:damageLabel(component.damageType) }))
          :[];
        specs.saves.push({
          id, name,
          saveAbility:primary.saveAbility as AbilityKey,
          saveDc:spellcasting.dc,
          damage,
          successDamage:primary.kind==="save-effect"?"none":primary.successDamage==="half"?"half":"none",
          maxTargets,
          ...(primary.kind==="save-effect"?{ failText:primary.summary }:{}),
          ...(failConditionIds.length?{ failConditionIds }:{}),
          ...(economy!=="행동"?{ economy }:{}),
          ...(timing?{ timing }:{}),
        });
      }
    }
  });
  return specs;
}

function timingFor(list:SrdMonsterSpellList):CombatantRuntimeTimingVm|undefined {
  return list.frequency!=="at-will"&&list.uses ? { usesPerDay:list.uses } : undefined;
}
