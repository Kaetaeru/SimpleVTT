import {
  validateChoiceDefinitions,
  type ChoiceDefinition,
  type ChoiceSelectionMap,
} from "./choiceDefinition";
import {
  buildProgressionPlan,
  resolveProgression,
  type ProgressionCharacterState,
  type ProgressionPlan,
  type ProgressionRequest,
  type ProgressionResolution,
} from "./progression";
import {
  METAMAGIC_OPTIONS,
  SORCERER_ID,
  sorcererMetamagicReplacementChoices,
  sorcererMetamagicReplacementFromId,
  sorcererMetamagicReplacementToId,
} from "./sorcererProgressionChoices";

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function selectedOptionId(selections: ChoiceSelectionMap, choiceId: string) {
  const selection = selections[choiceId];
  return selection?.kind === "options" ? selection.optionIds[0] : undefined;
}

function labelForMetamagic(id: string | undefined) {
  if (!id) return "—";
  return METAMAGIC_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function replacementChoices(
  state: ProgressionCharacterState,
  request: ProgressionRequest,
  basePlan: ProgressionPlan,
): ChoiceDefinition[] {
  if (request.targetClassId !== SORCERER_ID) return [];
  return sorcererMetamagicReplacementChoices({
    targetLevel:basePlan.targetClassLevel,
    knownMetamagicIds:state.metamagicIds ?? [],
    selections:request.selections,
  });
}

export function buildProgressionPlanPhase08Sorcerer(
  state: ProgressionCharacterState,
  request: ProgressionRequest,
): ProgressionPlan {
  const basePlan = buildProgressionPlan(state, request);
  const extras = replacementChoices(state, request, basePlan);
  if (!extras.length) return basePlan;

  const issues = validateChoiceDefinitions(extras, request.selections);
  const blocking = [
    ...basePlan.blocking,
    ...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
  ];
  const warnings = [
    ...basePlan.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  ];

  const fromId = sorcererMetamagicReplacementFromId(basePlan.targetClassLevel);
  const toId = sorcererMetamagicReplacementToId(basePlan.targetClassLevel);
  const from = selectedOptionId(request.selections, fromId);
  const toSelection = request.selections[toId];
  const to = selectedOptionId(request.selections, toId);

  if (toSelection && !from) {
    blocking.push("교체할 기존 메타매직을 먼저 선택해야 새 메타매직을 선택할 수 있습니다.");
  }

  const diffs = [...basePlan.diffs];
  if (from && to) {
    diffs.push({
      label:"메타매직 교체",
      before:labelForMetamagic(from),
      after:labelForMetamagic(to),
      source:`소서러 ${basePlan.targetClassLevel}레벨 · 메타매직 교체 · SRD 5.2.1`,
    });
  }

  return {
    ...basePlan,
    choices:[...basePlan.choices, ...extras],
    blocking:unique(blocking),
    warnings:unique(warnings),
    diffs,
  };
}

export function resolveProgressionPhase08Sorcerer(
  state: ProgressionCharacterState,
  request: ProgressionRequest,
): ProgressionResolution {
  const plan = buildProgressionPlanPhase08Sorcerer(state, request);
  if (plan.blocking.length) {
    return {
      status:"rejected",
      state,
      plan,
      error:plan.blocking.join(" | "),
    };
  }

  const base = resolveProgression(state, request);
  if (base.status === "rejected") {
    return {
      status:"rejected",
      state,
      plan,
      error:base.error,
    };
  }

  if (request.targetClassId !== SORCERER_ID) {
    return { status:"committed", state:base.state, plan };
  }

  const fromId = sorcererMetamagicReplacementFromId(plan.targetClassLevel);
  const toId = sorcererMetamagicReplacementToId(plan.targetClassLevel);
  const from = selectedOptionId(request.selections, fromId);
  const to = selectedOptionId(request.selections, toId);
  if (!from && !to) return { status:"committed", state:base.state, plan };
  if (!from || !to) {
    return {
      status:"rejected",
      state,
      plan,
      error:"메타매직 교체는 기존 옵션과 새 옵션이 모두 선택되어야 합니다.",
    };
  }

  const next = structuredClone(base.state);
  const metamagicIds = new Set(next.metamagicIds ?? []);
  if (!metamagicIds.has(from)) {
    return {
      status:"rejected",
      state,
      plan,
      error:`교체할 메타매직을 보유하고 있지 않습니다: ${from}`,
    };
  }
  if (metamagicIds.has(to)) {
    return {
      status:"rejected",
      state,
      plan,
      error:`이미 보유한 메타매직으로 교체할 수 없습니다: ${to}`,
    };
  }

  metamagicIds.delete(from);
  metamagicIds.add(to);
  next.metamagicIds = [...metamagicIds];
  const sources = { ...(next.metamagicSources ?? {}) };
  delete sources[from];
  sources[to] = `소서러 ${plan.targetClassLevel}레벨 · 메타매직 교체 · SRD 5.2.1`;
  next.metamagicSources = sources;

  return { status:"committed", state:next, plan };
}
