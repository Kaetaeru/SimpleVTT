import "./combatantRuntimeContracts";
import type { AbilityKey, ActionVm, AppRole, AppSnapshot, CharacterSheet, CharacterSummary, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { isEphemeralSessionProjectionCharacter } from "./characterSessionProjectionRegistry";

const ABILITY_LABEL:Record<AbilityKey,string>={str:"근력",dex:"민첩",con:"건강",int:"지능",wis:"지혜",cha:"매력"};
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

function attackActions(character:CharacterSheet):ActionVm[] {
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
      summary:`${signed(attack.bonus)} · ${damage.dice}${damage.flat?signed(damage.flat):""} ${damage.type}`,
      available:true,
      eligibleTargetIds:[],
      attackBonus:attack.bonus,
      damage:[{type:damage.type,dice:damage.dice,flat:damage.flat,average:damage.average}],
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
        detail("비용","행동 1"),
      ],
    } satisfies ActionVm;
  });
}

function skillActions(character:CharacterSheet):ActionVm[] {
  return SKILLS.map((skill)=>{
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
}

function featureActions(character:CharacterSheet):ActionVm[] {
  const standardEffect=(id:string,name:string,target:ActionVm["target"],summary:string,details:ActionVm["details"]):ActionVm=>({id:`action.standard.${id}`,actorId:character.id,name,category:"basic",target,economy:"행동",resolutionKind:"no-roll",summary,available:true,eligibleTargetIds:[],details});
  const standardCheck=(group:string,id:string,name:string,skill:string,ability:AbilityKey):ActionVm=>({id:`action.standard.${group}.${id}`,actorId:character.id,name,category:"basic",target:"none",economy:"행동",resolutionKind:"ability-check",summary:`${ABILITY_LABEL[ability]}(${skill}) ${signed(skillBonus(character,skill,ability))}`,available:true,eligibleTargetIds:[],checkBonus:skillBonus(character,skill,ability),details:[detail("기본 행동",group),detail("판정",`${ABILITY_LABEL[ability]}(${skill})`),detail("비용","행동 1"),detail("출처","SRD 5.2.1 · Action")]});
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
  return actions;
}

function readyTriggerAction(character:CharacterSheet):ActionVm {
  return {
    id:"action.standard.ready.trigger",
    actorId:character.id,
    name:"준비 행동 발동",
    category:"basic",
    target:"self",
    economy:"반응",
    resolutionKind:"no-roll",
    summary:"선언한 트리거가 발생해 준비한 행동을 발동합니다.",
    available:true,
    eligibleTargetIds:[character.id],
    details:[
      detail("효과","준비한 행동 또는 이동 발동"),
      detail("비용","반응 1"),
      detail("출처","SRD 5.2.1 · Ready"),
    ],
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
  return [...(character.cantrips??[]),...(character.preparedSpells??[]),...(character.spellbookSpells??[])].map(String);
}

function hasSpell(tokens:string[],id:string,ko:string,en:string) {
  return tokens.some((token)=>token===id||token.includes(id)||token.toLowerCase().includes(en.toLowerCase())||token.includes(ko));
}

function spellActions(character:ExtendedCharacter):ActionVm[] {
  const tokens=spellTokens(character);
  if (!tokens.length) return [];
  const mental=(Object.entries({int:character.abilities.int,wis:character.abilities.wis,cha:character.abilities.cha}) as Array<["int"|"wis"|"cha",number]>).sort((a,b)=>b[1]-a[1])[0];
  const spellMod=mod(mental[1]);
  const dc=8+character.proficiencyBonus+spellMod;
  const result:ActionVm[]=[];
  if (hasSpell(tokens,"dnd.srd521.spell.healing-word","치유의 단어","healing word")) result.push({id:"action.healing-word",actorId:character.id,name:"치유의 단어",category:"magic",target:"ally",economy:"추가 행동",resolutionKind:"healing",summary:`1d4 ${signed(spellMod)} 회복`,available:true,eligibleTargetIds:[],healing:{dice:"1d4",flat:spellMod,average:3+spellMod},details:[detail("대상","아군 1명"),detail("회복",`1d4 ${signed(spellMod)}`),detail("주문 능력",ABILITY_LABEL[mental[0]],"Character spell projection")]});
  if (hasSpell(tokens,"dnd.srd521.spell.vicious-mockery","신랄한 조롱","vicious mockery")) result.push({id:"action.vicious-mockery",actorId:character.id,name:"신랄한 조롱",category:"magic",target:"enemy",economy:"행동",resolutionKind:"saving-throw",summary:`지혜 내성 DC ${dc} · 정신 피해`,available:true,eligibleTargetIds:[],saveDc:dc,saveAbility:"지혜",damage:[{type:"정신",dice:"1d6",flat:0,average:4}],details:[detail("내성",`지혜 DC ${dc}`),detail("출처","Character prepared/cantrip spell")]});
  if (hasSpell(tokens,"dnd.srd521.spell.thunderwave","천둥파","thunderwave")) result.push({id:"action.thunderwave",actorId:character.id,name:"천둥파",category:"magic",target:"multi-enemy",economy:"행동",resolutionKind:"saving-throw",summary:`건강 내성 DC ${dc} · 2d8 천둥`,available:true,eligibleTargetIds:[],maxTargets:4,saveDc:dc,saveAbility:"건강",saveHalf:true,damage:[{type:"천둥",dice:"2d8",flat:0,average:9}],details:[detail("내성",`건강 DC ${dc}`),detail("피해","2d8 천둥 · 성공 시 절반"),detail("출처","Character prepared spell")]});
  return result;
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

  const previousLocalId=localProjectionIdByAdapter.get(adapter);
  if (previousLocalId&&previousLocalId!==character.id&&!isEphemeralSessionProjectionCharacter(adapter,previousLocalId)) {
    internal.scene.entities=internal.scene.entities.filter((entity)=>entity.id!==previousLocalId);
    delete internal.scene.actionsByActor[previousLocalId];
    delete internal.scene.economyByActor[previousLocalId];
    if (internal.scene.currentActorId===previousLocalId) internal.scene.currentActorId=character.id;
    if (internal.scene.selectedActorId===previousLocalId) internal.scene.selectedActorId=character.id;
  }
  localProjectionIdByAdapter.set(adapter,character.id);

  const fixtureIds=new Set(["char.aelar","char.mira"]);
  internal.scene.entities=internal.scene.entities.filter((entity)=>entity.kind!=="character"||entity.id===character.id||!fixtureIds.has(entity.id));
  const projected=productionCharacterEntity(character);
  const index=internal.scene.entities.findIndex((entity)=>entity.id===character.id);
  if (index>=0) {
    const previous=internal.scene.entities[index];
    internal.scene.entities[index]={...previous,...projected,status:[...previous.status],reactions:[...previous.reactions],resistances:[...previous.resistances],immunities:[...previous.immunities],vulnerabilities:[...previous.vulnerabilities]};
  } else internal.scene.entities.unshift(projected);

  const actions=deriveProductionCharacterActions(character);
  if (internal.scene.entities.find((entity)=>entity.id===character.id)?.status.includes("준비 행동")) {
    actions.push(readyTriggerAction(character));
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
