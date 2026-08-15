import {
  registerCatalogPendingChoiceResolver,
  validateChoiceDefinitions,
} from "./choiceDefinition";
import {
  decodeFightingStyleReplacement,
  fighterFightingStyleChoiceId,
  fighterFightingStyleReplacementChoice,
  fighterInitialFightingStyleChoice,
  FIGHTER_FIGHTING_STYLE_CLASS_ID,
  selectedFightingStyleId,
  type FighterFightingStyleState,
  type FightingStyleOption,
} from "./fighterFightingStyleProgression";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08WeaponMastery,
  resolveProgressionPhase08WeaponMastery,
} from "./progressionPhase08WeaponMastery";

registerCatalogPendingChoiceResolver("phase08:fighter-fighting-style",(definition,selection) => {
  if (definition.id !== fighterFightingStyleChoiceId(1) || definition.label !== "전투 방식") return undefined;
  if (!selection) {
    return [{ choiceId:definition.id, severity:"blocking", message:"전투 방식 선택이 필요합니다." }];
  }
  if (selection.kind !== "options" || selection.optionIds.length !== 1) {
    return [{ choiceId:definition.id, severity:"blocking", message:"전투 방식에서 1개를 선택해야 합니다." }];
  }
  return [];
});

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function styleOptions(request:ProgressionRequest):FightingStyleOption[] {
  return (request.fightingStyleOptions ?? []).map((option) => ({
    id:option.id,
    label:option.label,
    description:option.description,
  }));
}

function styleChoices(state:ProgressionCharacterState,request:ProgressionRequest,plan:ProgressionPlan) {
  if (plan.targetClassId !== FIGHTER_FIGHTING_STYLE_CLASS_ID) return [];
  const fighterState = state as FighterFightingStyleState;
  const options = styleOptions(request);
  const initial = fighterInitialFightingStyleChoice({ state:fighterState, targetClassLevel:plan.targetClassLevel, options });
  const replacement = fighterFightingStyleReplacementChoice({ state:fighterState, targetClassLevel:plan.targetClassLevel, options });
  return [initial,replacement].filter((choice):choice is NonNullable<typeof choice> => Boolean(choice));
}

export function buildProgressionPlanPhase08FighterStyle(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const basePlan = buildProgressionPlanPhase08WeaponMastery(state,request);
  const materialized = styleChoices(state,request,basePlan);
  if (!materialized.length) return basePlan;

  const initialId = fighterFightingStyleChoiceId(basePlan.targetClassLevel);
  const choices = [
    ...basePlan.choices.filter((choice) => choice.id !== initialId),
    ...materialized,
  ];
  const issues = validateChoiceDefinitions(materialized,request.selections);
  const blocking = unique([
    ...basePlan.blocking,
    ...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
  ]);
  const warnings = unique([
    ...basePlan.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  ]);
  const diffs = [...basePlan.diffs];

  const initial = materialized.find((choice) => choice.id === initialId);
  const initialStyleId = selectedFightingStyleId(initial,request.selections);
  const initialOption = initial?.options.find((option) => option.id === initialStyleId);
  if (initialOption) {
    diffs.push({ label:"전투 방식", before:"—", after:initialOption.label, source:initial!.source });
  }

  const replacement = materialized.find((choice) => choice.id.endsWith(".fighting-style-replacement"));
  const replacementValue = selectedFightingStyleId(replacement,request.selections);
  const decoded = replacementValue ? decodeFightingStyleReplacement(replacementValue) : undefined;
  if (decoded && replacement) {
    const options = new Map(styleOptions(request).map((option) => [option.id,option]));
    diffs.push({
      label:"전투 방식 교체",
      before:options.get(decoded.oldId)?.label ?? decoded.oldId,
      after:options.get(decoded.newId)?.label ?? decoded.newId,
      source:replacement.source,
    });
  }
  return { ...basePlan, choices, blocking, warnings, diffs };
}

export function resolveProgressionPhase08FighterStyle(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08FighterStyle(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const base = resolveProgressionPhase08WeaponMastery(state,request);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (plan.targetClassId !== FIGHTER_FIGHTING_STYLE_CLASS_ID) return { status:"committed", state:base.state, plan };

  const next = structuredClone(base.state) as FighterFightingStyleState;
  const options = styleOptions(request);
  const byId = new Map(options.map((option) => [option.id,option]));
  const initial = plan.choices.find((choice) => choice.id === fighterFightingStyleChoiceId(plan.targetClassLevel));
  const initialStyleId = selectedFightingStyleId(initial,request.selections);
  if (initialStyleId) {
    next.fightingStyleFeatIds = unique([...(next.fightingStyleFeatIds ?? []),initialStyleId]);
    next.fightingStyleFeatSources = { ...(next.fightingStyleFeatSources ?? {}), [initialStyleId]:initial!.source };
    next.features = unique([...next.features,initialStyleId]);
  }

  const replacement = plan.choices.find((choice) => choice.id.endsWith(".fighting-style-replacement"));
  const replacementValue = selectedFightingStyleId(replacement,request.selections);
  const decoded = replacementValue ? decodeFightingStyleReplacement(replacementValue) : undefined;
  if (decoded && replacement) {
    next.fightingStyleFeatIds = (next.fightingStyleFeatIds ?? []).filter((id) => id !== decoded.oldId);
    next.fightingStyleFeatIds = unique([...(next.fightingStyleFeatIds ?? []),decoded.newId]);
    next.fightingStyleFeatSources = { ...(next.fightingStyleFeatSources ?? {}) };
    delete next.fightingStyleFeatSources[decoded.oldId];
    next.fightingStyleFeatSources[decoded.newId] = replacement.source;
    const oldLabel = byId.get(decoded.oldId)?.label;
    next.features = next.features.filter((feature) => feature !== decoded.oldId && feature !== oldLabel);
    next.features = unique([...next.features,decoded.newId]);
  }
  return { status:"committed", state:next, plan };
}
