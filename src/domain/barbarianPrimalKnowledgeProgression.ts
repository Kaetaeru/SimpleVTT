import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import { classSkillOptions } from "./classSkillCatalog";
import type { ProgressionCharacterState } from "./progression";

export const BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID = "dnd.srd521.class.barbarian";

export function barbarianPrimalKnowledgeChoiceId(classLevel:number) {
  return `progression.${BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID}.${classLevel}.원초적 지식`;
}

export function barbarianPrimalKnowledgeChoice(state:ProgressionCharacterState,targetClassLevel:number):ChoiceDefinition|undefined {
  if (targetClassLevel !== 3) return undefined;
  const known = new Set(state.proficientSkills ?? []);
  return {
    id:barbarianPrimalKnowledgeChoiceId(3),
    label:"원초적 지식",
    description:"바바리안 1레벨 기술 목록에서 아직 숙련되지 않은 기술 하나를 추가로 선택합니다.",
    kind:"skill",
    count:1,
    required:true,
    status:"ready",
    source:"바바리안 3레벨 · 원초적 지식 · SRD 5.2.1",
    options:classSkillOptions(BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID).map((skill) => ({
      id:`skill:${skill.id}`,
      label:skill.label,
      description:"바바리안 기술 숙련 후보",
      disabledReason:known.has(skill.label) ? "이미 숙련된 기술입니다." : undefined,
    })),
  };
}

export function selectedPrimalKnowledgeSkill(choice:ChoiceDefinition|undefined,selections:ChoiceSelectionMap) {
  if (!choice) return undefined;
  const selection = selections[choice.id];
  const optionId = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  return optionId ? choice.options.find((option) => option.id === optionId) : undefined;
}
