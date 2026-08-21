import type { ActionVm } from "./contracts";
import { spellPresentationById, spellVisual, type SpellVisualKey } from "./spellPresentation";

export type ActionIconKey = SpellVisualKey
  | "weapon-slashing"
  | "weapon-piercing"
  | "weapon-bludgeoning"
  | "weapon-attack"
  | "item"
  | "ability-check"
  | "saving-throw"
  | "action"
  | "magic";

export type ActionIconSource = "damage" | "school" | "effect" | "action";

export interface ActionIconDescriptor {
  key: ActionIconKey;
  label: string;
  source: ActionIconSource;
}

const DAMAGE_VISUALS:Array<{key:SpellVisualKey;label:string;tokens:string[]}>= [
  {key:"fire",label:"화염 속성",tokens:["화염","fire"]},
  {key:"cold",label:"냉기 속성",tokens:["냉기","cold"]},
  {key:"lightning",label:"번개 속성",tokens:["번개","lightning"]},
  {key:"acid",label:"산성 속성",tokens:["산성","acid"]},
  {key:"poison",label:"독 속성",tokens:["독","poison"]},
  {key:"psychic",label:"정신 속성",tokens:["정신","psychic"]},
  {key:"radiant",label:"광휘 속성",tokens:["광휘","radiant"]},
  {key:"necrotic",label:"괴저 속성",tokens:["괴저","necrotic"]},
  {key:"force",label:"역장 속성",tokens:["역장","force"]},
  {key:"thunder",label:"천둥 속성",tokens:["천둥","thunder"]},
];

function normalized(value:string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/[\s_-]+/g,"");
}

function damageVisual(type:string):ActionIconDescriptor|undefined {
  const value=normalized(type);
  const match=DAMAGE_VISUALS.find((entry)=>entry.tokens.some((token)=>value.includes(normalized(token))));
  return match?{key:match.key,label:match.label,source:"damage"}:undefined;
}

function weaponDamageVisual(type:string,labelSuffix="무기"):ActionIconDescriptor|undefined {
  const value=normalized(type);
  if (["참격","slashing"].some((token)=>value.includes(normalized(token)))) return {key:"weapon-slashing",label:`참격 ${labelSuffix}`,source:"damage"};
  if (["관통","piercing"].some((token)=>value.includes(normalized(token)))) return {key:"weapon-piercing",label:`관통 ${labelSuffix}`,source:"damage"};
  if (["타격","bludgeoning"].some((token)=>value.includes(normalized(token)))) return {key:"weapon-bludgeoning",label:`타격 ${labelSuffix}`,source:"damage"};
  return undefined;
}

export function actionIconDescriptor(action:ActionVm):ActionIconDescriptor {
  if (action.category==="magic") {
    const explicit=action.damage?.map((part)=>damageVisual(part.type)??weaponDamageVisual(part.type,"속성")).find(Boolean);
    if (explicit) return explicit;
    if (action.healing) return {key:"healing",label:"회복 효과",source:"effect"};
    const spell=action.spellCast?spellPresentationById(action.spellCast.spellId):undefined;
    if (spell) {
      const visual=spellVisual(spell);
      return {key:visual.key,label:`${visual.label} ${visual.source==="school"?"학파":"속성"}`,source:visual.source==="school"?"school":"damage"};
    }
    return {key:"magic",label:"마법 행동",source:"action"};
  }

  if (action.itemCost) return {key:"item",label:"아이템 사용",source:"action"};
  if (action.healing||action.resolutionKind==="healing") return {key:"healing",label:"회복 효과",source:"effect"};

  if (action.category==="weapon"||action.resolutionKind==="attack") {
    const physical=action.damage?.map((part)=>weaponDamageVisual(part.type)).find(Boolean);
    if (physical) return physical;
    return {key:"weapon-attack",label:"공격 행동",source:"action"};
  }
  if (action.resolutionKind==="ability-check") return {key:"ability-check",label:"능력 판정",source:"action"};
  if (action.resolutionKind==="saving-throw") return {key:"saving-throw",label:"내성 굴림",source:"action"};
  return {key:"action",label:"일반 행동",source:"action"};
}
