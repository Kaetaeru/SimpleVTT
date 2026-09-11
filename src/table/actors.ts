import type { CombatantRuntimeState } from "../domain/combatState";
import { beginTurn } from "../domain/turnEconomy";
import type { AbilityKey, ActionDetailVm, ActionVm, CharacterSheet, CombatantDefinitionVm, ItemInstanceVm } from "../app/contracts";
import { weaponHasProperty, weaponRuleById, type WeaponRuleDefinition } from "../domain/weaponRuleCatalog";
import { hitDicePools, spellActionsFor, spellSlotPools, type SpellSheet } from "./spells";
import type { CombatantRuntimeAttackVm, CombatantRuntimeSaveActionVm, CombatantRuntimeTextActionVm } from "../app/combatantRuntimeContracts";
import { abilityLabelKo, conditionLabelKo, srdMonsterById, srdMonsterCombatantDefinition } from "../app/srdMonsterCatalog";
import type { ConditionId } from "../domain/conditions";
import type { ActorSpec } from "./commands";
import { diceAverage, parseDiceNotation } from "./dice";
import type { Actor, Side, TableState } from "./state";

declare module "../app/contracts" {
  interface ActionVm {
    /** The sheet item this weapon attack swings; the tile is unavailable while the item is not in hand. */
    tableWeaponItemId?:string;
    /** A thrown attack: the item leaves the hand for the floor when it flies (2024: drawn as part of the attack). */
    tableThrow?:{itemId?:string;recoverable:boolean};
    /** Improvised weapon (1d4, 20/60 ft thrown): a chair, a bottle, a shield swung — any object the actor names. */
    tableImprovised?:boolean;
    /** Unarmed Strike options (2024): the target saves against 8 + PB + STR instead of an attack roll. */
    tableUnarmedOption?:"grapple"|"shove-prone"|"shove-push";
    /** Escape a grapple: STR (Athletics) or DEX (Acrobatics), the better one, against the grappler's DC. */
    tableEscape?:boolean;
    /** Let go of a grappled creature (free). */
    tableRelease?:boolean;
    /** Hide: on success the actor gets the Invisible condition until it attacks, casts with a verbal component, or is found. */
    tableHide?:boolean;
    /** Stabilize: WIS (Medicine) DC 10 on a creature at 0 HP. */
    tableStabilize?:boolean;
    /** Search / Study / Influence: a check the DM reads; no DC of its own. */
    tableOpenCheck?:"search"|"study"|"influence";
    /** Drink (bonus action) or administer (action) a potion; the item's quantity drops by one. */
    tablePotion?:{itemId:string;administer:boolean};
  }
}

const SIZE_ORDER=["tiny","small","medium","large","huge","gargantuan"];
const SIZE_FROM_KO:Record<string,string>={"초소형":"tiny","소형":"small","중형":"medium","대형":"large","거대형":"huge","초거대형":"gargantuan"};

/** Creature size rank (0 tiny … 5 gargantuan); characters count as medium unless the sheet says otherwise. */
export function actorSizeRank(actor:Actor):number {
  const raw=actor.source.kind==="monster"?(srdMonsterById(actor.source.definitionId)?.size??"medium"):((actor.source.sheet as {size?:string}).size??"medium");
  const key=SIZE_FROM_KO[raw]??raw.toLowerCase();
  const index=SIZE_ORDER.indexOf(key);
  return index<0?2:index;
}

/** "운동 +7" on the sheet, else the ability modifier alone. */
export function characterSkillBonus(sheet:CharacterSheet,skill:string,ability:AbilityKey):number {
  const entry=sheet.skills.find((item)=>item===skill||item.startsWith(`${skill} `)||item.startsWith(`${skill}+`));
  const explicit=entry?/([+-]\d+)/.exec(entry):null;
  if(explicit) return Number(explicit[1]);
  return abilityModifier(sheet.abilities[ability])+(entry?sheet.proficiencyBonus:0);
}

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
  const spellSheet=sheet as SpellSheet;
  const ownResources=sheet.resources.map((resource)=>({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:/짧은 휴식|short rest/i.test(resource.source)?{shortRest:"all" as const,longRest:"all" as const}:{longRest:"all" as const}}));
  const slotIds=new Set(ownResources.map((resource)=>resource.id));
  return {
    id:sheet.id,
    baseSpeed:speed,
    life:{hp:{current:sheet.hp,maximum:sheet.maxHp,temporary:sheet.tempHp??0},deathSaves:{successes:0,failures:0},stable:false,unconscious:sheet.hp<=0,dead:false},
    economy:beginTurn(speed),
    resources:[...ownResources,...spellSlotPools(spellSheet).filter((pool)=>!slotIds.has(pool.id))],
    hitDice:hitDicePools(spellSheet),
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
      controllerPeer:spec.controllerPeer,badges:[],initiative:0,
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
    badges:[],initiative:0,
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

const damage_text=(attack:CharacterSheet["attacks"][number])=>attack.damage;

/** The catalog weapon behind a sheet attack: linked by the item's granted action id, else by matching names. */
export function characterWeaponFor(sheet:CharacterSheet,attack:CharacterSheet["attacks"][number]):{item?:ItemInstanceVm;rule?:WeaponRuleDefinition} {
  const linked=sheet.items.find((item)=>(item.grantedActionIds??[]).includes(attack.id));
  const byName=linked??sheet.items.find((item)=>item.name===attack.name||weaponRuleById(item.definitionId)?.name===attack.name);
  const rule=byName?weaponRuleById(byName.definitionId):undefined;
  return {item:byName,rule};
}

function thrownRange(rule:WeaponRuleDefinition):{normal:number;long:number}|undefined {
  const property=rule.properties.find((entry)=>entry.startsWith("thrown:"));
  const match=property?/^thrown:(\d+)\/(\d+)$/.exec(property):null;
  return match?{normal:Number(match[1]),long:Number(match[2])}:undefined;
}

function ammunitionRange(rule:WeaponRuleDefinition):{normal:number;long:number}|undefined {
  const property=rule.properties.find((entry)=>entry.startsWith("ammunition:"));
  const match=property?/^ammunition:(\d+)\/(\d+)$/.exec(property):null;
  return match?{normal:Number(match[1]),long:Number(match[2])}:undefined;
}

/** The weapon behind an attack left this character's bag (dropped, thrown, handed over): it lies on the floor or in another bag. */
function weaponElsewhere(state:TableState|undefined,actorId:string,attackId:string):ItemInstanceVm|undefined {
  if(!state) return undefined;
  const onFloor=state.floor.find((entry)=>(entry.item.grantedActionIds??[]).includes(attackId)&&entry.droppedBy===actorId);
  if(onFloor) return onFloor.item;
  for(const other of Object.values(state.actors)) {
    if(other.id===actorId||other.source.kind!=="character") continue;
    const held=other.source.sheet.items.find((item)=>(item.grantedActionIds??[]).includes(attackId));
    if(held) return held;
  }
  return undefined;
}

function characterActions(actor:Actor,sheet:CharacterSheet,state?:TableState):ActionVm[] {
  const actorId=actor.id;
  const strength=abilityModifier(sheet.abilities.str);
  const attacks=weaponAttacksPerAction(sheet);
  const actions:ActionVm[]=[];
  for(const attack of sheet.attacks) {
    const damage=parseAttackDamage(damage_text(attack));
    const dice=damageFromDiceText(damage.dice,damage.flat);
    const found=characterWeaponFor(sheet,attack);
    const elsewhere=found.item?undefined:weaponElsewhere(state,actorId,attack.id);
    const rule=found.rule??(elsewhere?weaponRuleById(elsewhere.definitionId):undefined);
    const item=found.item??(elsewhere?{id:`missing:${attack.id}`}:undefined);
    // Melee versus ranged is read from the weapon's own rules; a sheet without a linked item falls back to its wording.
    const ranged=rule?rule.mode==="ranged":/보우|석궁|bow|crossbow|투창|다트|sling|슬링/i.test(attack.name);
    const thrown=rule?thrownRange(rule):undefined;
    const reach=rule?weaponHasProperty(rule,"reach"):false;
    const rangeFeet=ranged?(rule?ammunitionRange(rule)?.normal??80:80):reach?10:5;
    const attackMode=ranged?"ranged":thrown?"melee-or-ranged":"melee";
    const base:ActionVm={
      id:attack.id,actorId,name:attack.name,category:"weapon",target:"any",economy:"행동",resolutionKind:"attack",
      summary:`${signed(attack.bonus)} · ${damage.dice}${damage.flat?signed(damage.flat):""} ${damage.type}${attacks>1?` · 공격 ${attacks}회`:""}`,
      available:true,eligibleTargetIds:[],attackBonus:attack.bonus,attacksPerAction:attacks,
      damage:[{type:damage.type,dice:damage.dice,flat:damage.flat,average:diceAverage(dice.count,dice.sides,dice.flat)}],
      runtimeAttack:{sourceKind:"weapon",rangeFeet,attackMode,diceSides:dice.sides,diceCount:dice.count,damageSource:`character:${actorId}:${attack.id}`},
      ...(item?{tableWeaponItemId:item.id}:{}),
      details:[detail("명중",signed(attack.bonus)),detail("피해",`${damage.dice}${damage.flat?` ${signed(damage.flat)}`:""} ${damage.type}`),detail("사거리",ranged?`${rangeFeet}피트`:reach?"10피트 (긴 무기)":"5피트"),detail("비용",attacks>1?`공격 행동 1 · 최대 ${attacks}회 공격`:"행동 1")],
    };
    actions.push(base);
    if(thrown&&!ranged) actions.push({
      ...base,id:`${attack.id}.throw`,name:`${attack.name} 던지기`,
      summary:`${signed(attack.bonus)} · ${damage.dice}${damage.flat?signed(damage.flat):""} ${damage.type} · 투척 ${thrown.normal}/${thrown.long}피트`,
      runtimeAttack:{...base.runtimeAttack!,rangeFeet:thrown.normal,attackMode:"ranged"},
      tableThrow:{itemId:item?.id,recoverable:true},
      details:[detail("명중",signed(attack.bonus)),detail("피해",`${damage.dice}${damage.flat?` ${signed(damage.flat)}`:""} ${damage.type}`),detail("사거리",`${thrown.normal}/${thrown.long}피트 (투척)`),detail("결과","던진 무기는 바닥에 떨어져 회수할 수 있습니다"),detail("출처",`${STANDARD_SOURCE} · Thrown`)],
    });
  }
  const unarmed=Math.max(0,1+strength);
  actions.push({
    id:"action.unarmed-strike.damage",actorId,name:"맨손 타격",category:"weapon",target:"any",economy:"행동",resolutionKind:"attack",
    summary:`${signed(sheet.proficiencyBonus+strength)} · ${unarmed} 타격`,available:true,eligibleTargetIds:[],attackBonus:sheet.proficiencyBonus+strength,attacksPerAction:attacks,
    damage:[{type:"타격",dice:"0d2",flat:unarmed,average:unarmed}],
    runtimeAttack:{sourceKind:"unarmed",rangeFeet:5,attackMode:"melee",diceSides:2,diceCount:0,damageSource:`character:${actorId}:unarmed-strike`},
    details:[detail("명중",signed(sheet.proficiencyBonus+strength)),detail("피해",`${unarmed} 타격`),detail("출처",`${STANDARD_SOURCE} · Unarmed Strike`)],
  });
  // Improvised weapons (2024): 1d4, no proficiency unless it resembles a weapon; thrown 20/60. Any object the actor names.
  const improvised=(id:string,name:string,throwing:boolean):ActionVm=>({
    id,actorId,name,category:"weapon",target:"any",economy:"행동",resolutionKind:"attack",
    summary:`${signed(strength)} · 1d4${signed(strength)} 타격${throwing?" · 투척 20/60피트":""}`,available:true,eligibleTargetIds:[],attackBonus:strength,attacksPerAction:attacks,
    damage:[{type:"타격",dice:"1d4",flat:strength,average:diceAverage(1,4,strength)}],
    runtimeAttack:{sourceKind:"weapon",rangeFeet:throwing?20:5,attackMode:throwing?"ranged":"melee",diceSides:4,diceCount:1,damageSource:`character:${actorId}:${id}`},
    tableImprovised:true,...(throwing?{tableThrow:{recoverable:true}}:{}),
    details:[detail("피해","1d4 (유형은 DM이 정합니다)"),detail("숙련","없음 (무기를 닮은 물건은 DM 재량)"),detail("사거리",throwing?"20/60피트":"5피트"),detail("출처",`${STANDARD_SOURCE} · Improvised Weapons`)],
  });
  actions.push(improvised("action.improvised.melee","즉흥 무기",false),improvised("action.improvised.throw","즉흥 무기 던지기",true));
  // Unarmed Strike options (2024): grapple and shove replace one attack of the Attack action; the target saves.
  const unarmedDc=8+sheet.proficiencyBonus+strength;
  const option=(id:string,name:string,kind:"grapple"|"shove-prone"|"shove-push",summary:string,extra:ActionDetailVm[]):ActionVm=>({
    id,actorId,name,category:"basic",target:"any",economy:"행동",resolutionKind:"saving-throw",summary,available:true,eligibleTargetIds:[],attacksPerAction:attacks,
    saveDc:unarmedDc,saveAbility:"근력 또는 민첩",tableUnarmedOption:kind,
    details:[detail("내성",`근력 또는 민첩 (높은 쪽) DC ${unarmedDc}`),...extra,detail("비용",attacks>1?`공격 행동의 공격 1회분`:"행동 1"),detail("출처",`${STANDARD_SOURCE} · Unarmed Strike`)],
  });
  actions.push(
    option("action.unarmed-strike.grapple","붙잡기","grapple",`대상 내성 DC ${unarmedDc} · 실패 시 붙잡힘 (속도 0)`,[detail("조건","빈손 1개 · 대상은 나보다 최대 한 단계 큰 크기"),detail("해제","붙잡은 쪽이 놓아주거나 행동불능이 될 때, 대상이 탈출에 성공할 때")]),
    option("action.unarmed-strike.shove-prone","넘어뜨리기","shove-prone",`대상 내성 DC ${unarmedDc} · 실패 시 넘어짐`,[detail("조건","대상은 나보다 최대 한 단계 큰 크기")]),
    option("action.unarmed-strike.shove-push","밀어내기","shove-push",`대상 내성 DC ${unarmedDc} · 실패 시 5피트 밀려남 (교전 해제)`,[detail("조건","대상은 나보다 최대 한 단계 큰 크기")]),
  );
  actions.push({id:"action.escape-grapple",actorId,name:"붙잡힘 탈출",category:"basic",target:"self",economy:"행동",resolutionKind:"ability-check",summary:`근력(운동) ${signed(characterSkillBonus(sheet,"운동","str"))} 또는 민첩(곡예) ${signed(characterSkillBonus(sheet,"곡예","dex"))} vs 붙잡은 쪽의 DC`,available:true,eligibleTargetIds:[actorId],checkBonus:Math.max(characterSkillBonus(sheet,"운동","str"),characterSkillBonus(sheet,"곡예","dex")),tableEscape:true,details:[detail("판정","운동 또는 곡예 (높은 쪽)"),detail("비용","행동 1"),detail("출처",`${STANDARD_SOURCE} · Grappled`)]});
  actions.push({id:"action.release-grapple",actorId,name:"놓아주기",category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:"붙잡은 대상을 놓아준다 (비용 없음)",available:true,eligibleTargetIds:[actorId],tableRelease:true,details:[detail("비용","없음")]});
  actions.push(...standardActions(actor,sheet.speed));
  actions.push(...spellActionsFor(actor,sheet as SpellSheet));
  for(const item of sheet.items) {
    const potion=/potion-of-healing/i.test(item.definitionId)||/치유 물약|potion of healing/i.test(`${item.name} ${item.nameEn??""}`);
    if(!potion) continue;
    const base={category:"basic" as const,resolutionKind:"healing" as const,healing:{dice:"2d4",flat:2,average:7},itemCost:{itemId:item.id,quantity:1},available:item.quantity>0,...(item.quantity>0?{}:{disabledReason:"남은 수량이 없습니다."})};
    actions.push({id:`item.${item.id}.drink`,actorId,name:`${item.name} 마시기`,target:"self",economy:"추가 행동",summary:`2d4 + 2 회복 · ${item.quantity}개 · 추가 행동`,eligibleTargetIds:[actorId],tablePotion:{itemId:item.id,administer:false},details:[detail("대상","자신"),detail("회복","2d4 + 2"),detail("비용","추가 행동 · 물약 1개"),detail("출처",`${STANDARD_SOURCE} · Potion of Healing`)],...base});
    actions.push({id:`item.${item.id}.administer`,actorId,name:`${item.name} 먹이기`,target:"any",economy:"행동",summary:`다른 이에게 2d4 + 2 회복 · 행동`,eligibleTargetIds:[],tablePotion:{itemId:item.id,administer:true},details:[detail("대상","다른 크리처 1명"),detail("회복","2d4 + 2"),detail("비용","행동 · 물약 1개")],...base});
  }
  actions.push(...tableChecks(actor,(skill,ability)=>characterSkillBonus(sheet,skill,ability)));
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
    runtimeAttack:{sourceKind:spec.sourceKind,rangeFeet:spec.rangeFeet,...(spec.attackMode?{attackMode:spec.attackMode}:{}),diceSides:dice.sides,diceCount:dice.count,damageSource:`monster:${actor.id}:${spec.id}`},
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

/** Hide, Stabilize, Search, Study and Influence (2024 action list) as checks; the DM reads the open ones. */
function tableChecks(actor:Actor,bonus:(skill:string,ability:AbilityKey)=>number):ActionVm[] {
  const actorId=actor.id;
  const check=(id:string,name:string,skill:string,ability:AbilityKey,extra:Partial<ActionVm>,details:ActionDetailVm[]):ActionVm=>({id,actorId,name,category:"basic",target:"none",economy:"행동",resolutionKind:"ability-check",summary:`${abilityLabelKo(ability)}(${skill}) ${signed(bonus(skill,ability))}`,available:true,eligibleTargetIds:[],checkBonus:bonus(skill,ability),details:[...details,detail("비용","행동 1")],...extra});
  return [
    check("action.standard.hide","숨기","은신","dex",{tableHide:true},[detail("판정","민첩(은신) DC 15"),detail("성공","숨음 (투명 조건) · 공격하거나 음성 주문을 쓰면 해제"),detail("출처",`${STANDARD_SOURCE} · Hide`)]),
    check("action.standard.stabilize","안정화","의학","wis",{tableStabilize:true,target:"any"},[detail("판정","지혜(의학) DC 10"),detail("대상","HP 0의 불안정한 크리처"),detail("출처",`${STANDARD_SOURCE} · Stabilize`)]),
    check("action.standard.search.perception","찾기 · 지각","지각","wis",{tableOpenCheck:"search"},[detail("판정","지혜(지각)"),detail("결과","DM이 읽고 판단합니다")]),
    check("action.standard.search.insight","찾기 · 통찰","통찰","wis",{tableOpenCheck:"search"},[detail("판정","지혜(통찰)")]),
    check("action.standard.search.survival","찾기 · 생존","생존","wis",{tableOpenCheck:"search"},[detail("판정","지혜(생존)")]),
    check("action.standard.study.investigation","조사 · 조사","조사","int",{tableOpenCheck:"study"},[detail("판정","지능(조사)")]),
    check("action.standard.study.arcana","조사 · 비전","비전","int",{tableOpenCheck:"study"},[detail("판정","지능(비전)")]),
    check("action.standard.study.history","조사 · 역사","역사","int",{tableOpenCheck:"study"},[detail("판정","지능(역사)")]),
    check("action.standard.study.nature","조사 · 자연","자연","int",{tableOpenCheck:"study"},[detail("판정","지능(자연)")]),
    check("action.standard.study.religion","조사 · 종교","종교","int",{tableOpenCheck:"study"},[detail("판정","지능(종교)")]),
    check("action.standard.influence.persuasion","영향 · 설득","설득","cha",{tableOpenCheck:"influence"},[detail("판정","매력(설득)"),detail("결과","DM이 태도와 DC를 정합니다")]),
    check("action.standard.influence.deception","영향 · 기만","기만","cha",{tableOpenCheck:"influence"},[detail("판정","매력(기만)")]),
    check("action.standard.influence.intimidation","영향 · 위협","위협","cha",{tableOpenCheck:"influence"},[detail("판정","매력(위협)")]),
    check("action.standard.influence.performance","영향 · 공연","공연","cha",{tableOpenCheck:"influence"},[detail("판정","매력(공연)")]),
    check("action.standard.influence.animal-handling","영향 · 동물 조련","동물 조련","wis",{tableOpenCheck:"influence"},[detail("판정","지혜(동물 조련)")]),
  ];
}

function monsterActions(actor:Actor,definition:CombatantDefinitionVm):ActionVm[] {
  return [
    ...(definition.runtimeActions??[]).map((spec)=>monsterAttackAction(actor,spec)),
    ...(definition.runtimeSaveActions??[]).map((spec)=>monsterSaveAction(actor,spec)),
    ...(definition.runtimeTextActions??[]).map((spec)=>monsterTextAction(actor,spec)),
    ...standardActions(actor,definition.runtimeStats?.speed??30).filter((action)=>action.id!=="action.standard.help"),
    {id:"action.escape-grapple",actorId:actor.id,name:"붙잡힘 탈출",category:"basic",target:"self",economy:"행동",resolutionKind:"ability-check",summary:"근력 또는 민첩 (높은 쪽) vs 붙잡은 쪽의 DC",available:true,eligibleTargetIds:[actor.id],checkBonus:Math.max(actorAbilityModifier(actor,"str"),actorAbilityModifier(actor,"dex")),tableEscape:true,details:[detail("판정","근력 또는 민첩 (높은 쪽)"),detail("비용","행동 1")]},
    {id:"action.release-grapple",actorId:actor.id,name:"놓아주기",category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:"붙잡은 대상을 놓아준다 (비용 없음)",available:true,eligibleTargetIds:[actor.id],tableRelease:true,details:[detail("비용","없음")]},
    ...tableChecks(actor,(_skill,ability)=>actorAbilityModifier(actor,ability)),
  ];
}

/** The raw actions an actor's source offers, before availability and targets are judged (see availability.ts). */
export function actionsFor(actor:Actor,state?:TableState):ActionVm[] {
  return actor.source.kind==="character"?characterActions(actor,actor.source.sheet,state):monsterActions(actor,actor.source.definition);
}

export function sideOf(state:TableState,actorId:string):Side|undefined { return state.actors[actorId]?.side; }
