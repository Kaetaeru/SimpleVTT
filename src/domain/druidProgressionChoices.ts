import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import { classCantripListEntries } from "./spellListCatalog";

export const DRUID_ID = "dnd.srd521.class.druid";
export const DRUID_PRIMAL_ORDER_ID = `progression.${DRUID_ID}.1.primal-order`;
export const DRUID_MAGICIAN_CANTRIP_ID = `${DRUID_PRIMAL_ORDER_ID}.magician.cantrip`;
export const DRUID_ELEMENTAL_FURY_ID = `progression.${DRUID_ID}.7.elemental-fury`;

export const DRUID_MAGICIAN_OPTION = "feature:druid.primal-order.magician";
export const DRUID_WARDEN_OPTION = "feature:druid.primal-order.warden";
export const DRUID_POTENT_SPELLCASTING_OPTION = "feature:druid.elemental-fury.potent-spellcasting";
export const DRUID_PRIMAL_STRIKE_OPTION = "feature:druid.elemental-fury.primal-strike";

type SpellPresentationOption = { id: string; label: string; description?: string; level: number };

export function isDruidElementalFuryFeature(feature: string) {
  return feature === "원소의 격노" || feature === "원소의 분노" || feature === "Elemental Fury";
}

export function druidFeatureChoiceDefinitions(args: {
  feature: string;
  targetLevel: number;
  knownCantripIds: string[];
  selections: ChoiceSelectionMap;
  spellOptions?: SpellPresentationOption[];
}): ChoiceDefinition[] | undefined {
  const source = `드루이드 ${args.targetLevel}레벨 · SRD 5.2.1`;

  if (args.feature === "원초적 역할" && args.targetLevel === 1) {
    const parent: ChoiceDefinition = {
      id:DRUID_PRIMAL_ORDER_ID,
      label:"원초적 역할",
      description:"마법사 또는 수호자를 선택합니다.",
      kind:"feature-option",
      count:1,
      required:true,
      status:"ready",
      source,
      options:[
        {
          id:DRUID_MAGICIAN_OPTION,
          label:"마법사",
          description:"드루이드 소마법 하나를 추가로 알고 비전/자연 판정에 지혜 수정치 보너스를 얻습니다. 추가 소마법은 이 progression transaction에서 선택합니다.",
        },
        {
          id:DRUID_WARDEN_OPTION,
          label:"수호자",
          description:"군용 무기 숙련과 평장 방어구 훈련을 얻습니다. 해당 숙련/훈련의 구조화된 mechanics 적용은 별도 rules integration으로 추적합니다.",
        },
      ],
    };
    const result = [parent];
    const parentSelection = args.selections[parent.id];
    if (parentSelection?.kind === "options" && parentSelection.optionIds[0] === DRUID_MAGICIAN_OPTION) {
      const known = new Set(args.knownCantripIds);
      const presentation = new Map((args.spellOptions ?? []).map((option) => [option.id, option]));
      result.push({
        id:DRUID_MAGICIAN_CANTRIP_ID,
        label:"마법사 · 추가 소마법",
        description:"드루이드 주문 목록에서 아직 알지 못하는 소마법 하나를 추가로 배웁니다.",
        kind:"spell",
        count:1,
        required:true,
        status:"ready",
        source,
        options:classCantripListEntries(DRUID_ID).map((entry) => ({
          id:entry.id,
          label:presentation.get(entry.id)?.label ?? entry.nameEn,
          description:presentation.get(entry.id)?.description ?? "드루이드 소마법",
          disabledReason:known.has(entry.id) ? "이미 알고 있는 소마법입니다." : undefined,
        })),
      });
    }
    return result;
  }

  if (isDruidElementalFuryFeature(args.feature) && args.targetLevel === 7) {
    return [{
      id:DRUID_ELEMENTAL_FURY_ID,
      label:"원소의 격노",
      description:"강력한 주문 시전 또는 원초적 일격을 선택합니다. 선택은 캐릭터 상태에 보존되며 실제 피해 mechanics는 별도 rules integration에서 실행됩니다.",
      kind:"feature-option",
      count:1,
      required:true,
      status:"ready",
      source,
      options:[
        {
          id:DRUID_POTENT_SPELLCASTING_OPTION,
          label:"강력한 주문 시전",
          description:"드루이드 소마법으로 주는 피해에 지혜 수정치를 더하는 선택입니다.",
        },
        {
          id:DRUID_PRIMAL_STRIKE_OPTION,
          label:"원초적 일격",
          description:"턴마다 한 번 무기 또는 야생 변신 공격 명중 시 1d8 냉기, 화염, 번개, 천둥 피해 중 하나를 추가하는 선택입니다.",
        },
      ],
    }];
  }

  return undefined;
}

export function isDruidPersistentFeatureChoice(choiceId: string) {
  return choiceId === DRUID_PRIMAL_ORDER_ID || choiceId === DRUID_ELEMENTAL_FURY_ID;
}
