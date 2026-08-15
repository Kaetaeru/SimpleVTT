import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import type { ProgressionCharacterState } from "./progression";

export const FIGHTER_FIGHTING_STYLE_CLASS_ID = "dnd.srd521.class.fighter";

export interface FightingStyleOption {
  id:string;
  label:string;
  description?:string;
}

export interface FighterFightingStyleState extends ProgressionCharacterState {
  fightingStyleFeatIds?:string[];
  fightingStyleFeatSources?:Record<string,string>;
}

export function fighterFightingStyleChoiceId(classLevel:number) {
  return `progression.${FIGHTER_FIGHTING_STYLE_CLASS_ID}.${classLevel}.전투 방식`;
}

export function fighterFightingStyleReplacementChoiceId(classLevel:number) {
  return `progression.${FIGHTER_FIGHTING_STYLE_CLASS_ID}.${classLevel}.fighting-style-replacement`;
}

function knownStyleIds(state:FighterFightingStyleState,options:FightingStyleOption[]) {
  const ids = new Set(state.fightingStyleFeatIds ?? []);
  for (const option of options) {
    if (state.features.includes(option.id) || state.features.includes(option.label)) ids.add(option.id);
  }
  return ids;
}

export function fighterInitialFightingStyleChoice(args:{
  state:FighterFightingStyleState;
  targetClassLevel:number;
  options:FightingStyleOption[];
}):ChoiceDefinition|undefined {
  if (args.targetClassLevel !== 1) return undefined;
  const known = knownStyleIds(args.state,args.options);
  const source = "파이터 1레벨 · 전투 방식 · SRD 5.2.1";
  return {
    id:fighterFightingStyleChoiceId(1),
    label:"전투 방식",
    description:"전투 방식 재주 하나를 선택합니다.",
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source,
    options:args.options.map((option) => ({
      ...option,
      disabledReason:known.has(option.id) ? "이미 보유한 전투 방식 재주입니다." : undefined,
    })),
  };
}

export function encodeFightingStyleReplacement(oldId:string,newId:string) {
  return `replace=${oldId}|with=${newId}`;
}

export function decodeFightingStyleReplacement(value:string) {
  const match = value.match(/^replace=([^|]+)\|with=(.+)$/);
  return match ? { oldId:match[1], newId:match[2] } : undefined;
}

export function fighterFightingStyleReplacementChoice(args:{
  state:FighterFightingStyleState;
  targetClassLevel:number;
  options:FightingStyleOption[];
}):ChoiceDefinition|undefined {
  if (args.targetClassLevel <= 1) return undefined;
  const known = knownStyleIds(args.state,args.options);
  if (!known.size) return undefined;
  const byId = new Map(args.options.map((option) => [option.id,option]));
  const concrete = [...known].flatMap((oldId) => {
    const oldOption = byId.get(oldId);
    if (!oldOption) return [];
    return args.options
      .filter((candidate) => candidate.id !== oldId && !known.has(candidate.id))
      .map((candidate) => ({
        id:encodeFightingStyleReplacement(oldId,candidate.id),
        label:`${oldOption.label} → ${candidate.label}`,
        description:`${oldOption.label} 전투 방식 재주를 ${candidate.label}(으)로 교체합니다.`,
      }));
  });
  if (!concrete.length) return undefined;
  return {
    id:fighterFightingStyleReplacementChoiceId(args.targetClassLevel),
    label:"전투 방식 교체",
    description:"파이터 레벨을 얻을 때 보유한 전투 방식 재주 하나를 다른 전투 방식 재주로 교체할 수 있습니다.",
    kind:"feature-option",
    count:1,
    required:false,
    status:"ready",
    source:`파이터 ${args.targetClassLevel}레벨 획득 · 전투 방식 교체 · SRD 5.2.1`,
    options:concrete,
  };
}

export function selectedFightingStyleId(choice:ChoiceDefinition|undefined,selections:ChoiceSelectionMap) {
  if (!choice) return undefined;
  const selection = selections[choice.id];
  return selection?.kind === "options" ? selection.optionIds[0] : undefined;
}
