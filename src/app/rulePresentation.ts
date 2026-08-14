export type RulePresentationDetail = {
  description?: string;
  detailLines?: string[];
};

const FEAT_DESCRIPTIONS: Record<string, string> = {
  "dnd.srd521.feat.alert": "우선권 굴림에 숙련 보너스를 더하고, 우선권을 굴린 직후 자발적인 아군과 우선권 수치를 교환할 수 있습니다.",
  "dnd.srd521.feat.magic-initiate": "클레릭·드루이드·위저드 중 주문 목록 하나를 고르고 소마법 2개와 1레벨 주문 1개를 배웁니다. 1레벨 주문은 항상 준비되며 긴 휴식마다 주문 슬롯 없이 한 번 시전할 수 있습니다.",
  "dnd.srd521.feat.savage-attacker": "턴에 한 번 무기로 적중했을 때 그 무기의 피해 주사위를 두 번 굴리고 원하는 결과 하나를 사용할 수 있습니다.",
  "dnd.srd521.feat.skilled": "기술과 도구를 원하는 조합으로 세 개 선택해 숙련을 얻습니다. 반복해서 선택할 수 있습니다.",
  "dnd.srd521.feat.ability-score-improvement": "능력치 하나를 2 올리거나 서로 다른 능력치 두 개를 각각 1 올립니다. 이 재주로 능력치를 20보다 높일 수 없습니다.",
  "dnd.srd521.feat.grappler": "근력 또는 민첩을 1 올리고, 비무장 타격과 붙잡기를 결합하며, 자신이 붙잡은 대상에 대한 공격 이점과 더 효율적인 이동을 얻습니다.",
  "dnd.srd521.feat.fighting-style.archery": "원거리 무기를 사용하는 명중 굴림에 +2 보너스를 얻습니다.",
  "dnd.srd521.feat.fighting-style.defense": "경장·평장·중장 방어구를 입고 있는 동안 AC에 +1 보너스를 얻습니다.",
  "dnd.srd521.feat.fighting-style.great-weapon-fighting": "양손 또는 다용도 근접 무기로 피해를 굴릴 때 피해 주사위의 1이나 2를 3으로 취급할 수 있습니다.",
  "dnd.srd521.feat.fighting-style.two-weapon-fighting": "경량 속성으로 추가 공격을 할 때 음수가 아니라면 그 공격의 피해에 능력 수정치를 더할 수 있습니다.",
  "dnd.srd521.feat.epic.combat-prowess": "원하는 능력치를 1 올리고, 명중 굴림에 실패했을 때 대신 적중시킬 수 있는 비할 데 없는 조준을 얻습니다.",
  "dnd.srd521.feat.epic.dimensional-travel": "원하는 능력치를 1 올리고, 공격 행동이나 마법 행동 직후 볼 수 있는 빈 공간으로 최대 30피트 순간이동할 수 있습니다.",
  "dnd.srd521.feat.epic.fate": "원하는 능력치를 1 올리고, 60피트 이내 d20 판정 결과에 2d4 보너스 또는 페널티를 적용해 결과를 바꿀 수 있습니다.",
  "dnd.srd521.feat.epic.irresistible-offense": "근력 또는 민첩을 1 올리고, 피해 저항을 무시하며 자연 20 명중 때 추가 피해를 줄 수 있습니다.",
  "dnd.srd521.feat.epic.night-spirit": "민첩·지능·지혜·매력 중 하나를 1 올리고, 희미한 빛이나 어둠에서 투명화와 광범위한 피해 저항을 얻습니다.",
  "dnd.srd521.feat.epic.spell-recall": "지능·지혜·매력 중 하나를 1 올리고, 1~4레벨 주문 슬롯을 사용할 때 일정 확률로 슬롯이 소모되지 않게 합니다.",
  "dnd.srd521.feat.epic.truesight": "지능·지혜·매력 중 하나를 1 올리고 60피트 진시야를 얻습니다.",
};

const FEATURE_LABELS: Record<string, string> = {
  "fighter.second-wind": "재기의 바람",
  "fighter.fighting-style": "전투 방식",
  "fighter.weapon-mastery": "무기 통달",
  "barbarian.rage": "격노",
  "barbarian.unarmored-defense": "비무장 방어",
  "bard.bardic-inspiration": "바드의 영감",
  "cleric.spellcasting": "주문 시전",
  "druid.spellcasting": "주문 시전",
  "monk.martial-arts": "무술",
  "monk.unarmored-defense": "비무장 방어",
  "paladin.lay-on-hands": "치유의 손길",
  "paladin.spellcasting": "주문 시전",
  "ranger.favored-enemy": "주적",
  "ranger.spellcasting": "주문 시전",
  "rogue.sneak-attack": "암습",
  "rogue.thieves-cant": "도둑 은어",
  "sorcerer.innate-sorcery": "타고난 마법",
  "sorcerer.spellcasting": "주문 시전",
  "warlock.pact-magic": "계약 마법",
  "wizard.arcane-recovery": "비전 회복",
  "wizard.spellcasting": "주문 시전",
};

export function featDescription(id: string | undefined) {
  return id ? FEAT_DESCRIPTIONS[id] : undefined;
}

export function featureLabel(token: string) {
  if (FEATURE_LABELS[token]) return FEATURE_LABELS[token];
  const tail = token.split(".").at(-1) ?? token;
  return tail.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function featureDescription(token: string) {
  if (token.includes("spellcasting")) return "이 클래스가 제공하는 주문 시전 특성입니다. 준비 주문, 주문 목록과 주문 슬롯은 주문 시전 영역에서 따로 확인합니다.";
  if (token.includes("weapon-mastery")) return "선택한 무기의 통달 속성을 사용할 수 있게 하는 클래스 특성입니다.";
  return undefined;
}

export function compactRuleDetail(summary: string, description?: string, detailLines: string[] = []): RulePresentationDetail {
  return { description: description || summary, detailLines };
}
