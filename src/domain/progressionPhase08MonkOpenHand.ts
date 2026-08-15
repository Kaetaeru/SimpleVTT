import { classById } from "./progressionCatalog";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08WizardEvocation,
  resolveProgressionPhase08WizardEvocation,
} from "./progressionPhase08WizardEvocation";
import {
  OPEN_HAND_FLEET_STEP_FEATURE_ID,
  OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
  OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID,
  MONK_OPEN_HAND_CLASS_ID,
} from "./monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "./srdSubclassCatalog";
import {
  subclassFeatureChoiceId,
  syntheticSubclassFeatureSelection,
  type SrdSubclassProgressionState,
} from "./srdSubclassProgression";

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function selectedOpenHandAtLevel3(request:ProgressionRequest,targetLevel:number) {
  if (targetLevel !== 3) return false;
  const selection = request.selections[`progression.${MONK_OPEN_HAND_CLASS_ID}.3.subclass`];
  const option = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  const name = option?.startsWith("subclass:") ? option.slice("subclass:".length) : undefined;
  return name === classById(MONK_OPEN_HAND_CLASS_ID)?.srdSubclassName;
}

function isOpenHand(state:ProgressionCharacterState,request:ProgressionRequest,targetLevel:number) {
  const subclassState = state as SrdSubclassProgressionState;
  return subclassState.subclassIds?.[MONK_OPEN_HAND_CLASS_ID] === MONK_OPEN_HAND_SUBCLASS_ID
    || state.classTracks.some((track) => track.classId === MONK_OPEN_HAND_CLASS_ID && track.subclassName === classById(MONK_OPEN_HAND_CLASS_ID)?.srdSubclassName)
    || selectedOpenHandAtLevel3(request,targetLevel);
}

function syntheticRequest(state:ProgressionCharacterState,request:ProgressionRequest,preview:ProgressionPlan) {
  if (preview.targetClassId !== MONK_OPEN_HAND_CLASS_ID || !isOpenHand(state,request,preview.targetClassLevel)) return request;
  if (![6,11,17].includes(preview.targetClassLevel)) return request;
  return {
    ...request,
    selections:{
      ...request.selections,
      [subclassFeatureChoiceId(MONK_OPEN_HAND_CLASS_ID,preview.targetClassLevel)]:{
        kind:"options" as const,
        optionIds:[syntheticSubclassFeatureSelection(MONK_OPEN_HAND_SUBCLASS_ID)],
      },
    },
  };
}

function buildInner(state:ProgressionCharacterState,request:ProgressionRequest) {
  const preview = buildProgressionPlanPhase08WizardEvocation(state,request);
  const synthetic = syntheticRequest(state,request,preview);
  return {
    syntheticRequest:synthetic,
    plan:synthetic === request ? preview : buildProgressionPlanPhase08WizardEvocation(state,synthetic),
  };
}

function featureIdsForLevel(level:number) {
  if (level === 6) return [OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID];
  if (level === 11) return [OPEN_HAND_FLEET_STEP_FEATURE_ID];
  if (level === 17) return [OPEN_HAND_QUIVERING_PALM_FEATURE_ID];
  return [];
}

function featureLabel(level:number) {
  if (level === 6) return "신체 완성";
  if (level === 11) return "날랜 발걸음";
  if (level === 17) return "진동장";
  return "";
}

function featureSource(level:number) {
  return `열린 손의 전사 · 수도승 ${level}레벨 · SRD 5.2.1`;
}

export function buildProgressionPlanPhase08MonkOpenHand(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const { plan:basePlan } = buildInner(state,request);
  if (basePlan.targetClassId !== MONK_OPEN_HAND_CLASS_ID || !isOpenHand(state,request,basePlan.targetClassLevel)) return basePlan;
  const level = basePlan.targetClassLevel;
  if (![6,11,17].includes(level)) return basePlan;
  const coreSubclassId = subclassFeatureChoiceId(MONK_OPEN_HAND_CLASS_ID,level);
  const choices = basePlan.choices.filter((choice) => choice.id !== coreSubclassId);
  const label = featureLabel(level);
  const diffs = label
    ? [...basePlan.diffs,{ label:"서브클래스 특성", before:"—", after:label, source:featureSource(level) }]
    : basePlan.diffs;
  return { ...basePlan, choices, diffs };
}

function persist(state:SrdSubclassProgressionState,plan:ProgressionPlan) {
  const level = plan.targetClassLevel;
  state.subclassIds = { ...(state.subclassIds ?? {}), [MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID };
  const featureIds = featureIdsForLevel(level);
  if (!featureIds.length) return;
  state.subclassFeatureIds = unique([...(state.subclassFeatureIds ?? []),...featureIds]);
  state.subclassFeatureSources = { ...(state.subclassFeatureSources ?? {}) };
  for (const featureId of featureIds) state.subclassFeatureSources[featureId] = featureSource(level);
  state.features = unique([...state.features,...featureIds]);
}

export function resolveProgressionPhase08MonkOpenHand(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08MonkOpenHand(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const { syntheticRequest } = buildInner(state,request);
  const base = resolveProgressionPhase08WizardEvocation(state,syntheticRequest);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (plan.targetClassId !== MONK_OPEN_HAND_CLASS_ID || !isOpenHand(state,request,plan.targetClassLevel)) {
    return { status:"committed", state:base.state, plan };
  }
  const next = structuredClone(base.state) as SrdSubclassProgressionState;
  persist(next,plan);
  return { status:"committed", state:next, plan };
}

export function openHandSyntheticSelectionsForPlan(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
  plan:ProgressionPlan,
) {
  return syntheticRequest(state,request,plan).selections;
}
