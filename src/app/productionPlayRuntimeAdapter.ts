import "./combatantRuntimeContracts";
import type { AbilityKey, ActionVm, AppRole, AppSnapshot, CharacterSheet, CharacterSummary, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { isEphemeralSessionProjectionCharacter } from "./characterSessionProjectionRegistry";
import { readyActionConfigurationFor, READY_MOVEMENT_ACTION_ID } from "./standardActionReadyState";
import { installProductionCharacterActionProjector } from "./productionCharacterActionProjectionPort";
import { spellLevelLabel, spellPresentationById } from "./spellPresentation";
import { spellMechanicById } from "../domain/spellMechanics";
import { spellMultiAttackCount } from "../domain/spellcasting";
import { isExecutableSpellRuntimeSupport } from "./spellcastingRuntimeContracts";
import { selectedCombatSpellSlot } from "./spellcastingRuntimeSelection";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID, CLERIC_ID, FIGHTER_ACTION_SURGE_RESOURCE_ID, FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID, FIGHTER_ID, PALADIN_CHANNEL_DIVINITY_RESOURCE_ID, PALADIN_ID, PALADIN_LAY_ON_HANDS_RESOURCE_ID } from "../domain/coreClassResources";
import { BARDIC_INSPIRATION_RESOURCE_ID, BARD_ID, bardicInspirationDieSides } from "../domain/bardicInspiration";
import { clericDivineSparkDiceCount } from "../domain/clericDivineSpark";
import { searUndeadDiceCount } from "../domain/clericTurnUndead";
import { LAY_ON_HANDS_ACTION_ID } from "./paladinLayOnHandsRuntimeContracts";
import { abjureFoesMaximumTargets } from "../domain/paladinAbjureFoes";

const ABILITY_LABEL:Record<AbilityKey,string>={str:"근력",dex:"민첩",con:"건강",int:"지능",wis:"지혜",cha:"매력"};
const ABILITIES:AbilityKey[]=["str","dex","con","int","wis","cha"];
const SKILLS:Array<{id:string;name:string;ability:AbilityKey}>=[
  {id:"athletics",name:"운동",ability:"str"},
  {id:"acrobatics",name:"곡예",ability:"dex"},
  {id:"sleight-of-hand",name:"손재주",ability:"dex"},
  {id:"stealth",name:"은신",ability:"dex"},
  {id:"arcana",name:"비전",ability:"int"},
  {id:"history",name:"역사",ability:"int"},
  {id:"investigation",name:"조사",ability:"int"},
  {id:"nature",name:"자연",ability:"int"},
  {id:"religion",name:"종교",ability:"int"},
  {id:"animal-handling",name:"동물 조련",ability:"wis"},
  {id:"insight",name:"통찰",ability:"wis"},
  {id:"medicine",name:"의학",ability:"wis"},
  {id:"perception",name:"지각",ability:"wis"},
  {id:"survival",name:"생존",ability:"wis"},
  {id:"deception",name:"기만",ability:"cha"},
  {id:"intimidation",name:"위협",ability:"cha"},
  {id:"performance",name:"공연",ability:"cha"},
  {id:"persuasion",name:"설득",ability:"cha"},
];

type ExtendedCharacter=CharacterSheet&{
  preparedSpells?:string[];
  cantrips?:string[];
  spellbookSpells?:string[];
};

type Internal={
  role:AppRole;
  connectionState:AppSnapshot["connectionState"];
  sessionMode:AppSnapshot["sessionMode"];
  session:AppSnapshot["session"];
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  activity:AppSnapshot["activity"];
  getSnapshot():Promise<AppSnapshot>;
};

declare module "./mockAdapter" {
  interface MockAdapter {
    selectProductionCharacter(characterId:string):Promise<AppSnapshot>;
    startProductionLocalPlay(role?:AppRole):Promise<AppSnapshot>;
  }
}

const cp=<T,>(value:T):T=>structuredClone(value);
const mod=(score:number)=>Math.floor((score-10)/2);
const signed=(value:number)=>value>=0?`+${value}`:`${value}`;
const detail=(label:string,value:string,source?:string)=>({label,value,...(source?{source}:{})});
const localProjectionIdByAdapter=new WeakMap<MockAdapter,string>();

function isSheet(value:CharacterSummary):value is CharacterSheet {
  const candidate=value as Partial<CharacterSheet>;
  return Boolean(candidate.abilities&&candidate.items&&candidate.resources&&candidate.attacks&&typeof candidate.proficiencyBonus==="number");
}

function hasSkill(character:CharacterSheet,name:string) {
  return character.skills.some((entry)=>entry===name||entry.startsWith(`${name} `)||entry.startsWith(`${name}+`));
}

function skillBonus(character:CharacterSheet,name:string,ability:AbilityKey) {
  return mod(character.abilities[ability])+(hasSkill(character,name)?character.proficiencyBonus:0);
}

function parseDamage(raw:string) {
  const match=raw.match(/(\d+)d(\d+)\s*(?:\+\s*(-?\d+))?\s*([^\d+]*)/i);
  if (!match) return { dice:"1d4",count:1,sides:4,flat:0,type:"타격",average:3 };
  const count=Number(match[1]);
  const sides=Number(match[2]);
  const flat=Number(match[3]??0);
  const type=(match[4]??"").trim()||"타격";
  return { dice:`${count}d${sides}`,count,sides,flat,type,average:Math.floor(count*(sides+1)/2)+flat };
}

function attackRange(name:string) {
  return /bow|crossbow|활|석궁|sling|슬링/i.test(name)?80:5;
}

function weaponAttacksPerAction(character:CharacterSheet) {
  const level=(classId:string)=>character.classLevels?.find((entry)=>entry.classId===classId)?.level ?? 0;
  const fighter=level(FIGHTER_ID);
  let attacks=fighter>=20?4:fighter>=11?3:fighter>=5?2:1;
  if (["barbarian","monk","paladin","ranger"].some((name)=>level(`dnd.srd521.class.${name}`)>=5)) attacks=Math.max(attacks,2);
  const features=character.features.join(" ").toLowerCase();
  if (/thirsting blade|갈증의 칼날/.test(features)) attacks=Math.max(attacks,2);
  if (/devouring blade|포식하는 칼날/.test(features)) attacks=Math.max(attacks,3);
  return attacks;
}

function attackActions(character:CharacterSheet):ActionVm[] {
  const attacksPerAction=weaponAttacksPerAction(character);
  return character.attacks.map((attack,index)=>{
    const damage=parseDamage(attack.damage);
    const id=attack.id?.startsWith("action.")?attack.id:`action.character-attack.${index}`;
    return {
      id,
      actorId:character.id,
      name:attack.name,
      category:"weapon",
      target:"enemy",
      economy:"행동",
      resolutionKind:"attack",
      summary:`${signed(attack.bonus)} · ${damage.dice}${damage.flat?signed(damage.flat):""} ${damage.type}${attacksPerAction>1?` · 공격 ${attacksPerAction}회`:""}`,
      available:true,
      eligibleTargetIds:[],
      attackBonus:attack.bonus,
      damage:[{type:damage.type,dice:damage.dice,flat:damage.flat,average:damage.average}],
      attacksPerAction,
      runtimeAttack:{
        sourceKind:"weapon",
        rangeFeet:attackRange(attack.name),
        diceSides:damage.sides,
        diceCount:damage.count,
        damageSource:`character:${character.id}:attack:${attack.name}`,
      },
      details:[
        detail("대상","적 1명"),
        detail("명중",signed(attack.bonus),"Character attack projection"),
        detail("피해",attack.damage,"Character source/runtime"),
        detail("비용",attacksPerAction>1?`공격 행동 1 · 최대 ${attacksPerAction}회 공격`:"행동 1"),
      ],
    } satisfies ActionVm;
  });
}

function skillActions(character:CharacterSheet):ActionVm[] {
  const abilities=ABILITIES.map((ability)=>{
    const bonus=mod(character.abilities[ability]);
    return {
      id:`action.ability.${ability}`,
      actorId:character.id,
      name:`${ABILITY_LABEL[ability]} 판정`,
      category:"basic",
      target:"none",
      economy:"없음",
      resolutionKind:"ability-check",
      summary:signed(bonus),
      available:true,
      eligibleTargetIds:[],
      checkBonus:bonus,
      details:[
        detail("판정",ABILITY_LABEL[ability]),
        detail("능력 수정치",signed(bonus),`${ABILITY_LABEL[ability]} ${character.abilities[ability]}`),
        detail("총 보너스",signed(bonus),"Production Character projection"),
      ],
    } satisfies ActionVm;
  });
  const skills=SKILLS.map((skill)=>{
    const proficient=hasSkill(character,skill.name);
    const abilityBonus=mod(character.abilities[skill.ability]);
    const total=skillBonus(character,skill.name,skill.ability);
    return {
      id:`action.skill.${skill.id}`,
      actorId:character.id,
      name:skill.name,
      category:"basic",
      target:"none",
      economy:"없음",
      resolutionKind:"ability-check",
      summary:`${ABILITY_LABEL[skill.ability]} ${signed(total)}${proficient?" · 숙련":""}`,
      available:true,
      eligibleTargetIds:[],
      checkBonus:total,
      details:[
        detail("판정",`${ABILITY_LABEL[skill.ability]}(${skill.name})`),
        detail("능력 수정치",signed(abilityBonus),`${ABILITY_LABEL[skill.ability]} ${character.abilities[skill.ability]}`),
        detail("숙련",proficient?signed(character.proficiencyBonus):"없음",proficient?"Character skill proficiency":"비숙련"),
        detail("총 보너스",signed(total),"Production Character projection"),
      ],
    } satisfies ActionVm;
  });
  return [...abilities,...skills];
}

function featureActions(character:CharacterSheet):ActionVm[] {
  const standardEffect=(id:string,name:string,target:ActionVm["target"],summary:string,details:ActionVm["details"]):ActionVm=>({id:`action.standard.${id}`,actorId:character.id,name,category:"basic",target,economy:"행동",resolutionKind:"no-roll",summary,available:true,eligibleTargetIds:[],details});
  const standardCheck=(group:string,id:string,name:string,skill:string,ability:AbilityKey):ActionVm=>({id:`action.standard.${group}.${id}`,actorId:character.id,name,category:"basic",target:"none",economy:"행동",resolutionKind:"ability-check",summary:`${ABILITY_LABEL[ability]}(${skill}) ${signed(skillBonus(character,skill,ability))}`,available:true,eligibleTargetIds:[],checkBonus:skillBonus(character,skill,ability),details:[detail("기본 행동",group),detail("판정",`${ABILITY_LABEL[ability]}(${skill})`),detail("비용","행동 1"),detail("출처","SRD 5.2.1 · Action")]});
  const strength=mod(character.abilities.str);
  const unarmedDamage=Math.max(0,1+strength);
  const unarmedSaveDc=8+character.proficiencyBonus+strength;
  const unarmedAttacks=weaponAttacksPerAction(character);
  const actions:ActionVm[]=[{
    id:"action.dash",
    actorId:character.id,
    name:"질주",
    category:"basic",
    target:"self",
    economy:"행동",
    resolutionKind:"no-roll",
    summary:`이동 가능량 +${character.speed}피트`,
    available:true,
    eligibleTargetIds:[],
    details:[detail("효과",`이동 가능량 +${character.speed}피트`),detail("비용","행동 1")],
  },
  {
    id:"action.unarmed-strike.damage",actorId:character.id,name:"맨손 타격 · 피해",category:"weapon",target:"enemy",economy:"행동",resolutionKind:"attack",
    summary:`${signed(character.proficiencyBonus+strength)} · ${unarmedDamage} 타격${unarmedAttacks>1?` · 공격 ${unarmedAttacks}회`:""}`,available:true,eligibleTargetIds:[],
    attackBonus:character.proficiencyBonus+strength,damage:[{type:"타격",dice:"0d2",flat:unarmedDamage,average:unarmedDamage}],attacksPerAction:unarmedAttacks,
    runtimeAttack:{sourceKind:"unarmed",rangeFeet:5,diceSides:2,diceCount:0,damageSource:`character:${character.id}:unarmed-strike`},
    details:[detail("명중",signed(character.proficiencyBonus+strength)),detail("피해",`${unarmedDamage} 타격`),detail("비용",unarmedAttacks>1?`공격 행동 1 · 최대 ${unarmedAttacks}회 공격`:"행동 1"),detail("출처","SRD 5.2.1 · Unarmed Strike")],
  },
  {
    id:"action.unarmed-strike.grapple",actorId:character.id,name:"맨손 타격 · 붙잡기",category:"basic",target:"enemy",economy:"행동",resolutionKind:"saving-throw",
    summary:`근력/민첩 내성 DC ${unarmedSaveDc} · 실패 시 붙잡힘`,available:true,eligibleTargetIds:[],saveDc:unarmedSaveDc,saveAbility:"근력 또는 민첩",attacksPerAction:unarmedAttacks,
    details:[detail("대상 내성","근력 또는 민첩 중 높은 값"),detail("DC",String(unarmedSaveDc)),detail("실패","붙잡힘"),detail("출처","SRD 5.2.1 · Unarmed Strike")],
  },
  {
    id:"action.unarmed-strike.shove-prone",actorId:character.id,name:"맨손 타격 · 넘어뜨리기",category:"basic",target:"enemy",economy:"행동",resolutionKind:"saving-throw",
    summary:`근력/민첩 내성 DC ${unarmedSaveDc} · 실패 시 넘어짐`,available:true,eligibleTargetIds:[],saveDc:unarmedSaveDc,saveAbility:"근력 또는 민첩",attacksPerAction:unarmedAttacks,
    details:[detail("대상 내성","근력 또는 민첩 중 높은 값"),detail("DC",String(unarmedSaveDc)),detail("실패","넘어짐"),detail("공간 모듈","미연결 시 밀어내기 대신 넘어뜨리기만 자동 적용"),detail("출처","SRD 5.2.1 · Unarmed Strike")],
  },
  standardEffect("disengage","이탈","self","이번 턴 이동이 기회 공격을 유발하지 않습니다.",[detail("효과","이번 턴 기회 공격 유발 안 함"),detail("비용","행동 1"),detail("출처","SRD 5.2.1 · Disengage")]),
  standardEffect("dodge","회피","self","다음 턴 시작까지 자신을 향한 공격에 불리, 민첩 내성에 유리.",[detail("효과","공격에 불리 · 민첩 내성에 유리"),detail("종료","자신의 다음 턴 시작"),detail("비용","행동 1"),detail("출처","SRD 5.2.1 · Dodge")]),
  standardEffect("help","도움","ally","아군의 다음 판정 또는 공격을 돕습니다.",[detail("대상","아군 1명"),detail("효과","다음 적격 판정 또는 공격에 유리"),detail("비용","행동 1"),detail("출처","SRD 5.2.1 · Help")]),
  standardCheck("hide","stealth","숨기","은신","dex"),
  ...([{"id":"animal-handling","skill":"동물 조련","ability":"wis"},{"id":"deception","skill":"기만","ability":"cha"},{"id":"intimidation","skill":"위협","ability":"cha"},{"id":"performance","skill":"공연","ability":"cha"},{"id":"persuasion","skill":"설득","ability":"cha"}] as const).map((entry)=>standardCheck("influence",entry.id,`영향 주기 · ${entry.skill}`,entry.skill,entry.ability)),
  standardEffect("ready","준비","self","선언한 트리거에 반응해 행동하거나 이동합니다.",[detail("선언","감지 가능한 트리거와 반응 행동/이동"),detail("비용","행동 1 · 발동 시 반응 1"),detail("출처","SRD 5.2.1 · Ready")]),
  ...([{"id":"insight","skill":"통찰"},{"id":"medicine","skill":"의학"},{"id":"perception","skill":"지각"},{"id":"survival","skill":"생존"}] as const).map((entry)=>standardCheck("search",entry.id,`탐색 · ${entry.skill}`,entry.skill,"wis")),
  ...([{"id":"arcana","skill":"비전"},{"id":"history","skill":"역사"},{"id":"investigation","skill":"조사"},{"id":"nature","skill":"자연"},{"id":"religion","skill":"종교"}] as const).map((entry)=>standardCheck("study",entry.id,`연구 · ${entry.skill}`,entry.skill,"int")),
  standardEffect("utilize","물체 사용","self","비마법 물체를 사용합니다.",[detail("효과","비마법 물체 사용"),detail("비용","행동 1"),detail("출처","SRD 5.2.1 · Utilize")]),
  ];
  const secondWind=character.resources.find((resource)=>/second-wind/i.test(resource.id)||/세컨드 윈드|재기의 바람/.test(resource.label));
  if (secondWind) {
    actions.push({
      id:"action.second-wind",
      actorId:character.id,
      name:secondWind.label,
      category:"basic",
      target:"self",
      economy:"추가 행동",
      resolutionKind:"healing",
      summary:`1d10 + ${character.level} 회복 · ${secondWind.current}/${secondWind.max}`,
      available:secondWind.current>0,
      disabledReason:secondWind.current>0?undefined:"사용 가능 횟수를 모두 소모했습니다.",
      eligibleTargetIds:[],
      healing:{dice:"1d10",flat:character.level,average:Math.floor(11/2)+character.level},
      resourceCost:{resourceId:secondWind.id,amount:1},
      details:[detail("대상","자신"),detail("회복",`1d10 + ${character.level}`),detail("자원",`${secondWind.label} 1회`,secondWind.source)],
    });
  }
  const fighterLevel=character.classLevels?.find((entry)=>entry.classId===FIGHTER_ID)?.level ?? 0;
  const actionSurge=character.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID);
  const actionSurgeGate=character.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID);
  if (fighterLevel>=2&&actionSurge&&actionSurgeGate) {
    const available=actionSurge.current>0&&actionSurgeGate.current>0;
    actions.push({
      id:"action.fighter.action-surge",
      actorId:character.id,
      name:"액션 서지",
      category:"basic",
      target:"self",
      economy:"없음",
      resolutionKind:"no-roll",
      summary:`추가 행동 1회 · ${actionSurge.current}/${actionSurge.max}`,
      available,
      disabledReason:available?undefined:actionSurge.current<=0?"액션 서지 사용 횟수를 모두 소모했습니다.":"이번 턴에 이미 액션 서지를 사용했습니다.",
      eligibleTargetIds:[character.id],
      details:[detail("효과","이번 턴 비마법 행동 1회 추가"),detail("비용",`${actionSurge.label} 1회`,actionSurge.source),detail("제한","턴당 1회 · Magic Action 불가","SRD 5.2.1 · Fighter Action Surge")],
    });
  }
  const bardLevel=character.classLevels?.find((entry)=>entry.classId===BARD_ID)?.level??0;
  const inspiration=character.resources.find((resource)=>resource.id===BARDIC_INSPIRATION_RESOURCE_ID);
  if(bardLevel&&inspiration)actions.push({
    id:"action.bard.bardic-inspiration",actorId:character.id,name:"바드의 영감",category:"basic",target:"ally",economy:"추가 행동",resolutionKind:"no-roll",
    summary:`d${bardicInspirationDieSides(bardLevel)} 지급 · ${inspiration.current}/${inspiration.max}`,available:inspiration.current>0,
    disabledReason:inspiration.current?undefined:"바드의 영감 사용 횟수가 없습니다.",eligibleTargetIds:[],resourceCost:{resourceId:inspiration.id,amount:1},
    details:[detail("대상","자신이 아닌 아군 1명"),detail("효과",`d${bardicInspirationDieSides(bardLevel)} 영감 주사위 · 1시간`),detail("비용","추가 행동 1 · 바드의 영감 1회"),detail("출처","SRD 5.2.1 · Bardic Inspiration")],
  });
  const clericLevel=character.classLevels?.find((entry)=>entry.classId===CLERIC_ID)?.level??0;
  const channelDivinity=character.resources.find((resource)=>resource.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  if(clericLevel>=2&&channelDivinity){
    const diceCount=clericDivineSparkDiceCount(clericLevel);const wisdom=mod(character.abilities.wis);const dc=8+character.proficiencyBonus+wisdom;
    const divineSpark=(mode:"healing"|"radiant"|"necrotic",name:string,target:ActionVm["target"],summary:string):ActionVm=>({
      id:`action.cleric.divine-spark.${mode}`,actorId:character.id,name,category:"basic",target,economy:"행동",resolutionKind:mode==="healing"?"healing":"saving-throw",
      summary:`${summary} · ${channelDivinity.current}/${channelDivinity.max}`,available:channelDivinity.current>0,disabledReason:channelDivinity.current?undefined:"채널 디비니티 사용 횟수가 없습니다.",eligibleTargetIds:[],
      saveDc:mode==="healing"?undefined:dc,saveAbility:mode==="healing"?undefined:"건강",saveHalf:mode==="healing"?undefined:true,resourceCost:{resourceId:channelDivinity.id,amount:1},
      healing:mode==="healing"?{dice:`${diceCount}d8`,flat:wisdom,average:Math.floor(diceCount*4.5)+wisdom}:undefined,
      damage:mode==="healing"?undefined:[{type:mode==="radiant"?"광휘":"사령",dice:`${diceCount}d8`,flat:wisdom,average:Math.floor(diceCount*4.5)+wisdom}],
      details:[detail("대상","자신이 아닌 생물 1명"),detail("효과",summary),detail("비용","행동 1 · 채널 디비니티 1회"),detail("출처","SRD 5.2.1 · Cleric Divine Spark")],
    });
    actions.push(
      divineSpark("healing","신성한 불꽃 · 회복","any",`${diceCount}d8 ${signed(wisdom)} HP 회복`),
      divineSpark("radiant","신성한 불꽃 · 광휘","enemy",`건강 내성 DC ${dc} · ${diceCount}d8 ${signed(wisdom)} 광휘 피해`),
      divineSpark("necrotic","신성한 불꽃 · 사령","enemy",`건강 내성 DC ${dc} · ${diceCount}d8 ${signed(wisdom)} 사령 피해`),
    );
    actions.push({
      id:"action.cleric.turn-undead",actorId:character.id,name:"언데드 퇴치",category:"basic",target:"any",economy:"행동",resolutionKind:"saving-throw",
      summary:`지혜 내성 DC ${dc} · 공포 + 행동불능${clericLevel>=5?` · ${searUndeadDiceCount(wisdom)}d8 광휘`:""} · ${channelDivinity.current}/${channelDivinity.max}`,
      available:channelDivinity.current>0,disabledReason:channelDivinity.current?undefined:"채널 디비니티 사용 횟수가 없습니다.",eligibleTargetIds:[],maxTargets:64,saveDc:dc,saveAbility:"지혜",resourceCost:{resourceId:channelDivinity.id,amount:1},
      details:[detail("대상","30피트 내 선택한 모든 언데드"),detail("실패","1분간 공포 + 행동불능"),...(clericLevel>=5?[detail("언데드 소각",`${searUndeadDiceCount(wisdom)}d8 광휘 피해`)]:[]),detail("비용","행동 1 · 채널 디비니티 1회"),detail("출처","SRD 5.2.1 · Cleric Turn Undead")],
    });
  }
  const paladinLevel=character.classLevels?.find((entry)=>entry.classId===PALADIN_ID)?.level??0;const layOnHands=character.resources.find((resource)=>resource.id===PALADIN_LAY_ON_HANDS_RESOURCE_ID);
  if(paladinLevel&&layOnHands){
    const options=[{id:"poisoned" as const,label:"중독",cost:5},...(paladinLevel>=14?[{id:"blinded" as const,label:"실명",cost:5},{id:"charmed" as const,label:"매혹",cost:5},{id:"deafened" as const,label:"청각상실",cost:5},{id:"frightened" as const,label:"공포",cost:5},{id:"paralyzed" as const,label:"마비",cost:5},{id:"stunned" as const,label:"기절",cost:5}]:[])];
    actions.push({id:LAY_ON_HANDS_ACTION_ID,actorId:character.id,name:"치유의 손길",category:"basic",target:"any",economy:"추가 행동",resolutionKind:"healing",summary:`HP/상태 회복 · ${layOnHands.current}/${layOnHands.max}`,available:layOnHands.current>0,disabledReason:layOnHands.current?undefined:"치유의 손길 풀이 없습니다.",eligibleTargetIds:[],resourceCost:{resourceId:layOnHands.id,amount:1},layOnHands:{maximumSpend:layOnHands.current,conditionOptions:options},details:[detail("대상","접촉한 생물 1명"),detail("회복","선택한 풀 1점당 HP 1"),detail("상태 제거","상태마다 풀 5점"),detail("비용","추가 행동 1"),detail("출처","SRD 5.2.1 · Paladin Lay On Hands")]});
  }
  const paladinChannel=character.resources.find((resource)=>resource.id===PALADIN_CHANNEL_DIVINITY_RESOURCE_ID);
  if(paladinLevel>=3&&paladinChannel)actions.push({id:"action.paladin.divine-sense",actorId:character.id,name:"성스러운 감지",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",summary:`60피트 내 천상체·악마·언데드 감지 · ${paladinChannel.current}/${paladinChannel.max}`,available:paladinChannel.current>0,disabledReason:paladinChannel.current?undefined:"채널 디비니티 사용 횟수가 없습니다.",eligibleTargetIds:[character.id],resourceCost:{resourceId:paladinChannel.id,amount:1},details:[detail("범위","60피트"),detail("감지","천상체·악마·언데드 및 성역/부정한 장소"),detail("지속","10분 또는 행동불능"),detail("비용","추가 행동 1 · 채널 디비니티 1회"),detail("출처","SRD 5.2.1 · Paladin Divine Sense")]});
  if(paladinLevel>=9&&paladinChannel){const charisma=mod(character.abilities.cha);const dc=8+character.proficiencyBonus+charisma;const maximum=abjureFoesMaximumTargets(charisma);actions.push({id:"action.paladin.abjure-foes",actorId:character.id,name:"적 질책",category:"basic",target:"any",economy:"행동",resolutionKind:"saving-throw",summary:`최대 ${maximum}명 · 지혜 내성 DC ${dc} · 실패 시 공포 · ${paladinChannel.current}/${paladinChannel.max}`,available:paladinChannel.current>0,disabledReason:paladinChannel.current?undefined:"채널 디비니티 사용 횟수가 없습니다.",eligibleTargetIds:[],maxTargets:maximum,saveDc:dc,saveAbility:"지혜",resourceCost:{resourceId:paladinChannel.id,amount:1},details:[detail("대상",`60피트 내 최대 ${maximum}명`),detail("실패","1분간 공포 · 피해를 받으면 종료"),detail("행동 제한","이동·행동·추가 행동 중 하나만 사용"),detail("비용","행동 1 · 채널 디비니티 1회"),detail("출처","SRD 5.2.1 · Paladin Abjure Foes")]});}
  return actions;
}

function readyTriggerAction(character:CharacterSheet,prepared:ActionVm,trigger:string):ActionVm {
  return {
    id:"action.standard.ready.trigger",
    actorId:character.id,
    name:`발동 · ${prepared.name}`,
    category:"basic",
    target:prepared.target,
    economy:"반응",
    resolutionKind:"no-roll",
    summary:`${trigger} → ${prepared.name}`,
    available:true,
    eligibleTargetIds:[...prepared.eligibleTargetIds],
    maxTargets:prepared.maxTargets,
    details:[
      detail("트리거",trigger),
      detail("예약 행동",prepared.name),
      detail("비용","반응 1"),
      detail("출처","SRD 5.2.1 · Ready"),
    ],
  };
}

function preparedMovementAction(character:CharacterSheet):ActionVm {
  return {
    id:READY_MOVEMENT_ACTION_ID,
    actorId:character.id,
    name:"이동",
    category:"basic",
    target:"self",
    economy:"반응",
    resolutionKind:"no-roll",
    summary:`최대 ${character.speed}피트 이동 선언`,
    available:true,
    eligibleTargetIds:[character.id],
    details:[detail("효과",`최대 ${character.speed}피트 이동`),detail("경계","위치 적용은 전투맵 모듈이 담당")],
  };
}

function itemActions(character:CharacterSheet):ActionVm[] {
  const actions:ActionVm[]=[];
  for (const item of character.items) {
    const potion=/potion-of-healing/i.test(item.definitionId)||/치유 물약|potion of healing/i.test(`${item.name} ${item.nameEn??""}`);
    if (potion) {
      actions.push({
        id:"action.healing-potion",
        actorId:character.id,
        name:item.name,
        category:"basic",
        target:"self",
        economy:"행동",
        resolutionKind:"healing",
        summary:`2d4 + 2 회복 · ${item.quantity}개`,
        available:item.quantity>0,
        disabledReason:item.quantity>0?undefined:"남은 수량이 없습니다.",
        eligibleTargetIds:[],
        healing:{dice:"2d4",flat:2,average:7},
        itemCost:{itemId:item.id,quantity:1},
        details:[detail("대상","자신"),detail("회복","2d4 + 2"),detail("비용",`${item.name} 1개`),...item.provenance.map((source)=>detail("출처",source))],
      });
      continue;
    }
    const magicMissile=/wand-of-magic-missiles/i.test(item.definitionId)||/마법 미사일 완드|wand of magic missiles/i.test(`${item.name} ${item.nameEn??""}`);
    if (magicMissile&&item.charges) {
      actions.push({
        id:"action.wand",
        actorId:character.id,
        name:item.name,
        category:"magic",
        target:"enemy",
        economy:"행동",
        resolutionKind:"no-roll-damage",
        summary:`자동 명중 · 3d4 + 3 역장 · 충전 ${item.charges.current}/${item.charges.max}`,
        available:item.charges.current>0,
        disabledReason:item.charges.current>0?undefined:"충전이 없습니다.",
        eligibleTargetIds:[],
        damage:[{type:"역장",dice:"3d4",flat:3,average:10}],
        itemCost:{itemId:item.id,charges:1},
        details:[detail("피해","3d4 + 3 역장"),detail("비용","충전 1"),...item.provenance.map((source)=>detail("출처",source))],
      });
    }
  }
  return actions;
}

function spellTokens(character:ExtendedCharacter) {
  return [...(character.cantrips??[]),...(character.preparedSpells??[])].map((token)=>String(token).replace(/^always:/,""));
}

function spellActions(character:ExtendedCharacter):ActionVm[] {
  const tokens=spellTokens(character);
  if (!tokens.length) return [];
  const mental=(Object.entries({int:character.abilities.int,wis:character.abilities.wis,cha:character.abilities.cha}) as Array<["int"|"wis"|"cha",number]>).sort((a,b)=>b[1]-a[1])[0];
  const spellMod=mod(mental[1]);
  const dc=8+character.proficiencyBonus+spellMod;
  const cantrips=new Set((character.cantrips??[]).map((token)=>String(token).replace(/^always:/,"")));
  return [...new Set(tokens)].map((spellId)=>{
    const spell=spellPresentationById(spellId);
    const level=spell?.level??(cantrips.has(spellId)?0:1);
    const mechanic=spellMechanicById(spellId);
    const executable=Boolean(mechanic&&isExecutableSpellRuntimeSupport(mechanic.runtimeSupport));
    const reason="이 주문은 세션 자동 판정에 아직 연결되지 않았습니다.";
    const primary=mechanic?.primary;
    const formula=primary&&(primary.kind==="attack-damage"||primary.kind==="save-damage"||primary.kind==="healing"||primary.kind==="temporary-hp")?primary.dice:primary?.kind==="multi-attack-damage"?primary.dicePerAttack:primary?.kind==="power-word-kill"?primary.fallbackDamage:undefined;
    const dice=formula?`${formula.count}d${formula.sides}`:undefined;
    const harmful=primary?.kind==="attack-damage"||primary?.kind==="multi-attack-damage"||primary?.kind==="save-damage"||primary?.kind==="save-compound-damage"||primary?.kind==="save-effect"||primary?.kind==="power-word-kill"||primary?.kind==="automatic-projectiles";
    const multiAttackTargets=mechanic&&primary?.kind==="multi-attack-damage"?spellMultiAttackCount(mechanic,character.level,level===0?undefined:Math.max(level,selectedCombatSpellSlot(character.id,level))):0;
    const maxTargets=multiAttackTargets||mechanic?.targeting.maxTargets;
    const many=(maxTargets??1)>1;
    const selfOnly=mechanic?.targeting.allowedRelations?.length===1&&mechanic.targeting.allowedRelations[0]==="self";
    const target:ActionVm["target"]=(mechanic?.targeting.maxTargets??0)===0?"none":selfOnly?"self":primary?.kind==="healing"||primary?.kind==="full-healing"||primary?.kind==="temporary-hp"?"ally":harmful?(many?"multi-enemy":"enemy"):"any";
    const resolutionKind:ActionVm["resolutionKind"]=primary?.kind==="attack-damage"||primary?.kind==="multi-attack-damage"?"attack":primary?.kind==="save-damage"||primary?.kind==="save-compound-damage"||primary?.kind==="save-effect"?"saving-throw":primary?.kind==="healing"||primary?.kind==="full-healing"||primary?.kind==="temporary-hp"?"healing":primary?.kind==="automatic-projectiles"||primary?.kind==="power-word-kill"?"no-roll-damage":"no-roll";
    const damage=primary?.kind==="save-compound-damage"
      ? primary.components.map((component)=>({type:component.damageType,dice:`${component.dice.count}d${component.dice.sides}`,flat:component.dice.flat??0,average:Math.floor(component.dice.count*(component.dice.sides+1)/2)+(component.dice.flat??0)}))
      : primary&&(primary.kind==="attack-damage"||primary.kind==="multi-attack-damage"||primary.kind==="save-damage"||primary.kind==="power-word-kill")&&dice
      ? [{type:primary.kind==="power-word-kill"?"psychic":primary.damageType,dice,flat:formula?.flat??0,average:Math.floor((formula!.count*(formula!.sides+1))/2)+(formula?.flat??0)}]
      : primary?.kind==="automatic-projectiles"
        ? [{type:primary.damageType,dice:`${primary.baseProjectiles}d${primary.projectileDice.sides}`,flat:primary.baseProjectiles*primary.projectileDice.flat,average:Math.floor(primary.baseProjectiles*(primary.projectileDice.sides+1)/2)+primary.baseProjectiles*primary.projectileDice.flat}]
        : undefined;
    return {
      id:spellId==="dnd.srd521.spell.fire-bolt"?"action.fire-bolt":spellId==="dnd.srd521.spell.magic-missile"?"action.magic-missile":`action.spell.${spellId.replace(/^dnd\.srd521\.spell\./,"")}`,
      actorId:character.id,name:spell?.name??spellId.replace(/^dnd\.srd521\.spell\./,"").replaceAll("-"," "),category:"magic",target,
      economy:mechanic?.castingEconomy==="bonus-action"?"추가 행동":mechanic?.castingEconomy==="reaction"?"반응":"행동",resolutionKind,
      summary:executable?(spell?.summary??`${level===0?"소마법":`${level}레벨 주문`} · 자동 판정 지원`):(spell?`${spellLevelLabel(spell)} · ${spell.castingTime} · ${spell.range}`:`${level===0?"소마법":`${level}레벨 주문`} · 자동 판정 미지원`),
      available:executable,disabledReason:executable?undefined:(mechanic?.unsupportedInteractions?.join(" ")||reason),eligibleTargetIds:[],maxTargets:many?maxTargets:undefined,
      attackBonus:primary?.kind==="attack-damage"||primary?.kind==="multi-attack-damage"?character.proficiencyBonus+spellMod:undefined,
      saveDc:primary?.kind==="save-damage"||primary?.kind==="save-compound-damage"||primary?.kind==="save-effect"?dc:undefined,
      saveAbility:primary?.kind==="save-damage"||primary?.kind==="save-compound-damage"||primary?.kind==="save-effect"?ABILITY_LABEL[primary.saveAbility]:undefined,
      saveHalf:(primary?.kind==="save-damage"||primary?.kind==="save-compound-damage")&&primary.successDamage==="half"?true:undefined,
      damage,
      healing:(primary?.kind==="healing"||primary?.kind==="temporary-hp")&&dice?{dice,flat:(formula?.flat??0)+(formula?.addSpellcastingModifier?spellMod:0),average:Math.floor((formula!.count*(formula!.sides+1))/2)+(formula?.flat??0)+(formula?.addSpellcastingModifier?spellMod:0)}:undefined,
      spellCast:{spellId,runtimeSupport:executable?(mechanic!.runtimeSupport==="tracked-executable"?"tracked-executable":"combat-executable"):"partial",baseLevel:level,castSource:(character.preparedSpells??[]).includes(`always:${spellId}`)?"always-prepared":"prepared",disabledMechanicReason:executable?undefined:(mechanic?.unsupportedInteractions?.join(" ")||reason)},
      details:spell?[detail("시전 시간",spell.castingTime),detail("사거리",spell.range),detail("지속시간",spell.duration),detail("효과",spell.summary),detail("출처","SRD 5.2.1")]:[detail("주문",spellId),detail("상태",reason)],
    } satisfies ActionVm;
  });
}

export function deriveProductionCharacterActions(character:CharacterSheet):ActionVm[] {
  const merged=[...attackActions(character),...featureActions(character),...skillActions(character),...itemActions(character),...spellActions(character as ExtendedCharacter)];
  const byId=new Map<string,ActionVm>();
  for (const action of merged) byId.set(action.id,action);
  return [...byId.values()];
}

export function productionCharacterEntity(character:CharacterSheet):SceneEntity {
  return {
    id:character.id,
    name:character.name,
    side:"ally",
    kind:"character",
    hp:character.hp,
    maxHp:character.maxHp,
    tempHp:character.tempHp,
    ac:character.ac,
    initiative:10+mod(character.abilities.dex),
    status:[],
    distance:"0피트",
    resistances:[],
    immunities:[],
    vulnerabilities:[],
    reactions:[],
  };
}

function reconcile(adapter:MockAdapter) {
  const internal=adapter as unknown as Internal;
  const character=internal.activeCharacter;
  if (!character?.id) return;
  if (isEphemeralSessionProjectionCharacter(adapter,character.id)) return;

  const fixtureIds=new Set(["char.aelar","char.mira"]);
  if (internal.session.role==="host"&&fixtureIds.has(character.id)) {
    internal.scene.entities=internal.scene.entities.filter((entity)=>entity.id!==character.id);
    delete internal.scene.actionsByActor[character.id];
    delete internal.scene.economyByActor[character.id];
    if (internal.scene.currentActorId===character.id) internal.scene.currentActorId=internal.scene.entities[0]?.id??"";
    if (internal.scene.selectedActorId===character.id) internal.scene.selectedActorId=internal.scene.currentActorId;
    return;
  }

  const previousLocalId=localProjectionIdByAdapter.get(adapter);
  if (previousLocalId&&previousLocalId!==character.id&&!isEphemeralSessionProjectionCharacter(adapter,previousLocalId)) {
    internal.scene.entities=internal.scene.entities.filter((entity)=>entity.id!==previousLocalId);
    delete internal.scene.actionsByActor[previousLocalId];
    delete internal.scene.economyByActor[previousLocalId];
    if (internal.scene.currentActorId===previousLocalId) internal.scene.currentActorId=character.id;
    if (internal.scene.selectedActorId===previousLocalId) internal.scene.selectedActorId=character.id;
  }
  localProjectionIdByAdapter.set(adapter,character.id);

  internal.scene.entities=internal.scene.entities.filter((entity)=>entity.kind!=="character"||entity.id===character.id||!fixtureIds.has(entity.id));
  const projected=productionCharacterEntity(character);
  const index=internal.scene.entities.findIndex((entity)=>entity.id===character.id);
  if (index>=0) {
    const previous=internal.scene.entities[index];
    internal.scene.entities[index]={...previous,...projected,status:[...previous.status],reactions:[...previous.reactions],resistances:[...previous.resistances],immunities:[...previous.immunities],vulnerabilities:[...previous.vulnerabilities]};
  } else internal.scene.entities.unshift(projected);

  const actions=deriveProductionCharacterActions(character);
  const ready=readyActionConfigurationFor(adapter);
  const prepared=ready?.actorId===character.id
    ? ready.actionId===READY_MOVEMENT_ACTION_ID?preparedMovementAction(character):actions.find((action)=>action.id===ready.actionId)
    : undefined;
  if (prepared&&internal.scene.entities.find((entity)=>entity.id===character.id)?.status.includes("준비 행동")) {
    actions.push(readyTriggerAction(character,prepared,ready!.trigger));
  }
  internal.scene.actionsByActor[character.id]=actions;
  internal.scene.economyByActor[character.id]??={action:true,bonusAction:true,reaction:true,movement:character.speed,movementMax:character.speed};

  if (!internal.scene.entities.some((entity)=>entity.id===internal.scene.currentActorId)) internal.scene.currentActorId=character.id;
  if (!internal.scene.entities.some((entity)=>entity.id===internal.scene.selectedActorId)) internal.scene.selectedActorId=character.id;

  for (const id of fixtureIds) {
    if (id===character.id) continue;
    if (!internal.scene.entities.some((entity)=>entity.id===id)) {
      delete internal.scene.actionsByActor[id];
      delete internal.scene.economyByActor[id];
    }
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithProductionPlay() {
  const initial=await previousGetSnapshot.call(this);
  const internal=this as unknown as Internal;
  internal.activeCharacter=cp(initial.activeCharacter);
  reconcile(this);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.selectProductionCharacter=async function selectProductionCharacter(characterId:string) {
  const internal=this as unknown as Internal;
  const selected=internal.characters.find((character)=>character.id===characterId);
  if (!selected||!isSheet(selected)) return internal.getSnapshot();
  internal.activeCharacter=cp(selected);
  reconcile(this);
  internal.activity.unshift({id:`phase14.select.${Date.now()}`,time:"지금",actor:selected.name,title:"플레이 캐릭터 선택",summary:`${selected.className} ${selected.level}`,detail:[`Character ${selected.id} -> production Scene actor`],stateChanges:["activeCharacter 변경","Scene actor/actions 재투영"]});
  return internal.getSnapshot();
};

MockAdapter.prototype.startProductionLocalPlay=async function startProductionLocalPlay(role:AppRole="player") {
  const internal=this as unknown as Internal;
  internal.role=role;
  internal.session.role="offline";
  internal.session.name=role==="dm"?"로컬 DM 세션":"로컬 플레이 세션";
  internal.session.address="local";
  internal.session.compatibility="compatible";
  internal.session.compatibilityMessage="로컬 production Character/Scene composition 활성";
  internal.session.participants=[{id:`local:${internal.activeCharacter.id}`,name:role==="dm"?"Local DM":"Local Player",characterName:internal.activeCharacter.name,state:"connected"}];
  internal.connectionState="connected";
  reconcile(this);
  return internal.getSnapshot();
};

export async function selectProductionCharacter(adapter:MockAdapter,characterId:string) {
  return adapter.selectProductionCharacter(characterId);
}

export async function startProductionLocalPlay(adapter:MockAdapter,role:AppRole="player") {
  return adapter.startProductionLocalPlay(role);
}

installProductionCharacterActionProjector(deriveProductionCharacterActions);
