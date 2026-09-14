/**
 * SRD 5.2.1 class option lists that are chosen at level-up: Eldritch Invocations, Metamagic, Cleric/Druid orders and
 * the Blessed Strikes / Elemental Fury choices. Fighting styles are feats (the feats module) and are not listed here.
 */
import type { ClassOptionDefinition } from "../../catalog/catalog";

export const ELDRITCH_INVOCATIONS: ClassOptionDefinition[] = [
  { id: "invocation.agonizing-blast", name: "고통스러운 폭발", nameEn: "Agonizing Blast", minLevel: 2, repeatable: true, targetKind: "damage-cantrip", description: "피해를 주는 워락 소마법 하나를 골라 그 피해 굴림에 매력 수정치를 더합니다." },
  { id: "invocation.armor-of-shadows", name: "그림자 갑옷", nameEn: "Armor of Shadows", minLevel: 1, description: "주문 슬롯 없이 자신에게 Mage Armor를 시전할 수 있습니다." },
  { id: "invocation.ascendant-step", name: "승천의 발걸음", nameEn: "Ascendant Step", minLevel: 5, description: "주문 슬롯 없이 자신에게 Levitate를 시전할 수 있습니다." },
  { id: "invocation.devils-sight", name: "악마의 시야", nameEn: "Devil's Sight", minLevel: 2, description: "120피트 안의 마법적·비마법적 어둠과 희미한 빛에서 정상적으로 볼 수 있습니다." },
  { id: "invocation.devouring-blade", name: "포식하는 칼날", nameEn: "Devouring Blade", minLevel: 12, prerequisiteOptionId: "invocation.thirsting-blade", description: "갈증 나는 칼날의 추가 공격이 두 번이 됩니다(공격 행동에 세 번 공격)." },
  { id: "invocation.eldritch-mind", name: "섬뜩한 정신", nameEn: "Eldritch Mind", minLevel: 1, description: "집중을 유지하는 건강 내성 굴림에 유리를 받습니다." },
  { id: "invocation.eldritch-smite", name: "섬뜩한 강타", nameEn: "Eldritch Smite", minLevel: 5, prerequisiteOptionId: "invocation.pact-of-the-blade", description: "계약 무기로 명중했을 때 계약 마법 슬롯을 소비해 1d8 + 슬롯 레벨당 1d8 역장 피해를 추가하고 거대형 이하 대상을 넘어뜨립니다." },
  { id: "invocation.eldritch-spear", name: "섬뜩한 창", nameEn: "Eldritch Spear", minLevel: 2, repeatable: true, targetKind: "damage-cantrip", description: "사거리 10피트 이상인 피해 워락 소마법 하나의 사거리를 워락 레벨 × 30피트만큼 늘립니다." },
  { id: "invocation.fiendish-vigor", name: "마귀의 활력", nameEn: "Fiendish Vigor", minLevel: 2, description: "주문 슬롯 없이 자신에게 False Life를 시전하며, 임시 HP 주사위는 최대값입니다." },
  { id: "invocation.gaze-of-two-minds", name: "두 정신의 시선", nameEn: "Gaze of Two Minds", minLevel: 5, description: "접촉한 자발적 생물의 감각을 통해 지각하고 그 공간에서 주문을 시전할 수 있습니다." },
  { id: "invocation.gift-of-the-depths", name: "심해의 선물", nameEn: "Gift of the Depths", minLevel: 5, description: "수중에서 숨 쉴 수 있고 이동 속도와 같은 수영 속도를 얻으며, 긴 휴식마다 1회 Water Breathing을 슬롯 없이 시전합니다." },
  { id: "invocation.gift-of-the-protectors", name: "수호자의 선물", nameEn: "Gift of the Protectors", minLevel: 9, prerequisiteOptionId: "invocation.pact-of-the-tome", description: "그림자의 서에 이름을 적은 생물이 HP 0이 되면 대신 1 HP로 남깁니다. 긴 휴식마다 1회." },
  { id: "invocation.investment-of-the-chain-master", name: "사슬 주인의 투자", nameEn: "Investment of the Chain Master", minLevel: 5, prerequisiteOptionId: "invocation.pact-of-the-chain", description: "사역마가 비행·수영 속도 40피트를 얻고, 추가 행동으로 공격을 지시할 수 있으며, 사역마의 공격이 마법으로 취급되고 내성 DC에 자신의 주문 DC를 씁니다." },
  { id: "invocation.lessons-of-the-first-ones", name: "태초의 존재의 가르침", nameEn: "Lessons of the First Ones", minLevel: 2, repeatable: true, targetKind: "origin-feat", description: "아직 갖지 않은 기원 재주 하나를 얻습니다." },
  { id: "invocation.lifedrinker", name: "생명 흡수자", nameEn: "Lifedrinker", minLevel: 9, prerequisiteOptionId: "invocation.pact-of-the-blade", description: "턴당 한 번, 계약 무기로 명중 시 1d6 괴저·정신·광휘 피해를 추가하고, 히트 다이스 하나를 소비해 그 주사위 + 건강 수정치만큼 회복할 수 있습니다." },
  { id: "invocation.mask-of-many-faces", name: "수많은 얼굴의 가면", nameEn: "Mask of Many Faces", minLevel: 2, description: "주문 슬롯 없이 Disguise Self를 시전할 수 있습니다." },
  { id: "invocation.master-of-myriad-forms", name: "무수한 형상의 지배자", nameEn: "Master of Myriad Forms", minLevel: 5, description: "주문 슬롯 없이 Alter Self를 시전할 수 있습니다." },
  { id: "invocation.misty-visions", name: "안개 낀 환영", nameEn: "Misty Visions", minLevel: 2, description: "주문 슬롯 없이 Silent Image를 시전할 수 있습니다." },
  { id: "invocation.one-with-shadows", name: "그림자와 하나", nameEn: "One with Shadows", minLevel: 5, description: "희미한 빛이나 어둠 속에서 주문 슬롯 없이 자신에게 Invisibility를 시전할 수 있습니다." },
  { id: "invocation.otherworldly-leap", name: "이계의 도약", nameEn: "Otherworldly Leap", minLevel: 2, description: "주문 슬롯 없이 자신에게 Jump를 시전할 수 있습니다." },
  { id: "invocation.pact-of-the-blade", name: "칼날의 계약", nameEn: "Pact of the Blade", minLevel: 1, description: "추가 행동으로 계약 무기를 소환하거나 마법 무기와 결속합니다. 계약 무기 공격에 매력을 쓸 수 있고, 무기는 주문 매개체가 됩니다." },
  { id: "invocation.pact-of-the-chain", name: "사슬의 계약", nameEn: "Pact of the Chain", minLevel: 1, description: "Find Familiar를 슬롯 없이 시전할 수 있고, 사역마는 임프·유사용·콰짓·스프라이트 같은 특별한 형태를 고를 수 있습니다." },
  { id: "invocation.pact-of-the-tome", name: "고서의 계약", nameEn: "Pact of the Tome", minLevel: 1, description: "그림자의 서를 얻습니다. 어느 목록에서든 소마법 셋과 의식 1레벨 주문 둘을 골라 항상 준비하고, 책은 주문 매개체가 됩니다." },
  { id: "invocation.repelling-blast", name: "밀쳐내는 폭발", nameEn: "Repelling Blast", minLevel: 2, repeatable: true, targetKind: "attack-cantrip", description: "공격 굴림으로 피해를 주는 워락 소마법 하나를 골라, 명중 시 대형 이하 대상을 10피트 밀어낼 수 있습니다." },
  { id: "invocation.thirsting-blade", name: "갈증 나는 칼날", nameEn: "Thirsting Blade", minLevel: 5, prerequisiteOptionId: "invocation.pact-of-the-blade", description: "계약 무기로 공격 행동을 할 때 두 번 공격할 수 있습니다." },
  { id: "invocation.visions-of-distant-realms", name: "먼 영역의 환영", nameEn: "Visions of Distant Realms", minLevel: 9, description: "주문 슬롯 없이 Arcane Eye를 시전할 수 있습니다." },
  { id: "invocation.whispers-of-the-grave", name: "무덤의 속삭임", nameEn: "Whispers of the Grave", minLevel: 7, description: "주문 슬롯 없이 Speak with Dead를 시전할 수 있습니다." },
  { id: "invocation.witch-sight", name: "마녀의 시야", nameEn: "Witch Sight", minLevel: 15, description: "30피트 범위의 진실시야를 얻습니다." },
];

export const METAMAGIC_OPTIONS: ClassOptionDefinition[] = [
  { id: "metamagic.careful-spell", name: "신중한 주문", nameEn: "Careful Spell", cost: 1, description: "내성 굴림을 요구하는 주문에서 매력 수정치(최소 1)명까지의 생물을 골라 내성에 자동 성공시키고, 성공 시 절반 피해인 주문이면 피해도 받지 않게 합니다." },
  { id: "metamagic.distant-spell", name: "원거리 주문", nameEn: "Distant Spell", cost: 1, description: "사거리 5피트 이상인 주문의 사거리를 두 배로 하거나, 접촉 주문의 사거리를 30피트로 만듭니다." },
  { id: "metamagic.empowered-spell", name: "강화 주문", nameEn: "Empowered Spell", cost: 1, description: "주문의 피해 주사위를 매력 수정치(최소 1)개까지 다시 굴려 새 결과를 씁니다. 다른 메타매직과 함께 쓸 수 있습니다." },
  { id: "metamagic.extended-spell", name: "연장 주문", nameEn: "Extended Spell", cost: 1, description: "지속시간이 1분 이상인 주문의 지속시간을 두 배(최대 24시간)로 하고, 집중 유지 내성 굴림에 유리를 받습니다." },
  { id: "metamagic.heightened-spell", name: "고양 주문", nameEn: "Heightened Spell", cost: 2, description: "내성 굴림을 요구하는 주문의 대상 하나가 그 주문의 첫 내성 굴림에 불리를 받게 합니다." },
  { id: "metamagic.quickened-spell", name: "신속 주문", nameEn: "Quickened Spell", cost: 2, description: "시전 시간이 행동인 주문을 이번 시전에 한해 추가 행동으로 시전합니다." },
  { id: "metamagic.seeking-spell", name: "추적 주문", nameEn: "Seeking Spell", cost: 1, description: "주문 공격 굴림이 빗나갔을 때 d20을 다시 굴립니다. 다른 메타매직과 함께 쓸 수 있습니다." },
  { id: "metamagic.subtle-spell", name: "은밀 주문", nameEn: "Subtle Spell", cost: 1, description: "언어와 동작 구성요소 없이, 그리고 소모되지 않고 비용이 없는 물질 구성요소 없이 주문을 시전합니다." },
  { id: "metamagic.transmuted-spell", name: "변환 주문", nameEn: "Transmuted Spell", cost: 1, description: "산성·냉기·화염·번개·독·천둥 피해를 주는 주문의 피해 유형을 그 목록의 다른 유형으로 바꿉니다." },
  { id: "metamagic.twinned-spell", name: "쌍둥이 주문", nameEn: "Twinned Spell", cost: 1, description: "상위 슬롯으로 대상을 하나 더 지정할 수 있는 주문을 시전할 때, 슬롯 레벨을 1 높인 것처럼 대상을 하나 더 지정합니다." },
];

export const BLESSED_STRIKES_OPTIONS: ClassOptionDefinition[] = [
  { id: "cleric.blessed-strikes.divine-strike", name: "신성한 일격", nameEn: "Divine Strike", description: "턴당 한 번 무기 공격이 명중하면 1d8(14레벨 2d8) 광휘 또는 괴저 피해를 추가합니다." },
  { id: "cleric.blessed-strikes.potent-spellcasting", name: "강력한 주문 시전", nameEn: "Potent Spellcasting", description: "클레릭 소마법의 피해 굴림에 지혜 수정치를 더합니다(14레벨: 소마법 피해 시 아군에게 지혜 수정치 두 배 임시 HP)." },
];

export const ELEMENTAL_FURY_OPTIONS: ClassOptionDefinition[] = [
  { id: "druid.elemental-fury.potent-spellcasting", name: "강력한 주문 시전", nameEn: "Potent Spellcasting", description: "드루이드 소마법의 피해 굴림에 지혜 수정치를 더합니다(15레벨: 사거리 10피트 이상 소마법 사거리 +300피트)." },
  { id: "druid.elemental-fury.primal-strike", name: "원초의 일격", nameEn: "Primal Strike", description: "턴당 한 번 무기나 야생 변신 공격이 명중하면 1d8(15레벨 2d8) 냉기·화염·번개·천둥 피해를 추가합니다." },
];

export const PALADIN_FIGHTING_STYLE_EXTRA: ClassOptionDefinition = { id: "paladin.blessed-warrior", name: "축복받은 전사", nameEn: "Blessed Warrior", description: "전투 방식 재주 대신 클레릭 소마법 두 개를 항상 준비합니다. 팔라딘 레벨을 얻을 때 하나를 바꿀 수 있습니다." };
export const RANGER_FIGHTING_STYLE_EXTRA: ClassOptionDefinition = { id: "ranger.druidic-warrior", name: "드루이드 전사", nameEn: "Druidic Warrior", description: "전투 방식 재주 대신 드루이드 소마법 두 개를 항상 준비합니다. 레인저 레벨을 얻을 때 하나를 바꿀 수 있습니다." };

export const SRD_CLASS_OPTIONS: Record<string, ClassOptionDefinition[]> = {
  "warlock.invocations": ELDRITCH_INVOCATIONS,
  "sorcerer.metamagic": METAMAGIC_OPTIONS,
  "cleric.blessed-strikes": BLESSED_STRIKES_OPTIONS,
  "druid.elemental-fury": ELEMENTAL_FURY_OPTIONS,
};
