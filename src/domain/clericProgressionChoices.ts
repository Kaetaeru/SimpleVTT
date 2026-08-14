import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import { classCantripListEntries } from "./spellListCatalog";

export const CLERIC_ID = "dnd.srd521.class.cleric";
export const CLERIC_DIVINE_ORDER_ID = `progression.${CLERIC_ID}.1.divine-order`;
export const CLERIC_THAUMATURGE_CANTRIP_ID = `${CLERIC_DIVINE_ORDER_ID}.thaumaturge.cantrip`;
export const CLERIC_BLESSED_STRIKES_ID = `progression.${CLERIC_ID}.7.blessed-strikes`;

export const CLERIC_PROTECTOR_OPTION = "feature:cleric.divine-order.protector";
export const CLERIC_THAUMATURGE_OPTION = "feature:cleric.divine-order.thaumaturge";
export const CLERIC_DIVINE_STRIKE_OPTION = "feature:cleric.blessed-strikes.divine-strike";
export const CLERIC_POTENT_SPELLCASTING_OPTION = "feature:cleric.blessed-strikes.potent-spellcasting";

type SpellPresentationOption = { id: string; label: string; description?: string; level: number };

export function clericFeatureChoiceDefinitions(args: {
  feature: string;
  targetLevel: number;
  knownCantripIds: string[];
  selections: ChoiceSelectionMap;
  spellOptions?: SpellPresentationOption[];
}): ChoiceDefinition[] | undefined {
  const source = `클레릭 ${args.targetLevel}레벨 · SRD 5.2.1`;
  if (args.feature === "신성한 역할" && args.targetLevel === 1) {
    const parent: ChoiceDefinition = {
      id:CLERIC_DIVINE_ORDER_ID,
      label:"신성한 역할",
      description:"수호자 또는 기적술사를 선택합니다.",
      kind:"feature-option",
      count:1,
      required:true,
      status:"ready",
      source,
      options:[
        {
          id:CLERIC_PROTECTOR_OPTION,
          label:"수호자",
          description:"군용 무기 숙련과 중장 방어구 훈련을 얻습니다. 해당 숙련/훈련의 구조화된 mechanics 적용은 별도 rules integration으로 추적합니다.",
        },
        {
          id:CLERIC_THAUMATURGE_OPTION,
          label:"기적술사",
          description:"클레릭 소마법 하나를 추가로 알고 비전/종교 판정에 지혜 수정치 보너스를 얻습니다. 추가 소마법은 이 progression transaction에서 선택합니다.",
        },
      ],
    };
    const result = [parent];
    const parentSelection = args.selections[parent.id];
    if (parentSelection?.kind === "options" && parentSelection.optionIds[0] === CLERIC_THAUMATURGE_OPTION) {
      const known = new Set(args.knownCantripIds);
      const presentation = new Map((args.spellOptions ?? []).map((option) => [option.id, option]));
      result.push({
        id:CLERIC_THAUMATURGE_CANTRIP_ID,
        label:"기적술사 · 추가 소마법",
        description:"클레릭 주문 목록에서 아직 알지 못하는 소마법 하나를 추가로 배웁니다.",
        kind:"spell",
        count:1,
        required:true,
        status:"ready",
        source,
        options:classCantripListEntries(CLERIC_ID).map((entry) => ({
          id:entry.id,
          label:presentation.get(entry.id)?.label ?? entry.nameEn,
          description:presentation.get(entry.id)?.description ?? "클레릭 소마법",
          disabledReason:known.has(entry.id) ? "이미 알고 있는 소마법입니다." : undefined,
        })),
      });
    }
    return result;
  }

  if (args.feature === "축복받은 일격" && args.targetLevel === 7) {
    return [{
      id:CLERIC_BLESSED_STRIKES_ID,
      label:"축복받은 일격",
      description:"신성한 일격 또는 강력한 주문 시전을 선택합니다. 선택은 캐릭터 상태에 보존되며 전투 피해 mechanics는 별도 rules integration에서 실행됩니다.",
      kind:"feature-option",
      count:1,
      required:true,
      status:"ready",
      source,
      options:[
        {
          id:CLERIC_DIVINE_STRIKE_OPTION,
          label:"신성한 일격",
          description:"각 턴 한 번 무기 명중 시 1d8 사령 또는 광휘 추가 피해를 주는 선택입니다.",
        },
        {
          id:CLERIC_POTENT_SPELLCASTING_OPTION,
          label:"강력한 주문 시전",
          description:"클레릭 소마법 피해에 지혜 수정치를 더하는 선택입니다.",
        },
      ],
    }];
  }

  return undefined;
}

export function isClericPersistentFeatureChoice(choiceId: string) {
  return choiceId === CLERIC_DIVINE_ORDER_ID || choiceId === CLERIC_BLESSED_STRIKES_ID;
}
