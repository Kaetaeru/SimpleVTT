import rawCatalog from "../generated/monsterCatalog.generated.json";
import type { AbilityKey, AbilityScores, CombatantDefinitionVm } from "./contracts";
import type { CombatantRuntimeAttackVm, CombatantRuntimeSaveActionVm, CombatantRuntimeStatsVm } from "./combatantRuntimeContracts";

/**
 * SRD 5.2.1 monster catalog (V1.2 T1-01): 329 stat blocks parsed by `scripts/generate-monster-catalog.mjs` from the
 * Korean presentation bundle. This module turns a parsed stat block into the runtime `CombatantDefinitionVm` the
 * encounter path already consumes (abilities/saves, attacks with multiattack, saving-throw actions, defenses,
 * senses), and exposes search for the encounter panel and the Rules pane.
 */
export interface SrdMonsterDamageComponent { average:number; dice?:string; count:number; sides:number; flat:number; type:string }
export interface SrdMonsterEntry {
  name:string; nameEn:string; text:string; kind:"text"|"attack"|"save"|"multiattack"|"spellcasting";
  costText?:string; legendaryCost?:number;
  attack?:{ mode:"melee"|"ranged"|"melee-or-ranged"; bonus:number; reachFeet?:number; rangeFeet?:number; longRangeFeet?:number; damage:SrdMonsterDamageComponent[]; hitText:string; riderConditions:string[] };
  save?:{ ability:AbilityKey; dc:number; areaText:string; areaKind:"cone"|"line"|"sphere"|"area"|"single"; areaFeet?:number; failDamage:SrdMonsterDamageComponent[]; failText:string; successDamage:"half"|"none"|"other"; successText:string; failConditions:string[] };
  multiattack?:{ count:number; text:string; parsed:boolean };
  spellcasting?:{ ability?:AbilityKey; dc:number; attackBonus?:number; lists:Array<{ frequency:"at-will"|"per-day"|"per-rest"; uses?:number; spells:string[] }> };
}
export interface SrdMonster {
  id:string; slug:string; name:string; nameEn:string;
  size:string; creatureType:string; typeText:string; alignment:string;
  ac:number; acText:string; initiativeBonus:number; hp:number; hitDice?:string;
  speed:number; speedText:string; speeds:Record<string,number>;
  abilities:AbilityScores; saves:Record<AbilityKey,number>; skills:Record<string,number>;
  damageImmunities:string[]; damageResistances:string[]; damageVulnerabilities:string[]; conditionImmunities:string[];
  senses:Record<string,number>; sensesText:string; passivePerception:number; languagesText:string;
  cr:number; crText:string; xp:number; proficiencyBonus:number;
  traits:SrdMonsterEntry[]; actions:SrdMonsterEntry[]; bonusActions:SrdMonsterEntry[]; reactions:SrdMonsterEntry[]; legendaryActions:SrdMonsterEntry[];
  legendaryActionsPerRound:number; legendaryResistance:number;
  presentation:{ markdown:string };
}

const CATALOG=rawCatalog as unknown as { count:number; source:{ revision:string; license:string }; warnings:string[]; monsters:SrdMonster[] };
const BY_ID=new Map(CATALOG.monsters.map((monster)=>[monster.id,monster]));
export const SRD_MONSTER_COUNT=CATALOG.count;
export const SRD_MONSTER_SOURCE=CATALOG.source;
export const SRD_MONSTER_PARSE_WARNINGS:readonly string[]=CATALOG.warnings;
export const SRD_MONSTER_ID_PREFIX="dnd.srd521.monster.";

/** Damage type ids → the Korean labels the play runtime compares resistances against. */
export const DAMAGE_LABEL_KO:Record<string,string>={
  acid:"산성", bludgeoning:"타격", cold:"냉기", fire:"화염", force:"역장", lightning:"번개", necrotic:"사령", piercing:"관통",
  poison:"독", psychic:"정신", radiant:"광휘", slashing:"참격", thunder:"천둥",
};
const ABILITY_LABEL:Record<AbilityKey,string>={ str:"근력", dex:"민첩", con:"건강", int:"지능", wis:"지혜", cha:"매력" };
const CONDITION_LABEL_KO:Record<string,string>={
  blinded:"실명", charmed:"매혹됨", deafened:"실청", exhaustion:"탈진", frightened:"공포", grappled:"붙잡힘", incapacitated:"행동불능", invisible:"투명",
  paralyzed:"마비", petrified:"석화", poisoned:"중독됨", prone:"넘어짐", restrained:"포박", stunned:"기절", unconscious:"무의식",
};
export const SIZE_LABEL_KO:Record<string,string>={ tiny:"초소형", small:"소형", medium:"중형", large:"대형", huge:"거대형", gargantuan:"초거대형" };

export function damageLabelKo(type:string) { return DAMAGE_LABEL_KO[type]??type; }
export function conditionLabelKo(id:string) { return CONDITION_LABEL_KO[id]??id; }
export function crLabel(monster:Pick<SrdMonster,"crText">) { return monster.crText; }

export function allSrdMonsters():readonly SrdMonster[] { return CATALOG.monsters; }
export function srdMonsterById(id:string):SrdMonster|undefined { return BY_ID.get(id); }
export function isSrdMonsterId(id:string) { return id.startsWith(SRD_MONSTER_ID_PREFIX); }

/** Resolves a monster from either its bare id or a qualified catalog id (`content:<source>@<version>#<contentId>`). */
export function srdMonsterByCatalogEntryId(entryId:string):SrdMonster|undefined {
  const hash=entryId.lastIndexOf("#");
  const contentId=hash>=0 ? decodeURIComponent(entryId.slice(hash+1)) : entryId;
  return BY_ID.get(contentId);
}

export interface SrdMonsterSearchOptions { maxCr?:number; minCr?:number; creatureType?:string; limit?:number }
export function searchSrdMonsters(query:string,options:SrdMonsterSearchOptions={}):SrdMonster[] {
  const normalized=query.trim().toLowerCase();
  const matches=CATALOG.monsters.filter((monster)=>{
    if(options.maxCr!==undefined&&monster.cr>options.maxCr)return false;
    if(options.minCr!==undefined&&monster.cr<options.minCr)return false;
    if(options.creatureType&&monster.creatureType!==options.creatureType)return false;
    if(!normalized)return true;
    return `${monster.name} ${monster.nameEn} ${monster.typeText} ${monster.slug}`.toLowerCase().includes(normalized);
  });
  matches.sort((left,right)=>left.cr-right.cr||left.name.localeCompare(right.name,"ko-KR"));
  return matches.slice(0,options.limit??40);
}

const abilityModifier=(score:number)=>Math.floor((score-10)/2);

function attackSpec(monster:SrdMonster,entry:SrdMonsterEntry,index:number,attacksPerAction:number|undefined,economy:"행동"|"추가 행동"):CombatantRuntimeAttackVm {
  const attack=entry.attack!;
  const primary=attack.damage[0]??{ average:0, dice:undefined, count:0, sides:0, flat:0, type:"bludgeoning" };
  const dice=primary.dice??`0d${Math.max(2,primary.sides||2)}`;
  const ranged=attack.mode==="ranged";
  return {
    id:`${index}-${entry.nameEn.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"attack"}`,
    name:entry.name,
    category:"basic",
    sourceKind:"weapon",
    attackBonus:attack.bonus,
    rangeFeet:ranged?(attack.rangeFeet??60):(attack.reachFeet??attack.rangeFeet??5),
    damage:{ type:damageLabelKo(primary.type), dice, flat:primary.flat },
    ...(attack.damage.length>1?{ extraDamage:attack.damage.slice(1).map((component)=>({ type:damageLabelKo(component.type), dice:component.dice??`0d${Math.max(2,component.sides||2)}`, flat:component.flat })) }:{}),
    ...(attack.mode==="melee-or-ranged"&&attack.rangeFeet?{ thrownRangeFeet:attack.rangeFeet }:{}),
    ...(attack.longRangeFeet?{ longRangeFeet:attack.longRangeFeet }:{}),
    ...(attacksPerAction&&attacksPerAction>1?{ attacksPerAction }:{}),
    ...(economy!=="행동"?{ economy }:{}),
    ...(attack.riderConditions.length?{ riderConditionIds:attack.riderConditions }:{}),
    hitText:attack.hitText,
  };
}

function saveSpec(monster:SrdMonster,entry:SrdMonsterEntry,index:number,economy:"행동"|"추가 행동"):CombatantRuntimeSaveActionVm {
  const save=entry.save!;
  const maxTargets=save.areaKind==="single"?1:save.areaKind==="cone"||save.areaKind==="line"?8:save.areaKind==="sphere"||save.areaKind==="area"?10:1;
  return {
    id:`${index}-${entry.nameEn.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"save"}`,
    name:entry.name,
    saveAbility:save.ability,
    saveDc:save.dc,
    damage:save.failDamage.map((component)=>({ type:damageLabelKo(component.type), dice:component.dice??`0d${Math.max(2,component.sides||2)}`, flat:component.flat })),
    successDamage:save.successDamage==="half"?"half":"none",
    maxTargets,
    areaText:save.areaText,
    failText:save.failText,
    successText:save.successText,
    ...(save.failConditions.length?{ failConditionIds:save.failConditions }:{}),
    ...(economy!=="행동"?{ economy }:{}),
  };
}

/** The runtime definition the encounter path consumes; materialized lazily when a monster is added to the scene. */
export function srdMonsterCombatantDefinition(monster:SrdMonster):CombatantDefinitionVm {
  const multiattack=monster.actions.find((entry)=>entry.kind==="multiattack")?.multiattack;
  const attacksPerAction=multiattack?multiattack.count:undefined;
  const actionEntries=[...monster.actions.map((entry)=>({ entry, economy:"행동" as const })),...monster.bonusActions.map((entry)=>({ entry, economy:"추가 행동" as const }))];
  const runtimeActions=actionEntries.filter(({entry})=>entry.kind==="attack").map(({entry,economy},index)=>attackSpec(monster,entry,index,economy==="행동"?attacksPerAction:undefined,economy));
  const runtimeSaveActions=actionEntries.filter(({entry})=>entry.kind==="save").map(({entry,economy},index)=>saveSpec(monster,entry,index,economy));
  const savingThrowProficiencies=(Object.keys(monster.abilities) as AbilityKey[]).filter((key)=>monster.saves[key]!==undefined&&monster.saves[key]!==abilityModifier(monster.abilities[key]));
  const stats:CombatantRuntimeStatsVm={
    creatureType:monster.creatureType,
    abilities:{ ...monster.abilities },
    proficiencyBonus:monster.proficiencyBonus,
    savingThrowProficiencies,
    speed:monster.speed,
    resistances:monster.damageResistances.map(damageLabelKo),
    immunities:monster.damageImmunities.map(damageLabelKo),
    vulnerabilities:monster.damageVulnerabilities.map(damageLabelKo),
  };
  return {
    id:monster.id,
    name:monster.name,
    nameEn:monster.nameEn,
    ac:monster.ac,
    maxHp:monster.hp,
    actions:[...runtimeActions.map((action)=>action.name),...runtimeSaveActions.map((action)=>action.name)],
    statusImmunities:monster.conditionImmunities.map(conditionLabelKo),
    source:"SRD 5.2.1",
    version:"5.2.1",
    runtimeStats:stats,
    runtimeActions,
    runtimeSaveActions,
    runtimeMonster:{
      catalogId:monster.id,
      cr:monster.cr, crText:monster.crText, xp:monster.xp,
      size:monster.size, creatureType:monster.creatureType, typeText:monster.typeText,
      initiativeBonus:monster.initiativeBonus,
      senses:{ ...monster.senses }, passivePerception:monster.passivePerception,
      multiattackText:multiattack?.text,
      traits:monster.traits.map((entry)=>({ name:entry.name, text:entry.text })),
      reactions:monster.reactions.map((entry)=>({ name:entry.name, text:entry.text })),
      legendaryActions:monster.legendaryActions.map((entry)=>({ name:entry.name, text:entry.text, cost:entry.legendaryCost??1 })),
      legendaryActionsPerRound:monster.legendaryActionsPerRound,
      legendaryResistance:monster.legendaryResistance,
      spellcasting:monster.actions.find((entry)=>entry.kind==="spellcasting")?.spellcasting,
      textActions:monster.actions.filter((entry)=>entry.kind==="text").map((entry)=>({ name:entry.name, text:entry.text })),
    },
  } as CombatantDefinitionVm;
}

export function abilityLabelKo(key:AbilityKey) { return ABILITY_LABEL[key]; }
