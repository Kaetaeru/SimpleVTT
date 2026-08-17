import type { ActionVm, AbilityKey } from "./app/contracts";

export type PlayIntentId =
  | "attack" | "dash" | "disengage" | "dodge" | "help" | "hide"
  | "influence" | "magic" | "ready" | "search" | "study" | "utilize";

export type SkillFact = { id:string; name:string; ability:AbilityKey };
export type PlayIntent = {
  id:PlayIntentId;
  label:string;
  labelEn:string;
  summary:string;
  skillActionIds?:string[];
};

export const SKILL_FACTS: SkillFact[] = [
  {id:"action.skill.athletics",name:"운동",ability:"str"},
  {id:"action.skill.acrobatics",name:"곡예",ability:"dex"},
  {id:"action.skill.sleight-of-hand",name:"손재주",ability:"dex"},
  {id:"action.skill.stealth",name:"은신",ability:"dex"},
  {id:"action.skill.arcana",name:"비전",ability:"int"},
  {id:"action.skill.history",name:"역사",ability:"int"},
  {id:"action.skill.investigation",name:"조사",ability:"int"},
  {id:"action.skill.nature",name:"자연",ability:"int"},
  {id:"action.skill.religion",name:"종교",ability:"int"},
  {id:"action.skill.animal-handling",name:"동물 조련",ability:"wis"},
  {id:"action.skill.insight",name:"통찰",ability:"wis"},
  {id:"action.skill.medicine",name:"의학",ability:"wis"},
  {id:"action.skill.perception",name:"지각",ability:"wis"},
  {id:"action.skill.survival",name:"생존",ability:"wis"},
  {id:"action.skill.deception",name:"기만",ability:"cha"},
  {id:"action.skill.intimidation",name:"위협",ability:"cha"},
  {id:"action.skill.performance",name:"공연",ability:"cha"},
  {id:"action.skill.persuasion",name:"설득",ability:"cha"},
];

const INFLUENCE = ["action.skill.deception","action.skill.intimidation","action.skill.performance","action.skill.persuasion","action.skill.animal-handling"];
const SEARCH = ["action.skill.insight","action.skill.medicine","action.skill.perception","action.skill.survival"];
const STUDY = ["action.skill.arcana","action.skill.history","action.skill.investigation","action.skill.nature","action.skill.religion"];

export const OFFICIAL_PLAY_INTENTS: PlayIntent[] = [
  {id:"attack",label:"공격",labelEn:"Attack",summary:"무기 공격 또는 공격 행동을 선택합니다."},
  {id:"dash",label:"질주",labelEn:"Dash",summary:"이번 턴의 이동 가능량을 늘립니다."},
  {id:"disengage",label:"이탈",labelEn:"Disengage",summary:"이번 턴의 이동이 기회 공격을 유발하지 않게 합니다."},
  {id:"dodge",label:"회피",labelEn:"Dodge",summary:"다음 턴 시작 전까지 방어에 집중합니다."},
  {id:"help",label:"돕기",labelEn:"Help",summary:"아군의 판정이나 공격을 돕습니다."},
  {id:"hide",label:"숨기",labelEn:"Hide",summary:"은신을 시도합니다.",skillActionIds:["action.skill.stealth"]},
  {id:"influence",label:"영향주기",labelEn:"Influence",summary:"상대의 태도나 행동에 영향을 주기 위한 접근을 고릅니다.",skillActionIds:INFLUENCE},
  {id:"magic",label:"마법",labelEn:"Magic",summary:"주문, 마법 아이템 또는 마법 기능을 사용합니다."},
  {id:"ready",label:"준비",labelEn:"Ready",summary:"정한 트리거에 반응할 행동을 준비합니다."},
  {id:"search",label:"찾기",labelEn:"Search",summary:"눈에 바로 드러나지 않는 것을 찾습니다.",skillActionIds:SEARCH},
  {id:"study",label:"연구",labelEn:"Study",summary:"기억, 단서, 문헌을 검토해 정보를 떠올립니다.",skillActionIds:STUDY},
  {id:"utilize",label:"사용",labelEn:"Utilize",summary:"비마법 물건이나 환경과 상호작용합니다."},
];

export function intentOptions(intent:PlayIntentId, actions:ActionVm[]) {
  if (intent === "attack") return actions.filter((action)=>action.category==="weapon"||action.resolutionKind==="attack");
  if (intent === "magic") return actions.filter((action)=>action.category==="magic");
  const fact = OFFICIAL_PLAY_INTENTS.find((item)=>item.id===intent);
  if (fact?.skillActionIds?.length) return fact.skillActionIds.map((id)=>actions.find((action)=>action.id===id)).filter((item):item is ActionVm=>Boolean(item));
  const exact:Partial<Record<PlayIntentId,string[]>> = {
    dash:["action.dash"],
    disengage:["action.disengage"],
    dodge:["action.dodge"],
    help:["action.help"],
    ready:["action.ready"],
    utilize:["action.utilize"],
  };
  const ids=exact[intent]??[];
  return ids.map((id)=>actions.find((action)=>action.id===id)).filter((item):item is ActionVm=>Boolean(item));
}

export function skillFactByActionId(actionId:string) {
  return SKILL_FACTS.find((fact)=>fact.id===actionId);
}
