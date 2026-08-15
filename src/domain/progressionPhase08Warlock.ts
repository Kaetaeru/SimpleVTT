import {
  validateChoiceDefinitions,
  type ChoiceDefinition,
  type ChoiceSelectionMap,
} from "./choiceDefinition";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08Sorcerer,
  resolveProgressionPhase08Sorcerer,
} from "./progressionPhase08Sorcerer";
import {
  ELDRITCH_INVOCATIONS,
  WARLOCK_ID,
  invocationBaseId,
  invocationTargetId,
  isWarlockInvocationChoice,
  warlockInvocationChoices,
} from "./warlockProgressionChoices";

const REPLACEMENT_SOURCE = (level: number) => `워락 ${level}레벨 · 섬뜩한 기원술 교체 · SRD 5.2.1`;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function selectedOptionId(selections: ChoiceSelectionMap, choiceId: string) {
  const selection = selections[choiceId];
  return selection?.kind === "options" ? selection.optionIds[0] : undefined;
}

function selectedInvocationAdditions(selections: ChoiceSelectionMap) {
  return Object.entries(selections)
    .filter(([id, value]) => isWarlockInvocationChoice(id) && value.kind === "options")
    .flatMap(([, value]) => value.kind === "options" ? value.optionIds : []);
}

function definitionForAcquisition(acquisitionId: string) {
  const baseId = invocationBaseId(acquisitionId);
  return ELDRITCH_INVOCATIONS.find((entry) => entry.id === baseId);
}

function acquisitionLabel(acquisitionId: string, request: ProgressionRequest) {
  const definition = definitionForAcquisition(acquisitionId);
  const targetId = invocationTargetId(acquisitionId);
  if (!definition) return acquisitionId;
  if (!targetId) return definition.label;
  const spell = request.spellOptions?.find((option) => option.id === targetId);
  const feat = request.originFeatOptions?.find((option) => option.id === targetId);
  return `${definition.label} · ${spell?.label ?? feat?.label ?? targetId}`;
}

export function warlockInvocationReplacementFromId(targetLevel: number) {
  return `progression.${WARLOCK_ID}.${targetLevel}.invocation-replace.from`;
}

export function warlockInvocationReplacementToId(targetLevel: number) {
  return `progression.${WARLOCK_ID}.${targetLevel}.invocation-replace.to`;
}

function isRepeatable(baseId: string) {
  return ELDRITCH_INVOCATIONS.find((entry) => entry.id === baseId)?.repeatable === true;
}

function dependencyReason(
  acquisitionId: string,
  knownInvocationIds: string[],
  selectedAdditions: string[],
) {
  const baseId = invocationBaseId(acquisitionId);
  const dependent = [...knownInvocationIds, ...selectedAdditions]
    .filter((id) => id !== acquisitionId)
    .find((id) => definitionForAcquisition(id)?.prerequisiteInvocationId === baseId);
  if (!dependent) return undefined;
  return `${definitionForAcquisition(dependent)?.label ?? dependent}의 선행 기원술이므로 교체할 수 없습니다.`;
}

export function warlockInvocationReplacementChoices(args: {
  state: ProgressionCharacterState;
  request: ProgressionRequest;
  targetLevel: number;
}): ChoiceDefinition[] {
  const knownInvocationIds = unique(args.state.eldritchInvocationIds ?? []);
  if (!knownInvocationIds.length) return [];
  const additions = selectedInvocationAdditions(args.request.selections);
  const fromId = warlockInvocationReplacementFromId(args.targetLevel);
  const fromSelection = args.request.selections[fromId];
  const selectedFrom = fromSelection?.kind === "options" ? fromSelection.optionIds[0] : undefined;
  const source = REPLACEMENT_SOURCE(args.targetLevel);

  const from: ChoiceDefinition = {
    id:fromId,
    label:"섬뜩한 기원술 교체 · 기존 기원술",
    description:"이번 워락 레벨 상승에서 원한다면 알고 있는 섬뜩한 기원술 하나를 교체할 수 있습니다.",
    kind:"feature-option",
    count:1,
    required:false,
    status:"ready",
    source,
    options:knownInvocationIds.map((acquisitionId) => {
      const baseId = invocationBaseId(acquisitionId);
      return {
        id:acquisitionId,
        label:acquisitionLabel(acquisitionId, args.request),
        description:definitionForAcquisition(acquisitionId)?.description,
        disabledReason:baseId === "invocation:lessons-of-the-first-ones"
          ? "이 기원술이 부여한 기원 재주의 획득 provenance를 안전하게 분리하기 전에는 교체할 수 없습니다."
          : dependencyReason(acquisitionId, knownInvocationIds, additions),
      };
    }),
  };
  if (!selectedFrom) return [from];

  const selectedFromBase = invocationBaseId(selectedFrom);
  const knownAfterRemoval = knownInvocationIds.filter((id) => id !== selectedFrom);
  const generated = warlockInvocationChoices({
    targetLevel:args.targetLevel,
    count:1,
    knownInvocationIds:knownAfterRemoval,
    knownCantripIds:args.state.cantripIds ?? [],
    knownFeatureIds:args.state.features,
    originFeatOptions:args.request.originFeatOptions ?? [],
    spellOptions:args.request.spellOptions,
    selections:args.request.selections,
  })[0];
  const additionExact = new Set(additions);
  const additionBases = new Set(additions.map(invocationBaseId));

  const to: ChoiceDefinition = {
    id:warlockInvocationReplacementToId(args.targetLevel),
    label:"섬뜩한 기원술 교체 · 새 기원술",
    description:"기존 기원술을 대신해 현재 자격을 만족하는 다른 섬뜩한 기원술 하나를 선택합니다.",
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source,
    options:(generated?.options ?? []).map((option) => {
      const baseId = invocationBaseId(option.id);
      let disabledReason = option.disabledReason;
      if (!disabledReason && option.id === selectedFrom) {
        disabledReason = "같은 기원술 획득으로 교체할 수 없습니다.";
      } else if (!disabledReason && baseId === selectedFromBase && !isRepeatable(baseId)) {
        disabledReason = "Repeatable이 아닌 같은 기원술로 교체할 수 없습니다.";
      } else if (!disabledReason && additionExact.has(option.id)) {
        disabledReason = "이번 레벨에서 새로 획득하는 동일 기원술과 중복됩니다.";
      } else if (!disabledReason && !isRepeatable(baseId) && additionBases.has(baseId)) {
        disabledReason = "이번 레벨에서 새로 획득하는 Repeatable이 아닌 기원술과 중복됩니다.";
      }
      return { ...option, disabledReason };
    }),
  };
  return [from, to];
}

function replacementChoices(
  state: ProgressionCharacterState,
  request: ProgressionRequest,
  basePlan: ProgressionPlan,
) {
  if (request.targetClassId !== WARLOCK_ID) return [];
  return warlockInvocationReplacementChoices({
    state,
    request,
    targetLevel:basePlan.targetClassLevel,
  });
}

export function buildProgressionPlanPhase08Warlock(
  state: ProgressionCharacterState,
  request: ProgressionRequest,
): ProgressionPlan {
  const basePlan = buildProgressionPlanPhase08Sorcerer(state, request);
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

  const from = selectedOptionId(request.selections, warlockInvocationReplacementFromId(basePlan.targetClassLevel));
  const toId = warlockInvocationReplacementToId(basePlan.targetClassLevel);
  const toSelection = request.selections[toId];
  const to = selectedOptionId(request.selections, toId);
  if (toSelection && !from) {
    blocking.push("교체할 기존 섬뜩한 기원술을 먼저 선택해야 새 기원술을 선택할 수 있습니다.");
  }

  const diffs = [...basePlan.diffs];
  if (from && to) {
    diffs.push({
      label:"섬뜩한 기원술 교체",
      before:acquisitionLabel(from, request),
      after:acquisitionLabel(to, request),
      source:REPLACEMENT_SOURCE(basePlan.targetClassLevel),
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

export function resolveProgressionPhase08Warlock(
  state: ProgressionCharacterState,
  request: ProgressionRequest,
): ProgressionResolution {
  const plan = buildProgressionPlanPhase08Warlock(state, request);
  if (plan.blocking.length) {
    return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  }

  const base = resolveProgressionPhase08Sorcerer(state, request);
  if (base.status === "rejected") {
    return { status:"rejected", state, plan, error:base.error };
  }
  if (request.targetClassId !== WARLOCK_ID) {
    return { status:"committed", state:base.state, plan };
  }

  const from = selectedOptionId(request.selections, warlockInvocationReplacementFromId(plan.targetClassLevel));
  const to = selectedOptionId(request.selections, warlockInvocationReplacementToId(plan.targetClassLevel));
  if (!from && !to) return { status:"committed", state:base.state, plan };
  if (!from || !to) {
    return { status:"rejected", state, plan, error:"섬뜩한 기원술 교체는 기존 기원술과 새 기원술이 모두 선택되어야 합니다." };
  }

  const next = structuredClone(base.state);
  const invocationIds = new Set(next.eldritchInvocationIds ?? []);
  if (!invocationIds.has(from)) {
    return { status:"rejected", state, plan, error:`교체할 섬뜩한 기원술을 보유하고 있지 않습니다: ${from}` };
  }
  if (invocationIds.has(to)) {
    return { status:"rejected", state, plan, error:`이미 보유한 동일 기원술 획득으로 교체할 수 없습니다: ${to}` };
  }

  invocationIds.delete(from);
  invocationIds.add(to);
  next.eldritchInvocationIds = [...invocationIds];
  const sources = { ...(next.eldritchInvocationSources ?? {}) };
  delete sources[from];
  sources[to] = REPLACEMENT_SOURCE(plan.targetClassLevel);
  next.eldritchInvocationSources = sources;

  if (invocationBaseId(to) === "invocation:lessons-of-the-first-ones") {
    const featId = invocationTargetId(to);
    if (featId) next.features = unique([...next.features, featId]);
  }

  return { status:"committed", state:next, plan };
}
