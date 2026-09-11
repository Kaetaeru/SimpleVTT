import type { AbilityKey } from "../domain/conditions";
import type { ResourcePool } from "../domain/resources";
import { classById, multiclassSpellSlots } from "../domain/progressionCatalog";
import { normalizedSpellDefinitionById } from "../domain/spellExecutionCatalog";
import type { SpellCastDiceInput, SpellCastTarget, SpellCasterContext, SpellMechanicDefinition } from "../domain/spellcasting";
import { spellMultiAttackCount } from "../domain/spellcasting";
import type { ActionDetailVm, ActionVm, CharacterSheet } from "../app/contracts";
import { spellPresentationById } from "../app/spellPresentation";
import type { Dice } from "./dice";
import type { Actor, TableState } from "./state";

/**
 * Spells on the table (capability inventory §8): the sheet's cantrips and prepared spells become actions; the cast
 * itself is the domain kernel (`compileSpellCast` / `resolveCompiledSpellCast`) with slots as combatant resources
 * `spell-slot-N`, the caster context from the sheet, and every die supplied by the table's dice source.
 */
export type SpellSheet=CharacterSheet&{cantrips?:string[];preparedSpells?:string[];spellSlotMaximums?:Record<number,number>;hitDiceByDie?:Record<string,number>};

export const SLOT_RESOURCE_PREFIX="spell-slot-";
export const slotResourceId=(level:number)=>`${SLOT_RESOURCE_PREFIX}${level}`;

const normalized=(id:string)=>id.replace(/^always:/,"");

export function spellAbilityOf(sheet:SpellSheet):AbilityKey {
  const name=`${sheet.className} ${(sheet.classLevels??[]).map((entry)=>entry.classId).join(" ")}`.toLowerCase();
  if(/wizard|위저드/.test(name)) return "int";
  if(/cleric|druid|ranger|클레릭|드루이드|레인저/.test(name)) return "wis";
  if(/bard|sorcerer|warlock|paladin|바드|소서러|워락|팔라딘/.test(name)) return "cha";
  return (["int","wis","cha"] as AbilityKey[]).sort((a,b)=>sheet.abilities[b]-sheet.abilities[a])[0];
}

const modifier=(score:number)=>Math.floor((score-10)/2);

export function isSpellcaster(sheet:SpellSheet):boolean {
  return Boolean((sheet.cantrips??[]).length||(sheet.preparedSpells??[]).length);
}

/** Spell slot pools for the combatant: the sheet's maximums, else the multiclass table; recovered on a long rest. */
export function spellSlotPools(sheet:SpellSheet):ResourcePool[] {
  if(!isSpellcaster(sheet)) return [];
  const maximums=sheet.spellSlotMaximums??multiclassSpellSlots(sheet.classLevels??[]).slots;
  return Object.entries(maximums).map(([level,maximum])=>({level:Number(level),maximum})).filter((entry)=>Number.isInteger(entry.level)&&entry.level>0&&entry.maximum>0).sort((a,b)=>a.level-b.level)
    .map((entry)=>({id:slotResourceId(entry.level),label:`${entry.level}레벨 주문 슬롯`,current:entry.maximum,maximum:entry.maximum,recovery:{longRest:"all"}}));
}

/** Hit dice pools from the class levels: one pool per die size, remaining count from the sheet when it says. */
export function hitDicePools(sheet:SpellSheet):Array<{id:string;sides:number;current:number;maximum:number}> {
  const bySides=new Map<number,number>();
  for(const track of sheet.classLevels??[]) {
    const sides=classById(track.classId)?.hitDie;
    if(!sides) continue;
    bySides.set(sides,(bySides.get(sides)??0)+track.level);
  }
  if(!bySides.size&&sheet.level>0) bySides.set(8,sheet.level);
  return [...bySides.entries()].map(([sides,maximum])=>({id:`hit-die-d${sides}`,sides,current:Math.min(maximum,sheet.hitDiceByDie?.[`d${sides}`]??maximum),maximum}));
}

export function casterContext(sheet:SpellSheet):SpellCasterContext {
  const ability=spellAbilityOf(sheet);
  const abilityModifier=modifier(sheet.abilities[ability]);
  const preparedRaw=sheet.preparedSpells??[];
  const slotResourceIds:Partial<Record<number,string>>={};
  for(const pool of spellSlotPools(sheet)) slotResourceIds[Number(pool.id.slice(SLOT_RESOURCE_PREFIX.length))]=pool.id;
  return {
    characterLevel:sheet.level,
    spellAttackModifier:sheet.proficiencyBonus+abilityModifier,
    spellSaveDc:8+sheet.proficiencyBonus+abilityModifier,
    spellcastingAbilityModifier:abilityModifier,
    preparedSpellIds:preparedRaw.filter((id)=>!id.startsWith("always:")).map(normalized),
    alwaysPreparedSpellIds:preparedRaw.filter((id)=>id.startsWith("always:")).map(normalized),
    cantripSpellIds:(sheet.cantrips??[]).map(normalized),
    slotResourceIds,
  };
}

const ECONOMY_KO={action:"행동","bonus-action":"추가 행동",reaction:"반응"} as const;

function primarySummary(definition:SpellMechanicDefinition):string {
  const primary=definition.primary;
  switch(primary.kind) {
    case "attack-damage": return `주문 공격 · ${primary.dice.count}d${primary.dice.sides} ${primary.damageType}`;
    case "save-damage": return `${primary.saveAbility.toUpperCase()} 내성 · ${primary.dice.count}d${primary.dice.sides} ${primary.damageType}${primary.successDamage==="half"?" (성공 시 절반)":""}`;
    case "healing": return `${primary.dice.count}d${primary.dice.sides}${primary.dice.addSpellcastingModifier?" + 주문 능력 수정치":""} 회복`;
    case "tracked-effect": return primary.summary;
    default: return primary.kind;
  }
}

declare module "../app/contracts" {
  interface ActionVm {
    /** A spell cast through the domain kernel: the spell, its base level, whether it takes a slot and concentration. */
    tableSpell?:{spellId:string;baseLevel:number;concentration:boolean;maxSlotLevel:number;/** An ally-targeting spell that may also target the caster (Bless). */allowSelf?:boolean};
  }
}

/** One action per castable cantrip or prepared spell. Presentation-only spells are listed as unavailable with the reason. */
export function spellActionsFor(actor:Actor,sheet:SpellSheet):ActionVm[] {
  if(!isSpellcaster(sheet)) return [];
  const caster=casterContext(sheet);
  const highestSlot=Math.max(0,...Object.keys(caster.slotResourceIds).map(Number));
  const actions:ActionVm[]=[];
  const seen=new Set<string>();
  for(const spellId of [...caster.cantripSpellIds,...caster.preparedSpellIds,...(caster.alwaysPreparedSpellIds??[])]) {
    if(seen.has(spellId)) continue;
    seen.add(spellId);
    const definition=normalizedSpellDefinitionById(spellId);
    const presentation=spellPresentationById(spellId);
    const name=presentation?.name??spellId.split(".").pop()??spellId;
    const executable=Boolean(definition&&(definition.runtimeSupport==="combat-executable"||definition.runtimeSupport==="tracked-executable"));
    if(!definition||!executable) {
      actions.push({id:`spell.${spellId}`,actorId:actor.id,name,category:"magic",target:"none",economy:"행동",resolutionKind:"no-roll",summary:presentation?`${presentation.level}레벨 ${presentation.school}`:"자동 실행 없음",available:false,disabledReason:"이 주문은 자동 실행되지 않습니다. 설명을 읽고 DM 판정으로 처리하세요.",eligibleTargetIds:[],details:[detail("실행","수동 (DM 판정)")]});
      continue;
    }
    const relations=definition.targeting.allowedRelations??["self","ally","enemy","neutral"];
    const onlySelf=relations.length===1&&relations[0]==="self";
    const onlyAllies=!relations.includes("enemy")&&!relations.includes("neutral");
    const onlyEnemies=!relations.includes("ally")&&!relations.includes("self");
    const multi=(definition.targeting.maxTargets??1)>1;
    const target:ActionVm["target"]=onlySelf?"self":onlyAllies?"ally":onlyEnemies?(multi?"multi-enemy":"enemy"):"any";
    const economy=ECONOMY_KO[definition.castingEconomy];
    const isCantrip=definition.baseLevel===0;
    const details:ActionDetailVm[]=[
      detail("레벨",isCantrip?"소마법":`${definition.baseLevel}레벨`),
      detail("시전",economy),
      detail("사거리",definition.targeting.rangeFeet?`${definition.targeting.rangeFeet}피트`:"접촉/자신"),
      detail("대상",`${definition.targeting.minTargets??1}~${definition.targeting.maxTargets??1}`),
      ...(definition.concentration?[detail("집중","필요")]:[]),
      ...(definition.components?[detail("구성요소",[definition.components.verbal?"음성":"",definition.components.somatic?"동작":"",(definition.components.materials?.length||definition.components.material)?"물질":""].filter(Boolean).join(" · ")||"없음")]:[]),
    ];
    actions.push({
      id:`spell.${spellId}`,actorId:actor.id,name,category:"magic",target,economy,
      resolutionKind:definition.primary.kind==="attack-damage"||definition.primary.kind==="multi-attack-damage"?"attack":definition.primary.kind==="save-damage"||definition.primary.kind==="save-effect"||definition.primary.kind==="save-compound-damage"?"saving-throw":definition.primary.kind==="healing"?"healing":"no-roll",
      summary:`${isCantrip?"소마법":`${definition.baseLevel}레벨`} · ${primarySummary(definition)}`,
      available:true,eligibleTargetIds:[],
      ...(multi?{maxTargets:definition.targeting.maxTargets}:{}),
      ...(!isCantrip?{resourceCost:{resourceId:slotResourceId(definition.baseLevel),amount:1}}:{}),
      ...(definition.primary.kind==="save-damage"?{saveDc:caster.spellSaveDc}:{}),
      tableSpell:{spellId,baseLevel:definition.baseLevel,concentration:Boolean(definition.concentration),maxSlotLevel:isCantrip?0:highestSlot,...(target==="ally"&&relations.includes("self")?{allowSelf:true}:{})},
      details,
    });
  }
  return actions;
}

function detail(label:string,value:string):ActionDetailVm { return {label,value}; }

function formulaCount(definition:SpellMechanicDefinition,slotLevel:number|undefined,characterLevel:number) {
  const primary=definition.primary;
  if(primary.kind!=="attack-damage"&&primary.kind!=="save-damage"&&primary.kind!=="healing"&&primary.kind!=="temporary-hp") return 0;
  const formula=primary.dice;
  const cantripSteps=formula.cantripScaling?[5,11,17].filter((level)=>characterLevel>=level).length:0;
  return formula.count+cantripSteps+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(formula.dicePerSlotAboveBase??0);
}

/** Every die the cast needs, drawn from the table's dice source in a fixed order (attack, effect dice, saves). */
export function spellDice(dice:Dice,definition:SpellMechanicDefinition,slotLevel:number|undefined,characterLevel:number,targetIds:string[]):SpellCastDiceInput {
  const primary=definition.primary;
  const spellId=definition.spellId;
  const faces=(sides:number,count:number,purpose:string)=>count>0?dice.faces(sides,count,purpose):[];
  switch(primary.kind) {
    case "tracked-effect": case "full-healing": case "revive": case "maximum-hp": case "dispel": return {};
    case "power-word-kill": return {effectFaces:faces(primary.fallbackDamage.sides,primary.fallbackDamage.count,"주문 피해")};
    case "attack-damage": {
      const attack=dice.faces(20,2,"주문 공격");
      return {attack:{id:`${spellId}:attack`,purpose:"주문 공격",sides:20,faces:attack},effectFaces:faces(primary.dice.sides,formulaCount(definition,slotLevel,characterLevel),"주문 피해")};
    }
    case "multi-attack-damage": {
      const attackCount=spellMultiAttackCount(definition,characterLevel,slotLevel);
      return {attackInstances:Array.from({length:attackCount},(_,index)=>({targetId:targetIds[index%Math.max(1,targetIds.length)],attack:{id:`${spellId}:attack:${index}`,purpose:`주문 공격 ${index+1}`,sides:20 as const,faces:dice.faces(20,2,"주문 공격")},effectFaces:faces(primary.dicePerAttack.sides,primary.dicePerAttack.count,"주문 피해")}))};
    }
    case "save-damage": {
      const effectFaces=faces(primary.dice.sides,formulaCount(definition,slotLevel,characterLevel),"주문 피해");
      return {effectFaces,saves:Object.fromEntries(targetIds.map((targetId)=>[targetId,{id:`${spellId}:save:${targetId}`,purpose:"내성 굴림",sides:20 as const,faces:dice.faces(20,2,"내성")}]))};
    }
    case "save-compound-damage": {
      const componentFaces=primary.components.map((component)=>faces(component.dice.sides,component.dice.count+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(component.dice.dicePerSlotAboveBase??0),"주문 피해"));
      return {componentFaces,saves:Object.fromEntries(targetIds.map((targetId)=>[targetId,{id:`${spellId}:save:${targetId}`,purpose:"내성 굴림",sides:20 as const,faces:dice.faces(20,2,"내성")}]))};
    }
    case "healing": case "temporary-hp": return {effectFaces:faces(primary.dice.sides,formulaCount(definition,slotLevel,characterLevel),"회복")};
    case "save-effect": return {saves:Object.fromEntries(targetIds.map((targetId)=>[targetId,{id:`${spellId}:save:${targetId}`,purpose:"내성 굴림",sides:20 as const,faces:dice.faces(20,2,"내성")}]))};
    default: {
      const projectiles=primary as {baseProjectiles:number;projectilesPerSlotAboveBase?:number;projectileDice:{sides:number}};
      const count=projectiles.baseProjectiles+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(projectiles.projectilesPerSlotAboveBase??0);
      return {projectileFaces:faces(projectiles.projectileDice.sides,count,"투사체")};
    }
  }
}

/** Theater of the mind: targets are in range and visible unless the table says otherwise (badges, hidden). */
export function spellTargets(state:TableState,actor:Actor,definition:SpellMechanicDefinition,targetIds:string[],acOf:(target:Actor)=>number,saveOf:(target:Actor,key:AbilityKey)=>number):SpellCastTarget[] {
  return targetIds.map((targetId)=>{
    const target=state.actors[targetId];
    const relation=targetId===actor.id?"self":target.side===actor.side?"ally":"enemy";
    const range=definition.targeting.rangeFeet??0;
    return {
      id:targetId,kind:"creature",relation,distanceFeet:relation==="self"?0:Math.min(5,Math.max(0,range)),visible:true,cover:"none",
      ac:acOf(target),creatureKind:target.kind==="character"?"character":"monster",
      saveModifiers:Object.fromEntries((["str","dex","con","int","wis","cha"] as AbilityKey[]).map((key)=>[key,saveOf(target,key)])),
      targetCanSeeCaster:true,
    };
  });
}
