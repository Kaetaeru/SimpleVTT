import type { AbilityChoiceKey, ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import {
  epicBoonFeatRules,
  featAbilityIncreaseOptions,
  featEligibility,
  featRuleById,
} from "./featRuleCatalog";
import type { ProgressionCharacterState } from "./progression";
import { classById, progressionRow, type AbilityKey } from "./progressionCatalog";

const ABILITY_LABELS:Record<AbilityKey,string> = {
  str:"근력",
  dex:"민첩",
  con:"건강",
  int:"지능",
  wis:"지혜",
  cha:"매력",
};

export function epicBoonChoiceId(classId:string,classLevel:number) {
  return `progression.${classId}.${classLevel}.epic-boon`;
}

export function epicBoonAbilityChoiceId(classId:string,classLevel:number) {
  return `${epicBoonChoiceId(classId,classLevel)}.ability-increase`;
}

function classHasSpellcastingFeature(classId:string,classLevel:number) {
  const definition = classById(classId);
  return definition?.progression.some((row) => row.level <= classLevel && row.features.includes("주문 시전")) === true;
}

function characterHasSpellcastingFeature(state:ProgressionCharacterState,targetClassId:string,targetClassLevel:number) {
  if (state.features.includes("주문 시전")) return true;
  if (state.classTracks.some((track) => classHasSpellcastingFeature(track.classId,track.level))) return true;
  return classHasSpellcastingFeature(targetClassId,targetClassLevel);
}

function selectedOptionId(selections:ChoiceSelectionMap,choiceId:string) {
  const selection = selections[choiceId];
  return selection?.kind === "options" ? selection.optionIds[0] : undefined;
}

export function epicBoonChoiceDefinitions(args:{
  state:ProgressionCharacterState;
  targetClassId:string;
  targetClassLevel:number;
  selections:ChoiceSelectionMap;
}):ChoiceDefinition[] {
  const definition = classById(args.targetClassId);
  const source = `${definition?.nameKo ?? args.targetClassId} ${args.targetClassLevel}레벨 · 에픽 은총 · SRD 5.2.1`;
  const totalLevel = args.state.totalLevel + 1;
  const hasSpellcastingFeature = characterHasSpellcastingFeature(args.state,args.targetClassId,args.targetClassLevel);
  const parentId = epicBoonChoiceId(args.targetClassId,args.targetClassLevel);
  const parent:ChoiceDefinition = {
    id:parentId,
    label:"에픽 은총",
    description:"선행 조건을 만족하는 SRD 에픽 은총 재주 하나를 선택합니다.",
    kind:"epic-boon",
    count:1,
    required:true,
    status:"ready",
    source,
    options:epicBoonFeatRules().map((feat) => {
      const eligibility = featEligibility(feat,{
        totalLevel,
        abilities:args.state.abilities,
        featureIds:args.state.features,
        hasSpellcastingFeature,
        knownFeatIds:args.state.features,
      });
      return {
        id:feat.id,
        label:feat.name,
        description:feat.originalName,
        disabledReason:eligibility.eligible ? undefined : eligibility.reasons.join("; "),
      };
    }),
  };

  const featId = selectedOptionId(args.selections,parentId);
  const feat = featId ? featRuleById(featId) : undefined;
  if (!feat?.config.abilityIncrease) return [parent];
  const increase = feat.config.abilityIncrease;
  const options = featAbilityIncreaseOptions(feat);
  const child:ChoiceDefinition = {
    id:epicBoonAbilityChoiceId(args.targetClassId,args.targetClassLevel),
    label:`${feat.name} · 능력치 증가`,
    description:`${feat.name}으로 증가시킬 능력치를 하나 선택합니다. 이 증가의 상한은 ${increase.maximum}입니다.`,
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source,
    options:options.map((ability) => ({
      id:`ability:${ability}`,
      label:ABILITY_LABELS[ability],
      description:`${ABILITY_LABELS[ability]} +${increase.amount} (최대 ${increase.maximum})`,
      disabledReason:args.state.abilities[ability] >= increase.maximum
        ? `이미 이 재주가 허용하는 최대치 ${increase.maximum}에 도달했습니다.`
        : undefined,
    })),
  };
  return [parent,child];
}

export interface AppliedEpicBoon {
  abilities:Record<AbilityKey,number>;
  featId?:string;
  featLabel?:string;
  ability?:AbilityChoiceKey;
  abilityLabel?:string;
  abilityBefore?:number;
  abilityAfter?:number;
  source?:string;
}

export function applyEpicBoonSelection(
  abilities:Record<AbilityKey,number>,
  choices:ChoiceDefinition[],
  selections:ChoiceSelectionMap,
):AppliedEpicBoon {
  const next = { ...abilities };
  const parent = choices.find((choice) => choice.kind === "epic-boon");
  if (!parent) return { abilities:next };
  const featId = selectedOptionId(selections,parent.id);
  const feat = featId ? featRuleById(featId) : undefined;
  if (!featId || !feat) return { abilities:next };

  const result:AppliedEpicBoon = {
    abilities:next,
    featId,
    featLabel:feat.name,
    source:parent.source,
  };
  const increase = feat.config.abilityIncrease;
  if (!increase) return result;
  const child = choices.find((choice) => choice.id === `${parent.id}.ability-increase`);
  const abilityOption = child ? selectedOptionId(selections,child.id) : undefined;
  if (!abilityOption?.startsWith("ability:")) return result;
  const ability = abilityOption.slice("ability:".length) as AbilityChoiceKey;
  const before = next[ability];
  const after = Math.min(increase.maximum,before + increase.amount);
  next[ability] = after;
  result.ability = ability;
  result.abilityLabel = ABILITY_LABELS[ability];
  result.abilityBefore = before;
  result.abilityAfter = after;
  return result;
}

export function epicBoonSourceRow(classId:string,classLevel:number) {
  return progressionRow(classId,classLevel)?.features.includes("에픽 은총") === true;
}
