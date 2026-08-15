import {
  registerCatalogPendingChoiceResolver,
  validateChoiceDefinitions,
  type ChoiceSelectionMap,
} from "./choiceDefinition";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08BarbarianPrimalKnowledge,
  resolveProgressionPhase08BarbarianPrimalKnowledge,
} from "./progressionPhase08BarbarianPrimalKnowledge";
import {
  championAdditionalFightingStyleChoice,
  resolveSrdSubclassId,
  selectedSubclassFeatureOption,
  srdSubclassRelationship,
  subclassFeatureChoiceId,
  syntheticSubclassFeatureSelection,
  SUBCLASS_AUTO_SELECTION_PREFIX,
  type SrdSubclassProgressionState,
} from "./srdSubclassProgression";

registerCatalogPendingChoiceResolver("phase08:srd-subclass-feature",(definition,selection) => {
  if (!definition.id.endsWith(".subclass-feature")) return undefined;
  const optionId = selection?.kind === "options" && selection.optionIds.length === 1 ? selection.optionIds[0] : undefined;
  if (optionId?.startsWith(SUBCLASS_AUTO_SELECTION_PREFIX)) return [];
  return undefined;
});

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function relationshipFor(state:ProgressionCharacterState,request:ProgressionRequest,plan:ProgressionPlan) {
  const subclassId = resolveSrdSubclassId({
    state:state as SrdSubclassProgressionState,
    classId:plan.targetClassId,
    targetClassLevel:plan.targetClassLevel,
    selections:request.selections,
  });
  if (!subclassId) return undefined;
  const relationship = srdSubclassRelationship(plan.targetClassId,subclassId,plan.targetClassLevel);
  return relationship ? { subclassId, relationship } : undefined;
}

function syntheticRequest(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
  targetClassId:string,
  targetClassLevel:number,
):ProgressionRequest {
  const subclassId = resolveSrdSubclassId({
    state:state as SrdSubclassProgressionState,
    classId:targetClassId,
    targetClassLevel,
    selections:request.selections,
  });
  if (!subclassId) return request;
  const relationship = srdSubclassRelationship(targetClassId,subclassId,targetClassLevel);
  if (!relationship || targetClassLevel === 3) return request;
  return {
    ...request,
    selections:{
      ...request.selections,
      [subclassFeatureChoiceId(targetClassId,targetClassLevel)]:{
        kind:"options",
        optionIds:[syntheticSubclassFeatureSelection(subclassId)],
      },
    },
  };
}

function basePlanWithSyntheticSubclass(state:ProgressionCharacterState,request:ProgressionRequest) {
  const preview = buildProgressionPlanPhase08BarbarianPrimalKnowledge(state,request);
  const synthetic = syntheticRequest(state,request,preview.targetClassId,preview.targetClassLevel);
  return synthetic === request
    ? { plan:preview, syntheticRequest:request }
    : { plan:buildProgressionPlanPhase08BarbarianPrimalKnowledge(state,synthetic), syntheticRequest:synthetic };
}

export function buildProgressionPlanPhase08Subclass(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const { plan:basePlan } = basePlanWithSyntheticSubclass(state,request);
  const materialized = relationshipFor(state,request,basePlan);
  if (!materialized) return basePlan;
  const { relationship } = materialized;
  const coreChoiceId = subclassFeatureChoiceId(basePlan.targetClassId,basePlan.targetClassLevel);
  const choices = basePlan.choices.filter((choice) => choice.id !== coreChoiceId);
  const blocking = [...basePlan.blocking];
  const warnings = [...basePlan.warnings];
  const diffs = [...basePlan.diffs];

  const actualChoice = championAdditionalFightingStyleChoice({
    state:state as SrdSubclassProgressionState,
    relationship,
    fightingStyleOptions:request.fightingStyleOptions ?? [],
  });
  if (actualChoice) {
    choices.push(actualChoice);
    const issues = validateChoiceDefinitions([actualChoice],request.selections);
    blocking.push(...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message));
    warnings.push(...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message));
    const selectedStyleId = selectedSubclassFeatureOption(actualChoice,request.selections);
    const selected = actualChoice.options.find((option) => option.id === selectedStyleId);
    if (selected) {
      diffs.push({ label:"서브클래스 특성 · 추가 전투 방식", before:"—", after:selected.label, source:actualChoice.source });
    }
  } else if (relationship.features.length) {
    diffs.push({
      label:"서브클래스 특성",
      before:"—",
      after:relationship.features.map((feature) => feature.label).join(", "),
      source:`${relationship.subclassId} · ${relationship.classLevel}레벨 · SRD 5.2.1`,
    });
  }

  return {
    ...basePlan,
    choices,
    blocking:unique(blocking),
    warnings:unique(warnings),
    diffs,
  };
}

function persistRelationship(
  state:SrdSubclassProgressionState,
  relationship:NonNullable<ReturnType<typeof srdSubclassRelationship>>,
  subclassId:string,
  request:ProgressionRequest,
  plan:ProgressionPlan,
) {
  state.subclassIds = { ...(state.subclassIds ?? {}), [relationship.classId]:subclassId };
  state.subclassFeatureIds = unique([...(state.subclassFeatureIds ?? []),...relationship.features.map((feature) => feature.id)]);
  state.subclassFeatureSources = { ...(state.subclassFeatureSources ?? {}) };
  const source = `${subclassId} · ${relationship.classLevel}레벨 · SRD 5.2.1`;
  for (const feature of relationship.features) state.subclassFeatureSources[feature.id] = source;
  state.features = unique([...state.features,...relationship.features.map((feature) => feature.id)]);

  if (relationship.choice === "fighting-style") {
    const choice = plan.choices.find((entry) => entry.id === subclassFeatureChoiceId(relationship.classId,relationship.classLevel));
    const styleId = selectedSubclassFeatureOption(choice,request.selections);
    if (styleId) {
      state.fightingStyleFeatIds = unique([...(state.fightingStyleFeatIds ?? []),styleId]);
      state.fightingStyleFeatSources = { ...(state.fightingStyleFeatSources ?? {}), [styleId]:choice?.source ?? source };
      state.features = unique([...state.features,styleId]);
    }
  }
}

export function resolveProgressionPhase08Subclass(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08Subclass(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const materialized = relationshipFor(state,request,plan);
  const baseRequest = syntheticRequest(state,request,plan.targetClassId,plan.targetClassLevel);
  const base = resolveProgressionPhase08BarbarianPrimalKnowledge(state,baseRequest);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (!materialized) return { status:"committed", state:base.state, plan };

  const next = structuredClone(base.state) as SrdSubclassProgressionState;
  persistRelationship(next,materialized.relationship,materialized.subclassId,request,plan);
  return { status:"committed", state:next, plan };
}

export function subclassSyntheticSelectionsForPlan(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
  plan:ProgressionPlan,
):ChoiceSelectionMap {
  return syntheticRequest(state,request,plan.targetClassId,plan.targetClassLevel).selections;
}
