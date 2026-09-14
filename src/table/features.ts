import type { CharacterSheet, ActionVm, ActionDetailVm, AbilityKey } from "../app/contracts";
import type { ResourcePool } from "../domain/resources";
import { coreClassResourceDefinitions, DRUID_WILD_SHAPE_RESOURCE_ID, FIGHTER_ACTION_SURGE_RESOURCE_ID, FIGHTER_SECOND_WIND_RESOURCE_ID, PALADIN_LAY_ON_HANDS_RESOURCE_ID, CLERIC_CHANNEL_DIVINITY_RESOURCE_ID } from "../domain/coreClassResources";
import { druidWildShapeFormLimits } from "../domain/druidWildShape";
import { BARBARIAN_RAGE_RESOURCE_ID } from "../domain/barbarianBerserker";
import { MONK_FOCUS_RESOURCE_ID } from "../domain/monkOpenHand";
import { BARDIC_INSPIRATION_RESOURCE_ID, bardicInspirationDieSides, bardicInspirationMaximum, bardicInspirationResourceDefinition } from "../domain/bardicInspiration";
import type { Actor } from "./state";

/**
 * The feature ledger (RULES_RUNTIME_SPECS.md §3): what a class, subclass, species or feat lets a character do at the
 * table, computed from the sheet's class levels. Resource pools carry their own recovery; actions carry the feature
 * key the handler executes; riders attach to attacks. Everything here is pure over the sheet.
 */
export const CLASS={barbarian:"dnd.srd521.class.barbarian",bard:"dnd.srd521.class.bard",cleric:"dnd.srd521.class.cleric",druid:"dnd.srd521.class.druid",fighter:"dnd.srd521.class.fighter",monk:"dnd.srd521.class.monk",paladin:"dnd.srd521.class.paladin",ranger:"dnd.srd521.class.ranger",rogue:"dnd.srd521.class.rogue",sorcerer:"dnd.srd521.class.sorcerer",warlock:"dnd.srd521.class.warlock",wizard:"dnd.srd521.class.wizard"} as const;

export type FeatureKey=
  |"action-surge"|"rage-start"|"rage-end"|"lay-on-hands"|"lay-on-hands-cure"|"flurry-of-blows"|"patient-defense"|"patient-defense-focus"|"step-of-the-wind"|"step-of-the-wind-focus"|"martial-arts-strike"|"cunning-dash"|"cunning-disengage"|"cunning-hide"|"divine-spark-heal"|"divine-spark-damage"|"turn-undead"|"off-hand-attack"|"bardic-inspiration"|"wild-shape"|"wild-shape-end";

declare module "../app/contracts" {
  interface ActionVm {
    /** A class feature the table executes itself (RULES_RUNTIME_SPECS.md §3). */
    tableFeature?:FeatureKey;
    /** Conditions a failed save applies (Turn Undead, stat-block riders), for one minute. */
    tableFailConditions?:string[];
    /** The player supplies an amount with the act command (Lay on Hands). */
    tableAmountInput?:{min:number;max:number;label:string};
  }
}

const abilityModifier=(score:number)=>Math.floor((score-10)/2);
const signed=(value:number)=>value>=0?`+${value}`:`${value}`;
const detail=(label:string,value:string,source?:string):ActionDetailVm=>source?{label,value,source}:{label,value};
const SOURCE="SRD 5.2.1";

export function classLevel(sheet:CharacterSheet,classId:string):number {
  return sheet.classLevels?.find((entry)=>entry.classId===classId)?.level??0;
}

export function rageUses(level:number):number { return level>=17?6:level>=12?5:level>=6?4:level>=3?3:level>=1?2:0; }
export function martialArtsDie(level:number):number { return level>=17?12:level>=11?10:level>=5?8:6; }
export function sneakAttackDice(level:number):number { return Math.ceil(level/2); }
export function secondWindUses(level:number):number { return level>=10?4:level>=4?3:level>=1?2:0; }
export function actionSurgeUses(level:number):number { return level>=17?2:level>=2?1:0; }

/** Pact Magic (2024): slots of one level, all recovered on a short rest. */
export function pactMagicSlots(level:number):{slotLevel:number;count:number}|null {
  if(level<1) return null;
  const slotLevel=Math.min(5,Math.ceil(level/2));
  const count=level>=17?4:level>=11?3:level>=2?2:1;
  return {slotLevel,count};
}

/** Class resource pools with their recovery, from the domain's definitions; legacy sheet pools with the same feature win. */
export function featureResourcePools(sheet:CharacterSheet):ResourcePool[] {
  const tracks=(sheet.classLevels??[]).map((entry)=>({classId:entry.classId,className:entry.className,level:entry.level,subclassName:entry.subclassName}));
  const pools:ResourcePool[]=[];
  const hasLegacy=(pattern:RegExp)=>sheet.resources.some((resource)=>pattern.test(`${resource.id} ${resource.label}`));
  for(const definition of coreClassResourceDefinitions(tracks)) {
    if(definition.resourceId===FIGHTER_SECOND_WIND_RESOURCE_ID&&hasLegacy(/second-wind|세컨드 윈드|재기의 바람/i)) continue;
    pools.push({id:definition.resourceId,label:definition.label,current:definition.maximum,maximum:definition.maximum,recovery:definition.recovery});
  }
  const barbarian=classLevel(sheet,CLASS.barbarian);
  if(barbarian>=1&&!hasLegacy(/rage|격노/i)) pools.push({id:BARBARIAN_RAGE_RESOURCE_ID,label:"격노",current:rageUses(barbarian),maximum:rageUses(barbarian),recovery:{shortRest:1,longRest:"all"}});
  const monk=classLevel(sheet,CLASS.monk);
  if(monk>=2&&!hasLegacy(/focus|기 점수|기점/i)) pools.push({id:MONK_FOCUS_RESOURCE_ID,label:"기 점수",current:monk,maximum:monk,recovery:{shortRest:"all",longRest:"all"}});
  const bard=classLevel(sheet,CLASS.bard);
  if(bard>=1&&!hasLegacy(/inspiration|영감/i)) { const definition=bardicInspirationResourceDefinition(bard,abilityModifier(sheet.abilities.cha)); pools.push({id:definition.resourceId,label:definition.label,current:definition.maximum,maximum:definition.maximum,recovery:definition.recovery}); }
  // The sheet's own current counts win over the fresh maximums.
  return pools.map((pool)=>{ const own=sheet.resources.find((resource)=>resource.id===pool.id); return own?{...pool,current:Math.max(0,Math.min(pool.maximum,own.current))}:pool; });
}

function unarmedAbility(sheet:CharacterSheet):AbilityKey {
  const monk=classLevel(sheet,CLASS.monk);
  return monk>=1&&sheet.abilities.dex>sheet.abilities.str?"dex":"str";
}

/** Unarmed Strike damage for this character: 1 + STR, or the Martial Arts die + DEX/STR for a Monk. */
export function unarmedStrike(sheet:CharacterSheet):{dice:string;flat:number;bonus:number;label:string} {
  const monk=classLevel(sheet,CLASS.monk);
  const key=unarmedAbility(sheet);
  const mod=abilityModifier(sheet.abilities[key]);
  if(monk>=1) return {dice:`1d${martialArtsDie(monk)}`,flat:mod,bonus:sheet.proficiencyBonus+mod,label:`무예 1d${martialArtsDie(monk)} ${signed(mod)}`};
  return {dice:"0d2",flat:Math.max(0,1+mod),bonus:sheet.proficiencyBonus+mod,label:`${Math.max(0,1+mod)} 타격`};
}

/** Feature actions the table executes for this character. */
export function featureActions(actor:Actor,sheet:CharacterSheet,attacksPerAction:number):ActionVm[] {
  const actorId=actor.id;
  const actions:ActionVm[]=[];
  const fighter=classLevel(sheet,CLASS.fighter);
  if(fighter>=2) actions.push({id:"action.action-surge",actorId,name:"행동 폭증",category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:`이번 턴에 행동 1회 추가 · 사용 ${actionSurgeUses(fighter)}회`,available:true,eligibleTargetIds:[actorId],resourceCost:{resourceId:FIGHTER_ACTION_SURGE_RESOURCE_ID,amount:1},tableFeature:"action-surge",details:[detail("효과","자기 턴에 행동 하나를 더 한다 (마법 행동 제외)"),detail("회복","짧은 휴식"),detail("출처",`${SOURCE} · Action Surge`)]});
  const barbarian=classLevel(sheet,CLASS.barbarian);
  if(barbarian>=1) {
    const bonus=barbarian>=16?4:barbarian>=9?3:2;
    actions.push({id:"action.rage",actorId,name:"격노",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:`타격·관통·참격 저항, 근력 근접 피해 +${bonus} · 10분`,available:true,eligibleTargetIds:[actorId],resourceCost:{resourceId:BARBARIAN_RAGE_RESOURCE_ID,amount:1},tableFeature:"rage-start",details:[detail("효과",`타격·관통·참격 피해 저항 · 근력 근접 공격 피해 +${bonus} · 근력 판정·내성 유리`),detail("지속","10분. 공격하거나 피해를 받거나 추가 행동으로 연장하지 않으면 턴 끝에 종료 (2024)"),detail("출처",`${SOURCE} · Rage`)]});
    actions.push({id:"action.rage-end",actorId,name:"격노 종료",category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:"격노를 끝낸다 (비용 없음)",available:true,eligibleTargetIds:[actorId],tableFeature:"rage-end",details:[detail("비용","없음")]});
  }
  const druid=classLevel(sheet,CLASS.druid);
  if(druid>=2) {
    const limits=druidWildShapeFormLimits(druid);
    actions.push({id:"action.wild-shape",actorId,name:"야생 변신",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:`CR ${limits.maximumChallengeRating} 이하 야수로 · 임시 HP ${druid} · ${druid/2}시간`,available:true,eligibleTargetIds:[actorId],resourceCost:{resourceId:DRUID_WILD_SHAPE_RESOURCE_ID,amount:1},tableFeature:"wild-shape",details:[detail("형태",`act 명령의 formId로 야수(몬스터 id)를 고른다 · CR ${limits.maximumChallengeRating} 이하${limits.flightAllowed?"":" · 비행 불가"}`),detail("효과",`형태의 AC와 공격을 쓴다 · 임시 HP ${druid}`),detail("출처",`${SOURCE} · Wild Shape`)]});
    actions.push({id:"action.wild-shape-end",actorId,name:"야생 변신 해제",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:"원래 모습으로",available:true,eligibleTargetIds:[actorId],tableFeature:"wild-shape-end",details:[detail("비용","추가 행동")]});
  }
  const bard=classLevel(sheet,CLASS.bard);
  if(bard>=1) actions.push({id:"action.bardic-inspiration",actorId,name:"바드의 영감",category:"basic",target:"ally",economy:"추가 행동",resolutionKind:"no-roll",summary:`아군 하나에게 d${bardicInspirationDieSides(bard)} 영감 주사위 · 사용 ${bardicInspirationMaximum(abilityModifier(sheet.abilities.cha))}회`,available:true,eligibleTargetIds:[],resourceCost:{resourceId:BARDIC_INSPIRATION_RESOURCE_ID,amount:1},tableFeature:"bardic-inspiration",details:[detail("효과",`받은 크리처는 1시간 안에 실패한 d20 판정 하나에 d${bardicInspirationDieSides(bard)}를 더할 수 있다`),detail("회복",bard>=5?"짧은 휴식":"긴 휴식"),detail("출처",`${SOURCE} · Bardic Inspiration`)]});
  const paladin=classLevel(sheet,CLASS.paladin);
  if(paladin>=1) {
    actions.push({id:"action.lay-on-hands",actorId,name:"안수",category:"basic",target:"any",economy:"추가 행동",resolutionKind:"healing",summary:`풀에서 원하는 만큼 회복 (최대 ${paladin*5})`,available:true,eligibleTargetIds:[],tableFeature:"lay-on-hands",tableAmountInput:{min:1,max:paladin*5,label:"회복량"},details:[detail("풀",`${paladin*5} HP · 긴 휴식에 회복`),detail("비용","추가 행동 (2024)"),detail("출처",`${SOURCE} · Lay On Hands`)]});
    actions.push({id:"action.lay-on-hands.cure",actorId,name:"안수 · 중독 해제",category:"basic",target:"any",economy:"추가 행동",resolutionKind:"no-roll",summary:"풀에서 5를 써서 중독 상태 하나를 없앤다",available:true,eligibleTargetIds:[],resourceCost:{resourceId:PALADIN_LAY_ON_HANDS_RESOURCE_ID,amount:5},tableFeature:"lay-on-hands-cure",details:[detail("비용","추가 행동 · 풀 5"),detail("출처",`${SOURCE} · Lay On Hands`)]});
  }
  const monk=classLevel(sheet,CLASS.monk);
  if(monk>=1) {
    const strike=unarmedStrike(sheet);
    actions.push({id:"action.martial-arts.strike",actorId,name:"무예 · 추가 타격",category:"weapon",target:"any",economy:"추가 행동",resolutionKind:"attack",summary:`${signed(strike.bonus)} · ${strike.label} (추가 행동)`,available:true,eligibleTargetIds:[],attackBonus:strike.bonus,attacksPerAction:1,damage:[{type:"타격",dice:strike.dice,flat:strike.flat,average:strike.flat}],runtimeAttack:{sourceKind:"unarmed",rangeFeet:5,attackMode:"melee",diceSides:martialArtsDie(monk),diceCount:1,damageSource:`character:${actorId}:martial-arts`},tableFeature:"martial-arts-strike",details:[detail("조건","이번 턴에 공격 행동으로 맨손 타격이나 몽크 무기를 썼을 때"),detail("출처",`${SOURCE} · Martial Arts`)]});
  }
  if(monk>=2) {
    const strike=unarmedStrike(sheet);
    actions.push({id:"action.flurry-of-blows",actorId,name:"질풍 연타",category:"weapon",target:"any",economy:"추가 행동",resolutionKind:"attack",summary:`기 1 · 맨손 타격 2회 (추가 행동)`,available:true,eligibleTargetIds:[],attackBonus:strike.bonus,attacksPerAction:2,damage:[{type:"타격",dice:strike.dice,flat:strike.flat,average:strike.flat}],runtimeAttack:{sourceKind:"unarmed",rangeFeet:5,attackMode:"melee",diceSides:martialArtsDie(monk),diceCount:1,damageSource:`character:${actorId}:flurry`},resourceCost:{resourceId:MONK_FOCUS_RESOURCE_ID,amount:1},tableFeature:"flurry-of-blows",details:[detail("비용","추가 행동 · 기 1"),detail("출처",`${SOURCE} · Monk's Focus`)]});
    actions.push({id:"action.patient-defense",actorId,name:"인내의 방어",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:"추가 행동으로 이탈",available:true,eligibleTargetIds:[actorId],sessionStatusEffect:{status:"이탈",target:"actor",successOutcome:"이탈",expiresAtActorTurnBoundary:"end"},tableFeature:"patient-defense",details:[detail("효과","이탈 (기 없이)"),detail("출처",`${SOURCE} · Monk's Focus`)]});
    actions.push({id:"action.patient-defense.focus",actorId,name:"인내의 방어 (기 1)",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:"기 1 · 이탈 + 회피",available:true,eligibleTargetIds:[actorId],sessionStatusEffect:{status:"회피",target:"actor",successOutcome:"회피 + 이탈",expiresAtActorTurnBoundary:"start"},resourceCost:{resourceId:MONK_FOCUS_RESOURCE_ID,amount:1},tableFeature:"patient-defense-focus",details:[detail("효과","이탈과 회피를 함께"),detail("비용","추가 행동 · 기 1")]});
    actions.push({id:"action.step-of-the-wind",actorId,name:"바람의 발걸음",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:`추가 행동으로 질주 (+${sheet.speed}피트)`,available:true,eligibleTargetIds:[actorId],movementBudgetGainFeet:sheet.speed,tableFeature:"step-of-the-wind",details:[detail("효과","질주 (기 없이)"),detail("출처",`${SOURCE} · Monk's Focus`)]});
    actions.push({id:"action.step-of-the-wind.focus",actorId,name:"바람의 발걸음 (기 1)",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:"기 1 · 질주 + 이탈, 도약 거리 2배",available:true,eligibleTargetIds:[actorId],movementBudgetGainFeet:sheet.speed,sessionStatusEffect:{status:"이탈",target:"actor",successOutcome:"질주 + 이탈",expiresAtActorTurnBoundary:"end"},resourceCost:{resourceId:MONK_FOCUS_RESOURCE_ID,amount:1},tableFeature:"step-of-the-wind-focus",details:[detail("효과","질주와 이탈을 함께 · 도약 거리 2배"),detail("비용","추가 행동 · 기 1")]});
  }
  const rogue=classLevel(sheet,CLASS.rogue);
  if(rogue>=2) {
    actions.push({id:"action.cunning.dash",actorId,name:"교묘한 행동 · 질주",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:`추가 행동으로 질주 (+${sheet.speed}피트)`,available:true,eligibleTargetIds:[actorId],movementBudgetGainFeet:sheet.speed,tableFeature:"cunning-dash",details:[detail("출처",`${SOURCE} · Cunning Action`)]});
    actions.push({id:"action.cunning.disengage",actorId,name:"교묘한 행동 · 이탈",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:"추가 행동으로 이탈",available:true,eligibleTargetIds:[actorId],sessionStatusEffect:{status:"이탈",target:"actor",successOutcome:"이탈",expiresAtActorTurnBoundary:"end"},tableFeature:"cunning-disengage",details:[detail("출처",`${SOURCE} · Cunning Action`)]});
    actions.push({id:"action.cunning.hide",actorId,name:"교묘한 행동 · 숨기",category:"basic",target:"none",economy:"추가 행동",resolutionKind:"ability-check",summary:"추가 행동으로 숨기 (민첩(은신) DC 15)",available:true,eligibleTargetIds:[],checkBonus:abilityModifier(sheet.abilities.dex)+(sheet.skills.some((entry)=>entry.startsWith("은신"))?sheet.proficiencyBonus:0),tableHide:true,tableFeature:"cunning-hide",details:[detail("판정","민첩(은신) DC 15"),detail("출처",`${SOURCE} · Cunning Action`)]});
  }
  const cleric=classLevel(sheet,CLASS.cleric);
  if(cleric>=2) {
    const wis=abilityModifier(sheet.abilities.wis);
    const dice=cleric>=18?4:cleric>=13?3:cleric>=7?2:1;
    const dc=8+sheet.proficiencyBonus+wis;
    actions.push({id:"action.divine-spark.heal",actorId,name:"신성한 불꽃 · 회복",category:"basic",target:"any",economy:"행동",resolutionKind:"healing",summary:`${dice}d8 ${signed(wis)} 회복 · 채널 디비니티 1`,available:true,eligibleTargetIds:[],healing:{dice:`${dice}d8`,flat:wis,average:dice*4+wis},resourceCost:{resourceId:CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,amount:1},tableFeature:"divine-spark-heal",details:[detail("대상","30피트 안 크리처 1명"),detail("출처",`${SOURCE} · Divine Spark`)]});
    actions.push({id:"action.divine-spark.damage",actorId,name:"신성한 불꽃 · 피해",category:"basic",target:"enemy",economy:"행동",resolutionKind:"saving-throw",summary:`건강 내성 DC ${dc} · ${dice}d8 ${signed(wis)} 광휘 또는 사령, 성공 시 절반`,available:true,eligibleTargetIds:[],saveDc:dc,saveAbility:"건강",saveHalf:true,damage:[{type:"광휘",dice:`${dice}d8`,flat:wis,average:dice*4+wis}],resourceCost:{resourceId:CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,amount:1},tableFeature:"divine-spark-damage",details:[detail("피해 유형","광휘 또는 사령 (DM 토글)"),detail("출처",`${SOURCE} · Divine Spark`)]});
    actions.push({id:"action.turn-undead",actorId,name:"언데드 퇴치",category:"basic",target:"multi-enemy",economy:"행동",resolutionKind:"saving-throw",summary:`지혜 내성 DC ${dc} · 실패 시 1분간 공포·행동불능`,available:true,eligibleTargetIds:[],saveDc:dc,saveAbility:"지혜",maxTargets:8,tableFailConditions:["frightened","incapacitated"],resourceCost:{resourceId:CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,amount:1},tableFeature:"turn-undead",details:[detail("대상","30피트 안 언데드 (DM이 고른다)"),detail("실패","1분간 공포 + 행동불능, 피해를 받으면 종료"),detail("출처",`${SOURCE} · Turn Undead`)]});
  }
  void attacksPerAction;
  return actions;
}

/** Rider damage that class features add to a weapon or unarmed attack (RULES_RUNTIME_SPECS.md §3). */
export interface FeatureRider { sourceId:string;label:string;damageType:string;dice?:{sides:number;count:number};flat?:number;oncePerOwnTurnFeatureId?:string }

export function featureRiders(sheet:CharacterSheet,input:{meleeStrength:boolean;finesseOrRanged:boolean;damageType:string;raging:boolean;sneakEligible:boolean}):FeatureRider[] {
  const riders:FeatureRider[]=[];
  const barbarian=classLevel(sheet,CLASS.barbarian);
  if(barbarian>=1&&input.raging&&input.meleeStrength) riders.push({sourceId:"feature:barbarian.rage-damage",label:"격노",damageType:input.damageType,flat:barbarian>=16?4:barbarian>=9?3:2});
  const rogue=classLevel(sheet,CLASS.rogue);
  if(rogue>=1&&input.finesseOrRanged&&input.sneakEligible) riders.push({sourceId:"feature:rogue.sneak-attack",label:"암습",damageType:input.damageType,dice:{sides:6,count:sneakAttackDice(rogue)},oncePerOwnTurnFeatureId:"dnd.srd521.feature.rogue.sneak-attack"});
  return riders;
}
