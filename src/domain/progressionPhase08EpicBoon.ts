import {
  registerCatalogPendingChoiceResolver,
  validateChoiceDefinitions,
  type ChoiceSelectionValue,
} from "./choiceDefinition";
import {
  applyEpicBoonSelection,
  epicBoonChoiceDefinitions,
  epicBoonChoiceId,
} from "./epicBoonProgression";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08Warlock,
  resolveProgressionPhase08Warlock,
} from "./progressionPhase08Warlock";

const RESOLVER_ID = "phase08:epic-boon";

registerCatalogPendingChoiceResolver(RESOLVER_ID,(definition,selection) => {
  if (definition.kind !== "epic-boon" || !definition.id.endsWith(".epic-boon")) return undefined;
  if (!selection) {
    return [{ choiceId:definition.id, severity:"blocking", message:`${definition.label} 선택이 필요합니다.` }];
  }
  if (selection.kind !== "options" || selection.optionIds.length !== 1) {
    return [{ choiceId:definition.id, severity:"blocking", message:`${definition.label}에서 1개를 선택해야 합니다.` }];
  }
  return [];
});

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function modifier(score:number) {
  return Math.floor((score - 10) / 2);
}

function selectedOptionId(selection:ChoiceSelectionValue|undefined) {
  return selection?.kind === "options" ? selection.optionIds[0] : undefined;
}

function epicChoices(state:ProgressionCharacterState,request:ProgressionRequest,basePlan:ProgressionPlan) {
  const pending = basePlan.choices.find((choice) => choice.kind === "epic-boon" && choice.id.endsWith(".epic-boon"));
  if (!pending) return [];
  return epicBoonChoiceDefinitions({
    state,
    targetClassId:basePlan.targetClassId,
    targetClassLevel:basePlan.targetClassLevel,
    selections:request.selections,
  });
}

export function buildProgressionPlanPhase08EpicBoon(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const basePlan = buildProgressionPlanPhase08Warlock(state,request);
  const extras = epicChoices(state,request,basePlan);
  if (!extras.length) return basePlan;

  const parentId = epicBoonChoiceId(basePlan.targetClassId,basePlan.targetClassLevel);
  const issues = validateChoiceDefinitions(extras,request.selections);
  const blocking = unique([
    ...basePlan.blocking,
    ...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
  ]);
  const warnings = unique([
    ...basePlan.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  ]);
  const choices = [
    ...basePlan.choices.filter((choice) => choice.id !== parentId),
    ...extras,
  ];

  const applied = applyEpicBoonSelection(state.abilities,choices,request.selections);
  const extraConstitutionHp = applied.featId && applied.ability === "con"
    ? (modifier(applied.abilities.con) - modifier(state.abilities.con)) * basePlan.toTotalLevel
    : 0;
  const hp = extraConstitutionHp === 0 ? basePlan.hp : {
    ...basePlan.hp,
    retroactiveConstitutionGain:basePlan.hp.retroactiveConstitutionGain + extraConstitutionHp,
    totalGain:basePlan.hp.totalGain + extraConstitutionHp,
  };
  const diffs = basePlan.diffs.map((diff) => diff.label === "최대 HP" && extraConstitutionHp !== 0
    ? { ...diff, after:String(Number(diff.after) + extraConstitutionHp) }
    : diff);

  const parentSelection = request.selections[parentId];
  const selectedFeatId = selectedOptionId(parentSelection);
  if (selectedFeatId && applied.featLabel) {
    diffs.push({
      label:"에픽 은총",
      before:"—",
      after:applied.featLabel,
      source:applied.source ?? extras[0].source,
    });
  }
  if (applied.ability && applied.abilityBefore !== undefined && applied.abilityAfter !== undefined) {
    diffs.push({
      label:`에픽 은총 능력치 · ${applied.abilityLabel ?? applied.ability}`,
      before:String(applied.abilityBefore),
      after:String(applied.abilityAfter),
      source:applied.source ?? extras[0].source,
    });
  }

  return {
    ...basePlan,
    choices,
    blocking,
    warnings,
    hp,
    diffs,
  };
}

export function resolveProgressionPhase08EpicBoon(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08EpicBoon(state,request);
  if (plan.blocking.length) {
    return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  }

  const base = resolveProgressionPhase08Warlock(state,request);
  if (base.status === "rejected") {
    return { status:"rejected", state, plan, error:base.error };
  }
  const parent = plan.choices.find((choice) => choice.kind === "epic-boon");
  if (!parent) return { status:"committed", state:base.state, plan };

  const applied = applyEpicBoonSelection(base.state.abilities,plan.choices,request.selections);
  if (!applied.featId) {
    return { status:"rejected", state, plan, error:"에픽 은총 재주 선택을 해석할 수 없습니다." };
  }
  const next = structuredClone(base.state);
  const oldConstitutionModifier = modifier(next.abilities.con);
  next.abilities = applied.abilities;
  const newConstitutionModifier = modifier(next.abilities.con);
  if (newConstitutionModifier !== oldConstitutionModifier) {
    next.hpMaximum = Math.max(1,next.hpMaximum + (newConstitutionModifier - oldConstitutionModifier) * next.totalLevel);
    next.hpCurrent = Math.min(next.hpCurrent,next.hpMaximum);
  }
  next.features = unique([...next.features,applied.featId]);
  return { status:"committed", state:next, plan };
}
