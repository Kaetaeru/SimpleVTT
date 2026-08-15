import "./combatantRuntimeContracts";
import type { ActionVm, SceneEntity } from "./contracts";
import type { Phase09AttackFact, Phase09TargetingFact } from "./phase09ReferenceRulesFacts";
import { weaponRuleById } from "../domain/weaponRuleCatalog";

function canonicalWeaponIdFromAction(action:ActionVm) {
  if (action.resolutionKind !== "attack") throw new Error(`runtime weapon fact requires attack action: ${action.id}`);
  const raw = action.id.replace(/^action\./,"");
  const slugs = [raw,raw.replace(/-[a-z]$/i,"")];
  for (const slug of slugs) {
    const weaponId = `dnd.srd521.item.weapon.${slug}`;
    if (weaponRuleById(weaponId)) return weaponId;
  }
  throw new Error(`missing canonical weapon rule for runtime action: ${action.id}`);
}

function damageDice(damage:string|number) {
  const match = String(damage).match(/^(\d+)d(\d+)$/i);
  if (!match) throw new Error(`unsupported canonical weapon damage formula: ${damage}`);
  return { count:Number(match[1]), sides:Number(match[2]) };
}

function normalRangeFeet(properties:string[],mode:"melee"|"ranged") {
  if (mode === "melee") return 5;
  const range = properties.find((entry) => entry.startsWith("ammunition:") || entry.startsWith("thrown:"));
  if (!range) throw new Error("ranged weapon is missing canonical ammunition/thrown range property");
  const value = range.slice(range.indexOf(":") + 1).split("/")[0];
  const feet = Number(value);
  if (!Number.isFinite(feet) || feet <= 0) throw new Error(`invalid canonical weapon range: ${range}`);
  return feet;
}

export function resolveRuntimeAttackFact(action:ActionVm,fixedFaces:number[]):Phase09AttackFact {
  const actionDamage = action.damage?.[0];
  if (!actionDamage) throw new Error(`runtime attack is missing structured ActionVm damage: ${action.id}`);
  if (action.runtimeAttack) {
    const fact=action.runtimeAttack;
    const expected=`${fact.diceCount}d${fact.diceSides}`;
    if (actionDamage.dice!==expected) throw new Error(`runtime action damage drift: ${action.id} ${actionDamage.dice} != ${expected}`);
    if (fixedFaces.length < fact.diceCount*2) throw new Error(`runtime attack fixture requires ${fact.diceCount*2} fixed faces for critical replay: ${action.id}`);
    return {
      sourceKind:fact.sourceKind,
      rangeFeet:fact.rangeFeet,
      damageDice:[{
        source:fact.damageSource,
        sides:fact.diceSides,
        count:fact.diceCount,
        faces:fixedFaces.slice(0,fact.diceCount*2),
      }],
      flatDamage:[{
        source:`runtime:action:${action.id}:damage-flat`,
        value:actionDamage.flat,
      }],
    };
  }

  const weaponId = canonicalWeaponIdFromAction(action);
  const weapon = weaponRuleById(weaponId)!;
  const formula = damageDice(weapon.damage);
  if (actionDamage.dice !== String(weapon.damage)) throw new Error(`runtime/canonical weapon damage drift: ${action.id} ${actionDamage.dice} != ${weapon.damage}`);
  if (fixedFaces.length < formula.count * 2) throw new Error(`runtime attack fixture requires ${formula.count * 2} fixed faces for critical replay: ${action.id}`);
  return {
    sourceKind:"weapon",
    rangeFeet:normalRangeFeet(weapon.properties,weapon.mode),
    damageDice:[{
      source:`runtime:weapon:${weapon.id}:damage`,
      sides:formula.sides,
      count:formula.count,
      faces:fixedFaces.slice(0,formula.count * 2),
    }],
    flatDamage:[{
      source:`runtime:action:${action.id}:damage-flat`,
      value:actionDamage.flat,
    }],
  };
}

export function resolveRuntimeTargetingFact(target:SceneEntity):Phase09TargetingFact {
  const distance = target.distance?.match(/(-?\d+(?:\.\d+)?)/)?.[1];
  const distanceFeet = distance === undefined ? Number.NaN : Number(distance);
  if (!Number.isFinite(distanceFeet) || distanceFeet < 0) throw new Error(`missing structured runtime distance for target: ${target.id}`);
  return { distanceFeet, visible:true, cover:"none", targetCanSeeAttacker:true };
}

export function phase09DeterministicAttackFaces(action:ActionVm) {
  if (action.runtimeAttack) {
    const face=Math.ceil(action.runtimeAttack.diceSides/2);
    return Array.from({ length:action.runtimeAttack.diceCount*2 },()=>face);
  }
  if (action.id === "action.shortbow") return [4,4];
  throw new Error(`missing deterministic attack dice fixture: ${action.id}`);
}
