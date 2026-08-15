import {
  registerCatalogPendingChoiceResolver,
  validateChoiceDefinitions,
} from "./choiceDefinition";
import {
  BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID,
  barbarianPrimalKnowledgeChoice,
  barbarianPrimalKnowledgeChoiceId,
  selectedPrimalKnowledgeSkill,
} from "./barbarianPrimalKnowledgeProgression";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08FighterStyle,
  resolveProgressionPhase08FighterStyle,
} from "./progressionPhase08FighterStyle";

registerCatalogPendingChoiceResolver("phase08:barbarian-primal-knowledge",(definition,selection) => {
  if (definition.id !== barbarianPrimalKnowledgeChoiceId(3) || definition.label !== "원초적 지식") return undefined;
  if (!selection) return [{ choiceId:definition.id, severity:"blocking", message:"원초적 지식 기술 선택이 필요합니다." }];
  if (selection.kind !== "options" || selection.optionIds.length !== 1) {
    return [{ choiceId:definition.id, severity:"blocking", message:"원초적 지식에서 기술 1개를 선택해야 합니다." }];
  }
  return [];
});

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function materializedChoice(state:ProgressionCharacterState,plan:ProgressionPlan) {
  if (plan.targetClassId !== BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID) return undefined;
  return barbarianPrimalKnowledgeChoice(state,plan.targetClassLevel);
}

export function buildProgressionPlanPhase08BarbarianPrimalKnowledge(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const basePlan = buildProgressionPlanPhase08FighterStyle(state,request);
  const choice = materializedChoice(state,basePlan);
  if (!choice) return basePlan;
  const issues = validateChoiceDefinitions([choice],request.selections);
  const blocking = unique([
    ...basePlan.blocking,
    ...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
  ]);
  const warnings = unique([
    ...basePlan.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  ]);
  const choices = [...basePlan.choices.filter((entry) => entry.id !== choice.id),choice];
  const diffs = [...basePlan.diffs];
  const selected = selectedPrimalKnowledgeSkill(choice,request.selections);
  if (selected) diffs.push({ label:"원초적 지식 · 기술 숙련", before:"—", after:selected.label, source:choice.source });
  return { ...basePlan, choices, blocking, warnings, diffs };
}

export function resolveProgressionPhase08BarbarianPrimalKnowledge(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08BarbarianPrimalKnowledge(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const base = resolveProgressionPhase08FighterStyle(state,request);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  const choice = materializedChoice(state,plan);
  const selected = selectedPrimalKnowledgeSkill(choice,request.selections);
  if (!choice || !selected) return { status:"committed", state:base.state, plan };

  const next = structuredClone(base.state);
  next.proficientSkills = unique([...(next.proficientSkills ?? []),selected.label]);
  next.features = unique([...next.features,"원초적 지식"]);
  return { status:"committed", state:next, plan };
}
