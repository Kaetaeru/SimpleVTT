import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import { classSpellListEntries } from "./spellListCatalog";

export const WIZARD_ID = "dnd.srd521.class.wizard";
const SCHOLAR_SKILLS = ["비전","역사","조사","의학","자연","종교"] as const;

type SpellPresentationOption = { id: string; label: string; description?: string; level: number; castingTime?: string; school?: string };

export function wizardSpellbookChoiceId(targetLevel: number) {
  return `progression.${WIZARD_ID}.${targetLevel}.spellbook`;
}

export function wizardSpellbookSelectionIds(selections: ChoiceSelectionMap, targetLevel: number) {
  const selected = selections[wizardSpellbookChoiceId(targetLevel)];
  return selected?.kind === "options" ? selected.optionIds : [];
}

export function wizardSpellbookChoice(args: {
  targetLevel: number;
  maxSpellLevel: number;
  knownSpellbookIds: string[];
  spellOptions?: SpellPresentationOption[];
}): ChoiceDefinition {
  const count = args.targetLevel === 1 ? 6 : 2;
  const known = new Set(args.knownSpellbookIds);
  const presentation = new Map((args.spellOptions ?? []).map((option) => [option.id, option]));
  return {
    id:wizardSpellbookChoiceId(args.targetLevel),
    label:args.targetLevel === 1 ? "주문책 · 시작 주문 6개" : "주문책 · 연구 주문 +2",
    description:args.targetLevel === 1
      ? "1레벨 위저드 주문 6개를 주문책에 기록합니다."
      : `현재 사용할 수 있는 ${args.maxSpellLevel}레벨 이하 위저드 주문 2개를 주문책에 추가합니다.`,
    kind:"spell",
    count,
    required:true,
    status:"ready",
    source:`위저드 ${args.targetLevel}레벨 · 주문책 · SRD 5.2.1`,
    options:classSpellListEntries(WIZARD_ID, args.maxSpellLevel).map((entry) => ({
      id:entry.id,
      label:presentation.get(entry.id)?.label ?? entry.nameEn,
      description:presentation.get(entry.id)?.description ?? `${entry.level}레벨 위저드 주문`,
      disabledReason:known.has(entry.id) ? "이미 주문책에 기록된 주문입니다." : undefined,
    })),
  };
}

export function wizardScholarChoice(args: {
  targetLevel: number;
  proficientSkills: string[];
  expertiseSkills: string[];
}): ChoiceDefinition | undefined {
  if (args.targetLevel !== 2) return undefined;
  const proficient = new Set(args.proficientSkills);
  const expert = new Set(args.expertiseSkills);
  return {
    id:`progression.${WIZARD_ID}.2.scholar`,
    label:"학자",
    description:"비전, 역사, 조사, 의학, 자연, 종교 중 이미 숙련된 기술 하나에 전문화를 얻습니다.",
    kind:"expertise",
    count:1,
    required:true,
    status:"ready",
    source:"위저드 2레벨 · 학자 · SRD 5.2.1",
    options:SCHOLAR_SKILLS.filter((skill) => proficient.has(skill)).map((skill) => ({
      id:`skill:${skill}`,
      label:skill,
      description:"숙련된 학자 기술",
      disabledReason:expert.has(skill) ? "이미 전문화를 보유하고 있습니다." : undefined,
    })),
  };
}
