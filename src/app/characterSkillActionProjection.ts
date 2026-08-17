import type { AbilityKey, ActionVm, CharacterSheet } from "./contracts";

const ABILITY_LABEL:Record<AbilityKey,string>={
  str:"근력",
  dex:"민첩",
  con:"건강",
  int:"지능",
  wis:"지혜",
  cha:"매력",
};

const SKILLS:Array<{id:string;nameKo:string;nameEn:string;ability:AbilityKey}>=[
  {id:"athletics",nameKo:"운동",nameEn:"Athletics",ability:"str"},
  {id:"acrobatics",nameKo:"곡예",nameEn:"Acrobatics",ability:"dex"},
  {id:"sleight-of-hand",nameKo:"손재주",nameEn:"Sleight of Hand",ability:"dex"},
  {id:"stealth",nameKo:"은신",nameEn:"Stealth",ability:"dex"},
  {id:"arcana",nameKo:"비전",nameEn:"Arcana",ability:"int"},
  {id:"history",nameKo:"역사",nameEn:"History",ability:"int"},
  {id:"investigation",nameKo:"조사",nameEn:"Investigation",ability:"int"},
  {id:"nature",nameKo:"자연",nameEn:"Nature",ability:"int"},
  {id:"religion",nameKo:"종교",nameEn:"Religion",ability:"int"},
  {id:"animal-handling",nameKo:"동물 조련",nameEn:"Animal Handling",ability:"wis"},
  {id:"insight",nameKo:"통찰",nameEn:"Insight",ability:"wis"},
  {id:"medicine",nameKo:"의학",nameEn:"Medicine",ability:"wis"},
  {id:"perception",nameKo:"지각",nameEn:"Perception",ability:"wis"},
  {id:"survival",nameKo:"생존",nameEn:"Survival",ability:"wis"},
  {id:"deception",nameKo:"기만",nameEn:"Deception",ability:"cha"},
  {id:"intimidation",nameKo:"위협",nameEn:"Intimidation",ability:"cha"},
  {id:"performance",nameKo:"공연",nameEn:"Performance",ability:"cha"},
  {id:"persuasion",nameKo:"설득",nameEn:"Persuasion",ability:"cha"},
];

const abilityMod=(score:number)=>Math.floor((score-10)/2);
const signed=(value:number)=>value>=0?`+${value}`:`${value}`;

function hasSkill(character:CharacterSheet,nameKo:string,nameEn:string) {
  return character.skills.some((entry)=>{
    const normalized=entry.replace(/\s+[+-]\d+$/,"").trim().toLowerCase();
    return normalized===nameKo.toLowerCase() || normalized===nameEn.toLowerCase();
  });
}

export function deriveCharacterSkillActions(character:CharacterSheet):ActionVm[] {
  return SKILLS.map((skill)=>{
    const proficient=hasSkill(character,skill.nameKo,skill.nameEn);
    const abilityBonus=abilityMod(character.abilities[skill.ability]);
    const total=abilityBonus+(proficient?character.proficiencyBonus:0);
    return {
      id:`action.skill.${skill.id}`,
      actorId:character.id,
      name:skill.nameKo,
      category:"basic",
      target:"none",
      economy:"없음",
      resolutionKind:"ability-check",
      summary:`${ABILITY_LABEL[skill.ability]} ${signed(total)}${proficient?" · 숙련":""}`,
      available:true,
      eligibleTargetIds:[],
      checkBonus:total,
      details:[
        {label:"판정",value:`${ABILITY_LABEL[skill.ability]}(${skill.nameKo})`},
        {label:"능력 수정치",value:signed(abilityBonus),source:`host-derived ${ABILITY_LABEL[skill.ability]} ${character.abilities[skill.ability]}`},
        {label:"숙련",value:proficient?signed(character.proficiencyBonus):"없음",source:proficient?"host-derived Character skill proficiency":"host-derived non-proficiency"},
        {label:"총 보너스",value:signed(total),source:"host-derived ability + proficiency"},
      ],
    } satisfies ActionVm;
  });
}
