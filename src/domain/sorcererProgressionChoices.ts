import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";

export const SORCERER_ID = "dnd.srd521.class.sorcerer";

export interface MetamagicOptionDefinition {
  id: string;
  label: string;
  cost: number;
  description: string;
}

export const METAMAGIC_OPTIONS: readonly MetamagicOptionDefinition[] = [
  { id:"metamagic:careful-spell", label:"신중한 주문", cost:1, description:"내성 굴림을 요구하는 주문에서 매력 수정치만큼의 생물을 보호해 해당 내성에 자동 성공시키고, 성공 시 절반 피해라면 피해를 받지 않게 합니다." },
  { id:"metamagic:distant-spell", label:"원거리 주문", cost:1, description:"사거리 5피트 이상인 주문의 사거리를 두 배로 하거나, 접촉 주문의 사거리를 30피트로 만듭니다." },
  { id:"metamagic:empowered-spell", label:"강화 주문", cost:1, description:"주문 피해 주사위를 매력 수정치만큼 다시 굴립니다. 다른 메타매직과 함께 사용할 수 있습니다." },
  { id:"metamagic:extended-spell", label:"연장 주문", cost:1, description:"지속시간이 1분 이상인 주문의 지속시간을 최대 24시간까지 두 배로 하고, 집중 유지 내성 굴림에 이점을 얻습니다." },
  { id:"metamagic:heightened-spell", label:"고양 주문", cost:2, description:"내성 굴림을 요구하는 주문의 대상 하나가 그 주문에 대한 내성 굴림에 불리점을 받게 합니다." },
  { id:"metamagic:quickened-spell", label:"신속 주문", cost:2, description:"행동 시전 주문을 이번 시전에 한해 추가 행동으로 바꿉니다. 같은 턴의 1레벨 이상 주문 시전 제한을 따릅니다." },
  { id:"metamagic:seeking-spell", label:"추적 주문", cost:1, description:"주문 공격 굴림이 빗나갔을 때 d20을 다시 굴립니다. 다른 메타매직과 함께 사용할 수 있습니다." },
  { id:"metamagic:subtle-spell", label:"은밀 주문", cost:1, description:"소모되거나 비용이 명시된 물질 구성요소를 제외하고 언어, 동작, 물질 구성요소 없이 주문을 시전합니다." },
  { id:"metamagic:transmuted-spell", label:"변환 주문", cost:1, description:"산성, 냉기, 화염, 번개, 독, 천둥 피해 주문의 피해 유형을 그 목록의 다른 유형으로 바꿉니다." },
  { id:"metamagic:twinned-spell", label:"쌍둥이 주문", cost:1, description:"상위 레벨 슬롯으로 추가 대상을 지정할 수 있는 주문의 유효 레벨을 1 높여 추가 대상 효과를 얻습니다." },
];

export function sorcererMetamagicChoiceId(targetLevel: number) {
  return `progression.${SORCERER_ID}.${targetLevel}.metamagic`;
}

export function isSorcererMetamagicChoice(id: string) {
  return id.startsWith(`progression.${SORCERER_ID}.`) && id.endsWith(".metamagic");
}

export function sorcererMetamagicChoice(args: {
  targetLevel: number;
  knownMetamagicIds: string[];
}): ChoiceDefinition | undefined {
  if (![2,10,17].includes(args.targetLevel)) return undefined;
  const known = new Set(args.knownMetamagicIds);
  return {
    id:sorcererMetamagicChoiceId(args.targetLevel),
    label:"메타매직",
    description:args.targetLevel === 2
      ? "메타매직 옵션 두 개를 선택합니다."
      : "아직 알고 있지 않은 메타매직 옵션 두 개를 추가로 선택합니다.",
    kind:"feature-option",
    count:2,
    required:true,
    status:"ready",
    source:`소서러 ${args.targetLevel}레벨 · 메타매직 · SRD 5.2.1`,
    options:METAMAGIC_OPTIONS.map((option) => ({
      id:option.id,
      label:option.label,
      description:`소서리 포인트 ${option.cost} · ${option.description}`,
      disabledReason:known.has(option.id) ? "이미 알고 있는 메타매직입니다." : undefined,
    })),
  };
}

export function sorcererMetamagicReplacementFromId(targetLevel: number) {
  return `progression.${SORCERER_ID}.${targetLevel}.metamagic-replace.from`;
}

export function sorcererMetamagicReplacementToId(targetLevel: number) {
  return `progression.${SORCERER_ID}.${targetLevel}.metamagic-replace.to`;
}

export function isSorcererMetamagicReplacementChoice(id: string) {
  return id.startsWith(`progression.${SORCERER_ID}.`) && id.includes(".metamagic-replace.");
}

export function sorcererMetamagicReplacementChoices(args: {
  targetLevel: number;
  knownMetamagicIds: string[];
  selections: ChoiceSelectionMap;
}): ChoiceDefinition[] {
  if (args.targetLevel < 3 || args.knownMetamagicIds.length === 0) return [];
  const known = new Set(args.knownMetamagicIds);
  const additionSelection = args.selections[sorcererMetamagicChoiceId(args.targetLevel)];
  const additions = new Set(additionSelection?.kind === "options" ? additionSelection.optionIds : []);
  const fromId = sorcererMetamagicReplacementFromId(args.targetLevel);
  const fromSelection = args.selections[fromId];
  const selectedFrom = fromSelection?.kind === "options" ? fromSelection.optionIds[0] : undefined;
  const source = `소서러 ${args.targetLevel}레벨 · 메타매직 교체 · SRD 5.2.1`;
  const from: ChoiceDefinition = {
    id:fromId,
    label:"메타매직 교체 · 기존 옵션",
    description:"이번 소서러 레벨 상승에서 원한다면 알고 있는 메타매직 하나를 교체할 수 있습니다.",
    kind:"feature-option",
    count:1,
    required:false,
    status:"ready",
    source,
    options:METAMAGIC_OPTIONS.filter((option) => known.has(option.id)).map((option) => ({
      id:option.id,
      label:option.label,
      description:option.description,
    })),
  };
  if (!selectedFrom) return [from];
  const to: ChoiceDefinition = {
    id:sorcererMetamagicReplacementToId(args.targetLevel),
    label:"메타매직 교체 · 새 옵션",
    description:"기존 옵션을 대신해 아직 알고 있지 않은 메타매직 하나를 선택합니다.",
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source,
    options:METAMAGIC_OPTIONS.map((option) => ({
      id:option.id,
      label:option.label,
      description:`소서리 포인트 ${option.cost} · ${option.description}`,
      disabledReason:known.has(option.id)
        ? (option.id === selectedFrom ? "같은 옵션으로 교체할 수 없습니다." : "이미 알고 있는 메타매직입니다.")
        : additions.has(option.id)
          ? "이번 레벨에서 새로 추가하는 메타매직과 중복됩니다."
          : undefined,
    })),
  };
  return [from,to];
}
