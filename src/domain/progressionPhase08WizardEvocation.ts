import { validateChoiceDefinitions } from "./choiceDefinition";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import { classById } from "./progressionCatalog";
import {
  buildProgressionPlanPhase08SorcererDraconic,
  resolveProgressionPhase08SorcererDraconic,
} from "./progressionPhase08SorcererDraconic";
import { subclassFeatureChoiceId, syntheticSubclassFeatureSelection } from "./srdSubclassProgression";
import {
  EMPOWERED_EVOCATION_FEATURE_ID,
  EVOCATION_SAVANT_FEATURE_ID,
  evocationSavantChoice,
  OVERCHANNEL_FEATURE_ID,
  POTENT_CANTRIP_FEATURE_ID,
  SCULPT_SPELLS_FEATURE_ID,
  selectedEvocationSavantSpellIds,
  WIZARD_EVOCATION_CLASS_ID,
  WIZARD_EVOCATION_SUBCLASS_ID,
  type WizardEvocationProgressionState,
} from "./wizardEvocationProgression";
import { wizardSpellbookSelectionIds } from "./wizardProgressionChoices";

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function selectedEvocationAtLevel3(request:ProgressionRequest,targetLevel:number) {
  if (targetLevel !== 3) return false;
  const selection = request.selections[`progression.${WIZARD_EVOCATION_CLASS_ID}.3.subclass`];
  const option = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  const name = option?.startsWith("subclass:") ? option.slice("subclass:".length) : undefined;
  return name === classById(WIZARD_EVOCATION_CLASS_ID)?.srdSubclassName;
}

function isEvoker(state:ProgressionCharacterState,request:ProgressionRequest,targetLevel:number) {
  const evoker = state as WizardEvocationProgressionState;
  return evoker.subclassIds?.[WIZARD_EVOCATION_CLASS_ID] === WIZARD_EVOCATION_SUBCLASS_ID
    || state.classTracks.some((track) => track.classId === WIZARD_EVOCATION_CLASS_ID && track.subclassName === classById(WIZARD_EVOCATION_CLASS_ID)?.srdSubclassName)
    || selectedEvocationAtLevel3(request,targetLevel);
}

function syntheticRequest(state:ProgressionCharacterState,request:ProgressionRequest,preview:ProgressionPlan) {
  if (preview.targetClassId !== WIZARD_EVOCATION_CLASS_ID || !isEvoker(state,request,preview.targetClassLevel)) return request;
  if (![6,10,14].includes(preview.targetClassLevel)) return request;
  return {
    ...request,
    selections:{
      ...request.selections,
      [subclassFeatureChoiceId(WIZARD_EVOCATION_CLASS_ID,preview.targetClassLevel)]:{
        kind:"options" as const,
        optionIds:[syntheticSubclassFeatureSelection(WIZARD_EVOCATION_SUBCLASS_ID)],
      },
    },
  };
}

function buildInner(state:ProgressionCharacterState,request:ProgressionRequest) {
  const preview = buildProgressionPlanPhase08SorcererDraconic(state,request);
  const synthetic = syntheticRequest(state,request,preview);
  return { syntheticRequest:synthetic, plan:synthetic === request ? preview : buildProgressionPlanPhase08SorcererDraconic(state,synthetic) };
}

function featureIdsForLevel(level:number) {
  if (level === 3) return [EVOCATION_SAVANT_FEATURE_ID,POTENT_CANTRIP_FEATURE_ID];
  if (level === 6) return [SCULPT_SPELLS_FEATURE_ID];
  if (level === 10) return [EMPOWERED_EVOCATION_FEATURE_ID];
  if (level === 14) return [OVERCHANNEL_FEATURE_ID];
  return [];
}

function featureSource(level:number) {
  return `환기 학파 · 위저드 ${level}레벨 · SRD 5.2.1`;
}

export function buildProgressionPlanPhase08WizardEvocation(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const { plan:basePlan } = buildInner(state,request);
  if (basePlan.targetClassId !== WIZARD_EVOCATION_CLASS_ID || !isEvoker(state,request,basePlan.targetClassLevel)) return basePlan;
  const level = basePlan.targetClassLevel;
  const coreSubclassId = subclassFeatureChoiceId(WIZARD_EVOCATION_CLASS_ID,level);
  const choices = basePlan.choices.filter((choice) => ![6,10,14].includes(level) || choice.id !== coreSubclassId);
  const savant = evocationSavantChoice({
    state:state as WizardEvocationProgressionState,
    targetClassLevel:level,
    spellOptions:request.spellOptions,
  });
  if (savant) choices.push(savant);
  const issues = savant ? validateChoiceDefinitions([savant],request.selections) : [];
  const blocking = [
    ...basePlan.blocking,
    ...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
  ];
  const warnings = [
    ...basePlan.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  ];
  if (savant) {
    const ordinary = new Set(wizardSpellbookSelectionIds(request.selections,level));
    const duplicate = selectedEvocationSavantSpellIds(savant,request.selections).find((spellId) => ordinary.has(spellId));
    if (duplicate) blocking.push(`같은 주문을 일반 위저드 주문책 추가와 환기술 전문가 추가로 중복 선택할 수 없습니다: ${duplicate}`);
  }
  const diffs = [...basePlan.diffs];
  if (savant) {
    const selected = selectedEvocationSavantSpellIds(savant,request.selections)
      .map((id) => savant.options.find((option) => option.id === id)?.label ?? id);
    if (selected.length) diffs.push({ label:"환기술 전문가 · 주문책", before:"—", after:selected.join(", "), source:savant.source });
  }
  if (level === 3) diffs.push({ label:"서브클래스 특성", before:"—", after:"강력한 소마법", source:featureSource(3) });
  if (level === 6) diffs.push({ label:"서브클래스 특성", before:"—", after:"주문 조형", source:featureSource(6) });
  if (level === 10) diffs.push({ label:"서브클래스 특성", before:"—", after:"강화된 환기술", source:featureSource(10) });
  if (level === 14) diffs.push({ label:"서브클래스 특성", before:"—", after:"과충전", source:featureSource(14) });
  return { ...basePlan, choices, blocking:unique(blocking), warnings:unique(warnings), diffs };
}

function persist(state:WizardEvocationProgressionState,request:ProgressionRequest,plan:ProgressionPlan) {
  const level = plan.targetClassLevel;
  state.subclassIds = { ...(state.subclassIds ?? {}), [WIZARD_EVOCATION_CLASS_ID]:WIZARD_EVOCATION_SUBCLASS_ID };
  const featureIds = featureIdsForLevel(level);
  if (featureIds.length) {
    state.subclassFeatureIds = unique([...(state.subclassFeatureIds ?? []),...featureIds]);
    state.subclassFeatureSources = { ...(state.subclassFeatureSources ?? {}) };
    for (const featureId of featureIds) state.subclassFeatureSources[featureId] = featureSource(level);
    state.features = unique([...state.features,...featureIds]);
  }
  const savant = plan.choices.find((choice) => choice.id.endsWith(".evocation-savant"));
  const spellIds = selectedEvocationSavantSpellIds(savant,request.selections);
  if (spellIds.length) {
    state.spellbookSpellIds = unique([...(state.spellbookSpellIds ?? []),...spellIds]);
    state.spellbookSpellSources = { ...(state.spellbookSpellSources ?? {}) };
    for (const spellId of spellIds) state.spellbookSpellSources[spellId] = savant?.source ?? featureSource(level);
  }
}

export function resolveProgressionPhase08WizardEvocation(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08WizardEvocation(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const { syntheticRequest } = buildInner(state,request);
  const base = resolveProgressionPhase08SorcererDraconic(state,syntheticRequest);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (plan.targetClassId !== WIZARD_EVOCATION_CLASS_ID || !isEvoker(state,request,plan.targetClassLevel)) return { status:"committed", state:base.state, plan };
  const next = structuredClone(base.state) as WizardEvocationProgressionState;
  persist(next,request,plan);
  return { status:"committed", state:next, plan };
}

export function evocationSyntheticSelectionsForPlan(state:ProgressionCharacterState,request:ProgressionRequest,plan:ProgressionPlan) {
  return syntheticRequest(state,request,plan).selections;
}
