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

function availableWizardBookIds(args: {
  targetLevel: number;
  knownSpellbookIds: string[];
  selections: ChoiceSelectionMap;
}) {
  return new Set([
    ...args.knownSpellbookIds,
    ...wizardSpellbookSelectionIds(args.selections, args.targetLevel),
  ]);
}

function isActionCastingTime(value?: string) {
  return Boolean(value && /행동/.test(value) && !/보너스 행동|추가 행동|반응|reaction/i.test(value));
}

export function wizardSpellMasteryChoiceId(spellLevel: 1 | 2) {
  return `progression.${WIZARD_ID}.18.spell-mastery.${spellLevel}`;
}

export function wizardSpellMasteryLevelFromChoiceId(choiceId: string): 1 | 2 | undefined {
  if (choiceId === wizardSpellMasteryChoiceId(1)) return 1;
  if (choiceId === wizardSpellMasteryChoiceId(2)) return 2;
  return undefined;
}

export function isWizardSpellMasteryChoice(choiceId: string) {
  return wizardSpellMasteryLevelFromChoiceId(choiceId) !== undefined;
}

export function wizardSpellMasteryChoices(args: {
  targetLevel: number;
  knownSpellbookIds: string[];
  selections: ChoiceSelectionMap;
  spellOptions?: SpellPresentationOption[];
}): ChoiceDefinition[] {
  if (args.targetLevel !== 18) return [];
  const availableBookIds = availableWizardBookIds(args);
  const presentation = new Map((args.spellOptions ?? []).map((option) => [option.id, option]));
  return ([1,2] as const).map((spellLevel) => ({
    id:wizardSpellMasteryChoiceId(spellLevel),
    label:`주문 숙련 · ${spellLevel}레벨`,
    description:`주문책에 기록된 ${spellLevel}레벨 위저드 주문 중 시전 시간이 행동인 주문 하나를 주문 숙련으로 선택합니다. 이 주문은 항상 준비되며 최저 레벨로 시전할 때 주문 슬롯을 소비하지 않습니다.`,
    kind:"spell",
    count:1,
    required:true,
    status:"ready",
    source:"위저드 18레벨 · 주문 숙련 · SRD 5.2.1",
    options:classSpellListEntries(WIZARD_ID, spellLevel)
      .filter((entry) => entry.level === spellLevel && availableBookIds.has(entry.id))
      .map((entry) => {
        const display = presentation.get(entry.id);
        const action = isActionCastingTime(display?.castingTime);
        return {
          id:entry.id,
          label:display?.label ?? entry.nameEn,
          description:display?.description ?? `${spellLevel}레벨 위저드 주문`,
          disabledReason:display?.castingTime === undefined
            ? "시전 시간 metadata가 없어 주문 숙련 적격성을 확정할 수 없습니다."
            : !action
              ? "시전 시간이 행동인 주문만 주문 숙련으로 선택할 수 있습니다."
              : undefined,
        };
      }),
  }));
}

export function wizardSignatureSpellsChoiceId() {
  return `progression.${WIZARD_ID}.20.signature-spells`;
}

export function isWizardSignatureSpellsChoice(choiceId: string) {
  return choiceId === wizardSignatureSpellsChoiceId();
}

export function wizardSignatureSpellsChoice(args: {
  targetLevel: number;
  knownSpellbookIds: string[];
  selections: ChoiceSelectionMap;
  spellOptions?: SpellPresentationOption[];
}): ChoiceDefinition | undefined {
  if (args.targetLevel !== 20) return undefined;
  const availableBookIds = availableWizardBookIds(args);
  const presentation = new Map((args.spellOptions ?? []).map((option) => [option.id, option]));
  return {
    id:wizardSignatureSpellsChoiceId(),
    label:"대표 주문",
    description:"주문책에 기록된 3레벨 위저드 주문 두 개를 대표 주문으로 선택합니다. 두 주문은 항상 준비되며 각각 3레벨로 한 번 무료 시전할 수 있고 짧은 휴식 또는 긴 휴식 후 그 무료 시전을 회복합니다.",
    kind:"spell",
    count:2,
    required:true,
    status:"ready",
    source:"위저드 20레벨 · 대표 주문 · SRD 5.2.1",
    options:classSpellListEntries(WIZARD_ID, 3)
      .filter((entry) => entry.level === 3 && availableBookIds.has(entry.id))
      .map((entry) => ({
        id:entry.id,
        label:presentation.get(entry.id)?.label ?? entry.nameEn,
        description:presentation.get(entry.id)?.description ?? "3레벨 위저드 주문",
      })),
  };
}

export function wizardSignatureSpellResourceId(spellId: string) {
  return `resource:wizard.signature-spell:${spellId}`;
}
