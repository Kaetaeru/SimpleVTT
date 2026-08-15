import { classById } from "./progressionCatalog";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08MonkOpenHand,
  resolveProgressionPhase08MonkOpenHand,
} from "./progressionPhase08MonkOpenHand";
import {
  ROGUE_THIEF_CLASS_ID,
  THIEF_SUPREME_SNEAK_FEATURE_ID,
  THIEF_THIEFS_REFLEXES_FEATURE_ID,
  THIEF_USE_MAGIC_DEVICE_FEATURE_ID,
} from "./rogueThief";
import { ROGUE_THIEF_SUBCLASS_ID } from "./srdSubclassCatalog";
import {
  subclassFeatureChoiceId,
  syntheticSubclassFeatureSelection,
  type SrdSubclassProgressionState,
} from "./srdSubclassProgression";

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function selectedThiefAtLevel3(request:ProgressionRequest,targetLevel:number) {
  if (targetLevel !== 3) return false;
  const selection = request.selections[`progression.${ROGUE_THIEF_CLASS_ID}.3.subclass`];
  const option = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  const name = option?.startsWith("subclass:") ? option.slice("subclass:".length) : undefined;
  return name === classById(ROGUE_THIEF_CLASS_ID)?.srdSubclassName;
}

function isThief(state:ProgressionCharacterState,request:ProgressionRequest,targetLevel:number) {
  const subclassState = state as SrdSubclassProgressionState;
  return subclassState.subclassIds?.[ROGUE_THIEF_CLASS_ID] === ROGUE_THIEF_SUBCLASS_ID
    || state.classTracks.some((track) => track.classId === ROGUE_THIEF_CLASS_ID && track.subclassName === classById(ROGUE_THIEF_CLASS_ID)?.srdSubclassName)
    || selectedThiefAtLevel3(request,targetLevel);
}

function syntheticRequest(state:ProgressionCharacterState,request:ProgressionRequest,preview:ProgressionPlan) {
  if (preview.targetClassId !== ROGUE_THIEF_CLASS_ID || !isThief(state,request,preview.targetClassLevel)) return request;
  if (![9,13,17].includes(preview.targetClassLevel)) return request;
  return {
    ...request,
    selections:{
      ...request.selections,
      [subclassFeatureChoiceId(ROGUE_THIEF_CLASS_ID,preview.targetClassLevel)]:{
        kind:"options" as const,
        optionIds:[syntheticSubclassFeatureSelection(ROGUE_THIEF_SUBCLASS_ID)],
      },
    },
  };
}

function buildInner(state:ProgressionCharacterState,request:ProgressionRequest) {
  const preview = buildProgressionPlanPhase08MonkOpenHand(state,request);
  const synthetic = syntheticRequest(state,request,preview);
  return {
    syntheticRequest:synthetic,
    plan:synthetic === request ? preview : buildProgressionPlanPhase08MonkOpenHand(state,synthetic),
  };
}

function featureIdsForLevel(level:number) {
  if (level === 9) return [THIEF_SUPREME_SNEAK_FEATURE_ID];
  if (level === 13) return [THIEF_USE_MAGIC_DEVICE_FEATURE_ID];
  if (level === 17) return [THIEF_THIEFS_REFLEXES_FEATURE_ID];
  return [];
}

function featureLabel(level:number) {
  if (level === 9) return "최고의 은신";
  if (level === 13) return "마법 장치 사용";
  if (level === 17) return "도둑의 반사 신경";
  return "";
}

function featureSource(level:number) {
  return `도둑 · 로그 ${level}레벨 · SRD 5.2.1`;
}

export function buildProgressionPlanPhase08RogueThief(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const { plan:basePlan } = buildInner(state,request);
  if (basePlan.targetClassId !== ROGUE_THIEF_CLASS_ID || !isThief(state,request,basePlan.targetClassLevel)) return basePlan;
  const level = basePlan.targetClassLevel;
  if (![9,13,17].includes(level)) return basePlan;
  const coreSubclassId = subclassFeatureChoiceId(ROGUE_THIEF_CLASS_ID,level);
  const choices = basePlan.choices.filter((choice) => choice.id !== coreSubclassId);
  const label = featureLabel(level);
  const diffs = label
    ? [...basePlan.diffs,{ label:"서브클래스 특성", before:"—", after:label, source:featureSource(level) }]
    : basePlan.diffs;
  return { ...basePlan, choices, diffs };
}

function persist(state:SrdSubclassProgressionState,plan:ProgressionPlan) {
  const level = plan.targetClassLevel;
  state.subclassIds = { ...(state.subclassIds ?? {}), [ROGUE_THIEF_CLASS_ID]:ROGUE_THIEF_SUBCLASS_ID };
  const featureIds = featureIdsForLevel(level);
  if (!featureIds.length) return;
  state.subclassFeatureIds = unique([...(state.subclassFeatureIds ?? []),...featureIds]);
  state.subclassFeatureSources = { ...(state.subclassFeatureSources ?? {}) };
  for (const featureId of featureIds) state.subclassFeatureSources[featureId] = featureSource(level);
  state.features = unique([...state.features,...featureIds]);
}

export function resolveProgressionPhase08RogueThief(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08RogueThief(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const { syntheticRequest } = buildInner(state,request);
  const base = resolveProgressionPhase08MonkOpenHand(state,syntheticRequest);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (plan.targetClassId !== ROGUE_THIEF_CLASS_ID || !isThief(state,request,plan.targetClassLevel)) {
    return { status:"committed", state:base.state, plan };
  }
  const next = structuredClone(base.state) as SrdSubclassProgressionState;
  persist(next,plan);
  return { status:"committed", state:next, plan };
}

export function thiefSyntheticSelectionsForPlan(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
  plan:ProgressionPlan,
) {
  return syntheticRequest(state,request,plan).selections;
}
