import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import type { ProgressionCharacterState, ProgressionRequest } from "./progression";
import { numericProgressionColumn } from "./progressionCatalog";
import { classSpellListAllEntries } from "./spellListCatalog";

export const WIZARD_EVOCATION_CLASS_ID = "dnd.srd521.class.wizard";
export const WIZARD_EVOCATION_SUBCLASS_ID = "dnd.srd521.subclass.wizard.school-of-evocation";
export const EVOCATION_SAVANT_FEATURE_ID = "dnd.srd521.feature.wizard.evocation-savant";
export const POTENT_CANTRIP_FEATURE_ID = "dnd.srd521.feature.wizard.potent-cantrip";
export const SCULPT_SPELLS_FEATURE_ID = "dnd.srd521.feature.wizard.sculpt-spells";
export const EMPOWERED_EVOCATION_FEATURE_ID = "dnd.srd521.feature.wizard.empowered-evocation";
export const OVERCHANNEL_FEATURE_ID = "dnd.srd521.feature.wizard.overchannel";

export interface WizardEvocationProgressionState extends ProgressionCharacterState {
  subclassIds?:Record<string,string>;
  subclassFeatureIds?:string[];
  subclassFeatureSources?:Record<string,string>;
}

export function evocationSavantChoiceId(classLevel:number) {
  return `progression.${WIZARD_EVOCATION_CLASS_ID}.${classLevel}.evocation-savant`;
}

function highestWizardSpellLevel(classLevel:number) {
  let highest = 0;
  for (let spellLevel=1; spellLevel<=9; spellLevel+=1) {
    if (numericProgressionColumn(WIZARD_EVOCATION_CLASS_ID,classLevel,String(spellLevel)) > 0) highest = spellLevel;
  }
  return highest;
}

export function evocationSavantUnlock(args:{ targetClassLevel:number }) {
  if (args.targetClassLevel === 3) return { count:2, minimumLevel:1, maximumLevel:2, exactLevel:undefined as number|undefined };
  const previous = highestWizardSpellLevel(args.targetClassLevel - 1);
  const current = highestWizardSpellLevel(args.targetClassLevel);
  if (current <= previous || current <= 2) return undefined;
  return { count:1, minimumLevel:current, maximumLevel:current, exactLevel:current };
}

function isEvocationSchool(value:string|undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "evocation" || normalized.includes("환기");
}

export function evocationSavantChoice(args:{
  state:WizardEvocationProgressionState;
  targetClassLevel:number;
  spellOptions:ProgressionRequest["spellOptions"];
}):ChoiceDefinition|undefined {
  const unlock = evocationSavantUnlock({ targetClassLevel:args.targetClassLevel });
  if (!unlock) return undefined;
  const presentation = new Map((args.spellOptions ?? []).map((option) => [option.id,option]));
  const known = new Set(args.state.spellbookSpellIds ?? []);
  const candidates = classSpellListAllEntries(WIZARD_EVOCATION_CLASS_ID)
    .filter((entry) => entry.level >= unlock.minimumLevel && entry.level <= unlock.maximumLevel)
    .filter((entry) => isEvocationSchool(presentation.get(entry.id)?.school));
  return {
    id:evocationSavantChoiceId(args.targetClassLevel),
    label:args.targetClassLevel === 3 ? "환기술 전문가 · 주문책 2개" : `환기술 전문가 · ${unlock.exactLevel}레벨 주문`,
    description:args.targetClassLevel === 3
      ? "1~2레벨 위저드 환기술 주문 두 개를 주문책에 추가합니다."
      : `새로 사용할 수 있게 된 ${unlock.exactLevel}레벨 위저드 환기술 주문 하나를 주문책에 추가합니다.`,
    kind:"spell",
    count:unlock.count,
    required:true,
    status:"ready",
    source:`환기 학파 · 위저드 ${args.targetClassLevel}레벨 · 환기술 전문가 · SRD 5.2.1`,
    options:candidates.map((entry) => ({
      id:entry.id,
      label:presentation.get(entry.id)?.label ?? entry.nameEn,
      description:presentation.get(entry.id)?.description ?? `${entry.level}레벨 위저드 환기술`,
      disabledReason:known.has(entry.id) ? "이미 주문책에 기록된 주문입니다." : undefined,
    })),
  };
}

export function selectedEvocationSavantSpellIds(choice:ChoiceDefinition|undefined,selections:ChoiceSelectionMap) {
  if (!choice) return [];
  const selection = selections[choice.id];
  return selection?.kind === "options" ? [...selection.optionIds] : [];
}
