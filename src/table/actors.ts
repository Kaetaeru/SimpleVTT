import type { CombatantRuntimeState } from "../domain/combatState";
import { beginTurn } from "../domain/turnEconomy";
import type { AbilityKey, ActionDetailVm, ActionVm, CharacterSheet, CombatantDefinitionVm } from "../app/contracts";
import type { CombatantRuntimeAttackVm, CombatantRuntimeSaveActionVm, CombatantRuntimeTextActionVm } from "../app/combatantRuntimeContracts";
import { abilityLabelKo, conditionLabelKo, srdMonsterById, srdMonsterCombatantDefinition } from "../app/srdMonsterCatalog";
import type { ConditionId } from "../domain/conditions";
import type { ActorSpec } from "./commands";
import { diceAverage, parseDiceNotation } from "./dice";
import type { Actor, Side, TableState } from "./state";

export const CONDITION_IDS:ConditionId[]=["blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"];
const CONDITION_BY_LABEL=new Map(CONDITION_IDS.map((id)=>[conditionLabelKo(id),id]));
export const ABILITY_KEYS:AbilityKey[]=["str","dex","con","int","wis","cha"];

export const abilityModifier=(score:number)=>Math.floor((score-10)/2);
export const signed=(value:number)=>value>=0?`+${value}`:`${value}`;
const detail=(label:string,value:string,source?:string):ActionDetailVm=>source?{label,value,source}:{label,value};

export function damageFromDiceText(dice:string,flat:number) {
  const parsed=parseDiceNotation(dice)??{count:0,sides:2,flat:0};
  return {count:parsed.count,sides:parsed.sides,flat:flat+parsed.flat};
}

/** "1d8 + 4 참격" → dice/flat/type as a character sheet lists its attacks. */
export function parseAttackDamage(text:string):{dice:string;flat:number;type:string} {
  const match=/^\s*(\d+d\d+)\s*(?:([+-])\s*(\d+))?\s*(\S+)?\s*$/i.exec(text);
  if(!match) return {dice:"0d2",flat:Number.parseInt(text,10)||0,type:text.replace(/[\d\s+-]/g,"")||"타격"};
  const flat=match[2]?Number(match[3])*(match[2]==="-"?-1:1):0;
  return {dice:match[1].toLowerCase(),flat,type:match[4]??"타격"};
}

function instanceIds(state:TableState,base:string,count:number) {
  const taken=new Set(Object.keys(state.actors));
  const ids:string[]=[];
  let index=Object.keys(state.actors).filter((id)=>id.startsWith(`${base}.instance-`)).length;
  while(ids.length<count) {
    index+=1;
    const candidate=`${base}.instance-${index}`;
    if(!taken.has(candidate)) ids.push(candidate);
  }
  return ids;
}

function monsterCombatant(actorId:string,definition:CombatantDefinitionVm):CombatantRuntimeState {
  const stats=definition.runtimeStats;
  const speed=stats?.speed??30;
  return {
    id:actorId,
    baseSpeed:speed,
    life:{hp:{current:definition.maxHp,maximum:definition.maxHp,temporary:0},deathSaves:{successes:0,failures:0},stable:false,unconscious:false,dead:false},
    economy:beginTurn(speed),
    resources:[],
    hitDice:[],
    damageDefenses:[
      ...(stats?.resistances??[]).map((damageType)=>({source:`monster:${actorId}:resistance:${damageType}`,kind:"resistance" as const,damageType})),
      ...(stats?.vulnerabilities??[]).map((damageType)=>({source:`monster:${actorId}:vulnerability:${damageType}`,kind:"vulnerability" as const,damageType})),
      ...(stats?.immunities??[]).map((damageType)=>({source:`monster:${actorId}:immunity:${damageType}`,kind:"immunity" as const,damageType})),
    ],
    conditionImmunities:definition.statusImmunities.flatMap((label)=>{const id=CONDITION_BY_LABEL.get(label);return id?[id]:[];}),
  };
}

function characterCombatant(sheet:CharacterSheet):CombatantRuntimeState {
  const speed=Number.isInteger(sheet.speed)&&sheet.speed>=0?sheet.speed:30;
  return {
    id:sheet.id,
    baseSpeed:speed,
    life:{hp:{current:sheet.hp,maximum:sheet.maxHp,temporary:sheet.tempHp??0},deathSaves:{successes:0,failures:0},stable:false,unconscious:sheet.hp<=0,dead:false},
    economy:beginTurn(speed),
    resources:sheet.resources.map((resource)=>({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max})),
    hitDice:[],
    damageDefenses:[],
  };
}

export function monsterDefinition(monsterId:string):CombatantDefinitionVm|undefined {
  const monster=srdMonsterById(monsterId);
  return monster?srdMonsterCombatantDefinition(monster):undefined;
}

/** Actors and their runtime combatants for one spec; throws with a Korean reason when the source is unknown. */
export function materializeActors(state:TableState,spec:ActorSpec):{actors:Actor[];combatants:Record<string,CombatantRuntimeState>} {
  if(spec.kind==="character") {
    const sheet=structuredClone(spec.sheet);
    if(!sheet.id||!sheet.name) throw new Error("캐릭터 시트에 id와 이름이 필요합니다.");
    if(state.actors[sheet.id]) throw new Error(`이미 테이블에 있는 캐릭터입니다: ${sheet.name}`);
    const actor:Actor={
      id:sheet.id,kind:"character",name:sheet.name,side:spec.side??"ally",
      source:{kind:"character",sheet,sourceRevision:sheet.sourceRevision??0},
      controllerPeer:spec.controllerPeer,badges:[],engagement:[],initiative:0,
    };
    return {actors:[actor],combatants:{[sheet.id]:characterCombatant(sheet)}};
  }
  const definition=monsterDefinition(spec.monsterId);
  if(!definition) throw new Error(`몬스터를 찾을 수 없습니다: ${spec.monsterId}`);
  const count=Math.max(1,Math.min(20,Math.floor(spec.count??1)));
  const ids=instanceIds(state,definition.id,count);
  const existing=Object.values(state.actors).filter((actor)=>actor.source.kind==="monster"&&actor.source.definitionId===definition.id).length;
  const actors=ids.map((id,index)=>({
    id,kind:"npc" as const,name:spec.name?(count>1?`${spec.name} ${index+1}`:spec.name):`${definition.name} ${existing+index+1}`,
    side:spec.side??"enemy",source:{kind:"monster" as const,definitionId:definition.id,definition:structuredClone(definition)},
    badges:[],engagement:[],initiative:0,
  }));
  return {actors,combatants:Object.fromEntries(actors.map((actor)=>[actor.id,monsterCombatant(actor.id,definition)]))};
}

export function actorAc(actor:Actor):number {
  return actor.source.kind==="character"?actor.source.sheet.ac:actor.source.definition.ac;
}

export function actorDexModifier(actor:Actor):number {
  if(actor.source.kind==="character") return abilityModifier(actor.source.sheet.abilities.dex);
  const stats=actor.source.definition.runtimeStats;
  return stats?abilityModifier(stats.abilities.dex):0;
}

export function actorInitiativeBonus(actor:Actor):number {
  if(actor.source.kind==="monster") return actor.source.definition.runtimeMonster?.initiativeBonus??actorDexModifier(actor);
  return actorDexModifier(actor);
}

export function actorAbilityModifier(actor:Actor,key:AbilityKey):number {
  if(actor.source.kind==="character") return abilityModifier(actor.source.sheet.abilities[key]);
  const stats=actor.source.definition.runtimeStats;
  return stats?abilityModifier(stats.abilities[key]):0;
}

export function actorProficiencyBonus(actor:Actor):number {
  return actor.source.kind==="character"?actor.source.sheet.proficiencyBonus:(actor.source.definition.runtimeStats?.proficiencyBonus??2);
}

export function actorSaveModifier(actor:Actor,key:AbilityKey):number {
  const base=actorAbilityModifier(actor,key);
  if(actor.source.kind==="monster") {
    const proficient=actor.source.definition.runtimeStats?.savingThrowProficiencies.includes(key);
    return base+(proficient?actorProficiencyBonus(actor):0);
  }
  const label=abilityLabelKo(key);
  const proficient=actor.source.sheet.saves.some((entry)=>entry.startsWith(label));
  return base+(proficient?actorProficiencyBonus(actor):0);
}

function weaponAttacksPerAction(sheet:CharacterSheet):number {
  const fighter=sheet.classLevels?.find((entry)=>entry.classId==="dnd.srd521.class.fighter")?.level??0;
  if(fighter>=20) return 4;
  if(fighter>=11) return 3;
  const martial=Math.max(fighter,...(sheet.classLevels??[]).filter((entry)=>/barbarian|paladin|ranger|monk/.test(entry.classId)).map((entry)=>entry.level));
  return martial>=5?2:1;
}

const STANDARD_SOURCE="SRD 5.2.1";

function standardActions(actor:Actor,speed:number):ActionVm[] {
  const actorId=actor.id;
  return [
    {id:"action.dash",actorId,name:"질주",category:"basic",target:"self",economy:"행동",resolutionKind:"no-roll",summary:`이동 가능량 +${speed}피트`,available:true,eligibleTargetIds:[actorId],movementBudgetGainFeet:speed,details:[detail("효과",`이동 가능량 +${speed}피트`),detail("비용","행동 1"),detail("출처",`${STANDARD_SOURCE} · Dash`)]},
    {id:"action.standard.disengage",actorId,name:"이탈",category:"basic",target:"self",economy:"행동",resolutionKind:"no-roll",summary:"이번 턴 이동이 기회 공격을 유발하지 않습니다.",available:true,eligibleTargetIds:[actorId],sessionStatusEffect:{status:"이탈",target:"actor",successOutcome:"이탈",expiresAtActorTurnBoundary:"end"},details:[detail("효과","이번 턴 기회 공격 유발 안 함"),detail("비용","행동 1"),detail("출처",`${STANDARD_SOURCE} · Disengage`)]},
    {id:"action.standard.dodge",actorId,name:"회피",category:"basic",target:"self",economy:"행동",resolutionKind:"no-roll",summary:"다음 턴 시작까지 자신을 향한 공격에 불리, 민첩 내성에 유리.",available:true,eligibleTargetIds:[actorId],sessionStatusEffect:{status:"회피",target:"actor",successOutcome:"회피",expiresAtActorTurnBoundary:"start"},details:[detail("효과","공격에 불리 · 민첩 내성에 유리"),detail("종료","자신의 다음 턴 시작"),detail("비용","행동 1"),detail("출처",`${STANDARD_SOURCE} · Dodge`)]},
    {id:"action.standard.help",actorId,name:"도움",category:"basic",target:"ally",economy:"행동",resolutionKind:"no-roll",summary:"아군의 다음 판정 또는 공격을 돕습니다.",available:true,eligibleTargetIds:[],sessionStatusEffect:{status:"도움 받음",target:"first-target",successOutcome:"지원",expiresAtActorTurnBoundary:"start"},details:[detail("대상","아군 1명"),detail("효과","다음 능력 판정 또는 공격 굴림에 유리"),detail("비용","행동 1"),detail("출처",`${STANDARD_SOURCE} · Help`)]},
  ];
}

function characterActions(actor:Actor,sheet:CharacterSheet):ActionVm[] {
  const actorId=actor.id;
  const strength=abilityModifier(sheet.abilities.str);
  const attacks=weaponAttacksPerAction(sheet);
  const actions:ActionVm[]=sheet.attacks.map((attack)=>{
    const damage=parseAttackDamage(attack.damage);
    const dice=damageFromDiceText(damage.dice,damage.flat);
    const ranged=/보우|석궁|bow|crossbow|투창|다트|sling|슬링/i.test(attack.name);
    return {
      id:attack.id,actorId,name:attack.name,category:"weapon",target:"enemy",economy:"행동",resolutionKind:"attack",
      summary:`${signed(attack.bonus)} · ${damage.dice}${damage.flat?signed(damage.flat):""} ${damage.type}${attacks>1?` · 공격 ${attacks}회`:""}`,
      available:true,eligibleTargetIds:[],attackBonus:attack.bonus,attacksPerAction:attacks,
      damage:[{type:damage.type,dice:damage.dice,flat:damage.flat,average:diceAverage(dice.count,dice.sides,dice.flat)}],
      runtimeAttack:{sourceKind:"weapon",rangeFeet:ranged?80:5,diceSides:dice.sides,diceCount:dice.count,damageSource:`character:${actorId}:${attack.id}`},
      details:[detail("명중",signed(attack.bonus)),detail("피해",`${damage.dice}${damage.flat?` ${signed(damage.flat)}`:""} ${damage.type}`),detail("비용",attacks>1?`공격 행동 1 · 최대 ${attacks}회 공격`:"행동 1")],
    };
  });
  const unarmed=Math.max(0,1+strength);
  actions.push({
    id:"action.unarmed-strike.damage",actorId,name:"맨손 타격",category:"weapon",target:"enemy",economy:"행동",resolutionKind:"attack",
    summary:`${signed(sheet.proficiencyBonus+strength)} · ${unarmed} 타격`,available:true,eligibleTargetIds:[],attackBonus:sheet.proficiencyBonus+strength,attacksPerAction:attacks,
    damage:[{type:"타격",dice:"0d2",flat:unarmed,average:unarmed}],
    runtimeAttack:{sourceKind:"unarmed",rangeFeet:5,diceSides:2,diceCount:0,damageSource:`character:${actorId}:unarmed-strike`},
    details:[detail("명중",signed(sheet.proficiencyBonus+strength)),detail("피해",`${unarmed} 타격`),detail("출처",`${STANDARD_SOURCE} · Unarmed Strike`)],
  });
  actions.push(...standardActions(actor,sheet.speed));
  for(const key of ABILITY_KEYS) {
    const label=abilityLabelKo(key);
    actions.push({id:`action.ability.${key}`,actorId,name:`${label} 판정`,category:"basic",target:"none",economy:"없음",resolutionKind:"ability-check",summary:`d20 ${signed(actorAbilityModifier(actor,key))}`,available:true,eligibleTargetIds:[],checkBonus:actorAbilityModifier(actor,key),details:[detail("능력",label),detail("수정치",signed(actorAbilityModifier(actor,key)))]});
  }
  const secondWind=sheet.resources.find((resource)=>resource.id==="resource.second-wind"||/세컨드 윈드|재기의 바람/.test(resource.label));
  if(secondWind) actions.push({
    id:"action.second-wind",actorId,name:secondWind.label,category:"basic",target:"self",economy:"추가 행동",resolutionKind:"healing",
    summary:`1d10 + ${sheet.level} 회복 · ${secondWind.current}/${secondWind.max}`,available:true,eligibleTargetIds:[actorId],
    healing:{dice:"1d10",flat:sheet.level,average:5+sheet.level},resourceCost:{resourceId:secondWind.id,amount:1},
    details:[detail("대상","자신"),detail("회복",`1d10 + ${sheet.level}`),detail("자원",`${secondWind.label} 1회`,secondWind.source)],
  });
  actions.push({id:"action.death-save",actorId,name:"죽음 내성 굴림",category:"basic",target:"none",economy:"없음",resolutionKind:"no-roll",summary:"d20 · 10 이상 성공",available:true,eligibleTargetIds:[],details:[detail("성공","3회 성공 시 안정"),detail("실패","3회 실패 시 사망"),detail("출처",`${STANDARD_SOURCE} · Death Saving Throws`)]});
  return actions;
}

function monsterAttackAction(actor:Actor,spec:CombatantRuntimeAttackVm):ActionVm {
  const dice=damageFromDiceText(spec.damage.dice,spec.damage.flat);
  return {
    id:spec.id,actorId:actor.id,name:spec.name,category:spec.category,target:"enemy",economy:spec.economy??"행동",resolutionKind:"attack",
    summary:`${signed(spec.attackBonus)} · ${spec.damage.dice}${spec.damage.flat?signed(spec.damage.flat):""} ${spec.damage.type}${spec.attacksPerAction&&spec.attacksPerAction>1?` · 공격 ${spec.attacksPerAction}회`:""}`,
    available:true,eligibleTargetIds:[],attackBonus:spec.attackBonus,attacksPerAction:spec.attacksPerAction,
    damage:[{type:spec.damage.type,dice:spec.damage.dice,flat:spec.damage.flat,average:diceAverage(dice.count,dice.sides,dice.flat)},...(spec.extraDamage??[]).map((extra)=>{const parsed=damageFromDiceText(extra.dice,extra.flat);return {type:extra.type,dice:extra.dice,flat:extra.flat,average:diceAverage(parsed.count,parsed.sides,parsed.flat)};})],
    runtimeAttack:{sourceKind:spec.sourceKind,rangeFeet:spec.rangeFeet,diceSides:dice.sides,diceCount:dice.count,damageSource:`monster:${actor.id}:${spec.id}`},
    details:[detail("명중",signed(spec.attackBonus)),detail("사거리",`${spec.rangeFeet}피트`),...(spec.hitText?[detail("명중 시",spec.hitText)]:[])],
  };
}

function monsterSaveAction(actor:Actor,spec:CombatantRuntimeSaveActionVm):ActionVm {
  return {
    id:spec.id,actorId:actor.id,name:spec.name,category:"basic",target:spec.maxTargets>1?"multi-enemy":"enemy",economy:spec.economy??"행동",resolutionKind:"saving-throw",
    summary:`${abilityLabelKo(spec.saveAbility)} 내성 DC ${spec.saveDc}${spec.damage[0]?` · ${spec.damage.map((entry)=>`${entry.dice}${entry.flat?signed(entry.flat):""} ${entry.type}`).join(" + ")}`:""}`,
    available:true,eligibleTargetIds:[],saveDc:spec.saveDc,saveAbility:abilityLabelKo(spec.saveAbility),maxTargets:spec.maxTargets,saveHalf:spec.successDamage==="half",
    damage:spec.damage.map((entry)=>{const parsed=damageFromDiceText(entry.dice,entry.flat);return {type:entry.type,dice:entry.dice,flat:entry.flat,average:diceAverage(parsed.count,parsed.sides,parsed.flat)};}),
    details:[detail("내성",`${abilityLabelKo(spec.saveAbility)} DC ${spec.saveDc}`),...(spec.areaText?[detail("범위",spec.areaText)]:[]),...(spec.failText?[detail("실패",spec.failText)]:[]),...(spec.successText?[detail("성공",spec.successText)]:[])],
  };
}

function monsterTextAction(actor:Actor,spec:CombatantRuntimeTextActionVm):ActionVm {
  return {id:spec.id,actorId:actor.id,name:spec.name,category:"basic",target:"none",economy:spec.economy,resolutionKind:"no-roll",summary:spec.text.slice(0,80),available:true,eligibleTargetIds:[],completionOutcome:spec.name,details:[detail("설명",spec.text)]};
}

function monsterActions(actor:Actor,definition:CombatantDefinitionVm):ActionVm[] {
  return [
    ...(definition.runtimeActions??[]).map((spec)=>monsterAttackAction(actor,spec)),
    ...(definition.runtimeSaveActions??[]).map((spec)=>monsterSaveAction(actor,spec)),
    ...(definition.runtimeTextActions??[]).map((spec)=>monsterTextAction(actor,spec)),
    ...standardActions(actor,definition.runtimeStats?.speed??30).filter((action)=>action.id!=="action.standard.help"),
  ];
}

/** The raw actions an actor's source offers, before availability and targets are judged (see availability.ts). */
export function actionsFor(actor:Actor):ActionVm[] {
  return actor.source.kind==="character"?characterActions(actor,actor.source.sheet):monsterActions(actor,actor.source.definition);
}

export function sideOf(state:TableState,actorId:string):Side|undefined { return state.actors[actorId]?.side; }
