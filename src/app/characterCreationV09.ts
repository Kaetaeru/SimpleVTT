import type {
  AbilityKey,
  AppSnapshot,
  CatalogEntry,
  CharacterCreateDraft,
  CharacterCreationOptionVm,
  CharacterCreationPlan,
  CharacterCreationSection,
  CharacterSheet,
  CharacterSummary,
  ItemInstanceVm,
  ValidationMessage,
} from "./contracts";
import { MockAdapter } from "./mockAdapter";

const cp = <T,>(value: T): T => structuredClone(value);
const abilityKeys: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const abilityModifier = (score: number) => Math.floor((score - 10) / 2);

type CreationState = {
  createDraft: CharacterCreateDraft | null;
  activeCharacter: CharacterSheet;
  characters: CharacterSummary[];
  edgeState: AppSnapshot["edgeState"];
  getSnapshot(): Promise<AppSnapshot>;
};

type ChoiceData = CharacterCreationOptionVm & { classId?: string };

const SPECIES: ChoiceData[] = [
  { id: "species.human", name: "인간", nameEn: "Human", summary: "다재다능한 종족", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["이동 30 ft", "중형", "종족 특성"], choices: [] },
  { id: "species.elf", name: "엘프", nameEn: "Elf", summary: "예리한 감각과 요정 혈통", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["이동 30 ft", "암시야", "요정 혈통"], choices: ["종족 계통 선택이 필요한 경우 ChoiceDefinition으로 추가"] },
  { id: "species.dwarf", name: "드워프", nameEn: "Dwarf", summary: "강인한 체질의 종족", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["암시야", "드워프 특성"], choices: [] },
  { id: "species.halfling", name: "하플링", nameEn: "Halfling", summary: "작고 민첩한 종족", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["소형", "하플링 특성"], choices: [] },
];

const BACKGROUNDS: ChoiceData[] = [
  { id: "background.soldier", name: "병사", nameEn: "Soldier", summary: "군사 경험을 가진 배경", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["운동 숙련", "위협 숙련", "배경 장비"], choices: [] },
  { id: "background.sage", name: "현자", nameEn: "Sage", summary: "연구와 학문에 익숙한 배경", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["비전 숙련", "역사 숙련", "배경 장비"], choices: [] },
  { id: "background.criminal", name: "범죄자", nameEn: "Criminal", summary: "은밀한 활동에 익숙한 배경", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["은신 숙련", "손재주 숙련", "배경 장비"], choices: [] },
  { id: "background.entertainer", name: "연예인", nameEn: "Entertainer", summary: "공연과 사교에 익숙한 배경", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["곡예 숙련", "공연 숙련", "배경 장비"], choices: [] },
];

const CLASSES: ChoiceData[] = [
  { id: "class.fighter", name: "전사", nameEn: "Fighter", summary: "무기와 방어구를 폭넓게 다루는 전투 클래스", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["Hit Die d10", "근력·건강 내성", "방어구·무기 숙련", "세컨드 윈드"], choices: ["전투 방식 1개"] },
  { id: "class.bard", name: "음유시인", nameEn: "Bard", summary: "기술과 마법을 함께 사용하는 지원 클래스", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["Hit Die d8", "민첩·매력 내성", "바드 주문 시전"], choices: ["기술 숙련", "현재 레벨 주문 선택"] },
  { id: "class.wizard", name: "마법사", nameEn: "Wizard", summary: "주문서를 통해 비전 마법을 연구하는 클래스", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["Hit Die d6", "지능·지혜 내성", "마법사 주문 시전"], choices: ["캔트립/주문 선택"] },
  { id: "class.cleric", name: "성직자", nameEn: "Cleric", summary: "신성 마법과 방어 능력을 가진 클래스", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["Hit Die d8", "지혜·매력 내성", "성직자 주문 시전"], choices: ["현재 레벨 주문 선택"] },
];

const FIGHTER_CHOICES: ChoiceData[] = [
  { id: "choice.fighting-style.defense", classId: "class.fighter", name: "전투 방식: 방어", nameEn: "Defense", summary: "방어구를 입은 동안 방어 능력을 강화합니다.", source: "SRD 5.2.1", selected: false, recommended: true, grants: ["전투 방식 RuleSource"], choices: [] },
  { id: "choice.fighting-style.archery", classId: "class.fighter", name: "전투 방식: 궁술", nameEn: "Archery", summary: "원거리 무기 사용에 특화된 선택입니다.", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["전투 방식 RuleSource"], choices: [] },
  { id: "choice.fighting-style.dueling", classId: "class.fighter", name: "전투 방식: 결투", nameEn: "Dueling", summary: "한 손 무기 전투에 특화된 선택입니다.", source: "SRD 5.2.1", selected: false, recommended: false, grants: ["전투 방식 RuleSource"], choices: [] },
];

const SPELL_CHOICES: Record<string, ChoiceData[]> = {
  "class.bard": [
    { id: "spell.healing-word", name: "치유의 단어", nameEn: "Healing Word", summary: "원거리 회복 주문", source: "SRD 5.2.1", selected: false, recommended: true, grants: ["Spell RuleSource", "Action"], choices: [] },
    { id: "spell.vicious-mockery", name: "신랄한 조롱", nameEn: "Vicious Mockery", summary: "지혜 내성을 요구하는 정신 공격", source: "Reference", selected: false, recommended: true, grants: ["Spell RuleSource", "Action"], choices: [] },
    { id: "spell.thunderwave", name: "천둥파", nameEn: "Thunderwave", summary: "여러 대상을 밀어내는 천둥 주문", source: "Reference", selected: false, recommended: false, grants: ["Spell RuleSource", "Action"], choices: [] },
  ],
  "class.wizard": [
    { id: "spell.magic-missile", name: "마법 미사일", nameEn: "Magic Missile", summary: "자동 명중하는 역장 주문", source: "Reference", selected: false, recommended: true, grants: ["Spell RuleSource", "Action"], choices: [] },
    { id: "spell.shield", name: "방패", nameEn: "Shield", summary: "공격에 반응하는 방어 주문", source: "Reference", selected: false, recommended: true, grants: ["Spell RuleSource", "Reaction"], choices: [] },
    { id: "spell.thunderwave", name: "천둥파", nameEn: "Thunderwave", summary: "근거리 범위 천둥 주문", source: "Reference", selected: false, recommended: false, grants: ["Spell RuleSource", "Action"], choices: [] },
  ],
  "class.cleric": [
    { id: "spell.healing-word", name: "치유의 단어", nameEn: "Healing Word", summary: "원거리 회복 주문", source: "SRD 5.2.1", selected: false, recommended: true, grants: ["Spell RuleSource", "Action"], choices: [] },
    { id: "spell.guiding-bolt", name: "인도하는 화살", nameEn: "Guiding Bolt", summary: "빛나는 원거리 주문 공격", source: "Reference", selected: false, recommended: true, grants: ["Spell RuleSource", "Action"], choices: [] },
    { id: "spell.sacred-flame", name: "신성한 불꽃", nameEn: "Sacred Flame", summary: "민첩 내성을 요구하는 신성 공격", source: "Reference", selected: false, recommended: false, grants: ["Spell RuleSource", "Action"], choices: [] },
  ],
};

const CLASS_SKILLS: Record<string, string[]> = {
  "class.fighter": ["운동", "곡예", "지각", "통찰", "생존", "위협"],
  "class.bard": ["곡예", "비전", "기만", "통찰", "지각", "공연", "설득", "손재주", "은신"],
  "class.wizard": ["비전", "역사", "통찰", "조사", "의학", "종교"],
  "class.cleric": ["역사", "통찰", "의학", "설득", "종교"],
};

const CLASS_META: Record<string, { hitDie: number; saves: string[]; recommended: AbilityKey[]; equipment: Array<{ id: string; label: string }>; features: string[] }> = {
  "class.fighter": { hitDie: 10, saves: ["근력", "건강"], recommended: ["str", "con"], equipment: [{ id: "chain-shield", label: "체인 메일 + 방패 + 롱소드" }, { id: "leather-kit", label: "가죽 갑옷 + 롱소드 + 숏보우" }], features: ["세컨드 윈드"] },
  "class.bard": { hitDie: 8, saves: ["민첩", "매력"], recommended: ["cha", "dex"], equipment: [{ id: "leather-kit", label: "가죽 갑옷 + 레이피어 + 악기" }, { id: "bard-pack", label: "가죽 갑옷 + 단검 + 악기" }], features: ["바드 주문 시전"] },
  "class.wizard": { hitDie: 6, saves: ["지능", "지혜"], recommended: ["int", "con"], equipment: [{ id: "wizard-focus", label: "주문서 + 비전 매개체 + 단검" }, { id: "wizard-component", label: "주문서 + 구성요소 주머니 + 단검" }], features: ["주문서", "마법사 주문 시전"] },
  "class.cleric": { hitDie: 8, saves: ["지혜", "매력"], recommended: ["wis", "con"], equipment: [{ id: "chain-shield", label: "체인 메일 + 방패 + 메이스" }, { id: "scale-shield", label: "스케일 메일 + 방패 + 메이스" }], features: ["성직자 주문 시전"] },
};

const optionWithSelection = (options: ChoiceData[], selected: string | string[] | undefined) => {
  const selectedValues = Array.isArray(selected) ? selected : [selected];
  return options.map((option) => ({ ...option, selected: selectedValues.includes(option.id) || selectedValues.includes(option.name) }));
};

function classId(draft: CharacterCreateDraft) {
  return CLASSES.find((entry) => entry.name === draft.className)?.id ?? "class.fighter";
}

function planValidation(draft: CharacterCreateDraft): ValidationMessage[] {
  const messages = [...draft.validation];
  if (!draft.species) messages.push({ severity: "blocking", message: "종족을 선택해야 합니다." });
  if (!draft.background) messages.push({ severity: "blocking", message: "배경을 선택해야 합니다." });
  if (!draft.className) messages.push({ severity: "blocking", message: "클래스를 선택해야 합니다." });
  const cId = classId(draft);
  if (cId === "class.fighter" && (draft.selectedClassChoices?.length ?? 0) !== 1) messages.push({ severity: "blocking", message: "현재 레벨의 전투 방식 Choice를 1개 선택해야 합니다." });
  const spells = SPELL_CHOICES[cId] ?? [];
  if (spells.length && draft.selectedSpells.length !== 2) messages.push({ severity: "blocking", message: `현재 레벨 주문 선택은 2개가 필요합니다. 현재 ${draft.selectedSpells.length}/2` });
  const allowedSkills = CLASS_SKILLS[cId] ?? [];
  const invalidSkills = draft.selectedSkills.filter((skill) => !allowedSkills.includes(skill));
  if (invalidSkills.length) messages.push({ severity: "warning", message: `현재 클래스 후보에 없는 기술 숙련이 있습니다: ${invalidSkills.join(", ")}` });
  return messages;
}

function sectionStatus(required: boolean, blocked: boolean, complete: boolean, warning = false): CharacterCreationSection["status"] {
  if (blocked) return "blocked";
  if (warning) return "warning";
  if (!required) return "not-applicable";
  return complete ? "complete" : "incomplete";
}

function buildPlan(draft: CharacterCreateDraft): CharacterCreationPlan {
  const cId = classId(draft);
  const classMeta = CLASS_META[cId] ?? CLASS_META["class.fighter"];
  const classChoices = cId === "class.fighter" ? FIGHTER_CHOICES : [];
  const spellChoices = SPELL_CHOICES[cId] ?? [];
  const selectedClassChoices = draft.selectedClassChoices ?? [];
  const validation = planValidation(draft);
  const abilityBlocking = draft.validation.some((message) => message.severity === "blocking" && /배열|Roll Slot|포인트 구매/.test(message.message));
  const sections: CharacterCreationSection[] = [
    { id: "rules", kind: "rules-profile", label: "규칙", description: "캐릭터의 규칙 의미와 호환 콘텐츠 범위를 결정합니다.", status: "complete", required: true, dependsOn: [], options: [{ id: draft.rulesProfileId, name: "D&D SRD 5.2.1", nameEn: "D&D SRD 5.2.1", summary: "초기 RulesProfile", source: "builtin", selected: true, recommended: true, grants: ["ko-KR 기본 표시", "SRD 기반 규칙 프로필"], choices: [] }], automaticGrants: ["RulesProfile identity/version 저장"], validation: [] },
    { id: "identity", kind: "identity", label: "정체성", description: "이름과 서술 정보는 규칙 선택과 분리합니다.", status: sectionStatus(true, false, Boolean(draft.name.trim())), required: true, dependsOn: [], options: [], automaticGrants: [], validation: validation.filter((m) => /이름/.test(m.message)) },
    { id: "species", kind: "species", label: "종족", description: "종족을 독립적으로 고르고 자동 부여와 후속 Choice를 확인합니다.", status: sectionStatus(true, false, Boolean(draft.species)), required: true, dependsOn: ["rules"], options: optionWithSelection(SPECIES, draft.species), automaticGrants: draft.species ? SPECIES.find((entry) => entry.name === draft.species)?.grants ?? [] : [], validation: [] },
    { id: "background", kind: "background", label: "배경", description: "배경은 클래스와 분리된 Character source입니다.", status: sectionStatus(true, false, Boolean(draft.background)), required: true, dependsOn: ["rules"], options: optionWithSelection(BACKGROUNDS, draft.background), automaticGrants: draft.background ? BACKGROUNDS.find((entry) => entry.name === draft.background)?.grants ?? [] : [], validation: [] },
    { id: "class", kind: "class", label: "클래스", description: "현재 시작 레벨의 클래스 source만 선택합니다. 미래 서브클래스는 여기서 고르지 않습니다.", status: sectionStatus(true, false, Boolean(draft.className)), required: true, dependsOn: ["rules"], options: optionWithSelection(CLASSES, draft.className), automaticGrants: draft.className ? CLASSES.find((entry) => entry.name === draft.className)?.grants ?? [] : [], validation: [] },
    { id: "abilities", kind: "abilities", label: "능력치", description: "RulesProfile이 허용하는 방식으로 여섯 능력치를 생성합니다.", status: sectionStatus(true, !draft.className, !abilityBlocking), required: true, dependsOn: ["class"], options: [], automaticGrants: [], validation: draft.validation.filter((m) => /배열|Roll Slot|포인트 구매|커스텀/.test(m.message)) },
    { id: "proficiencies", kind: "proficiencies", label: "숙련 · 언어 · 도구", description: "자동 숙련은 확인만 하고 실제 선택만 처리합니다.", status: sectionStatus(true, !draft.className, draft.selectedSkills.length === 2, draft.selectedSkills.some((skill) => !(CLASS_SKILLS[cId] ?? []).includes(skill))), required: true, dependsOn: ["class", "background"], options: (CLASS_SKILLS[cId] ?? []).map((skill) => ({ id: `skill.${skill}`, name: skill, nameEn: skill, summary: "기술 숙련 Choice", source: draft.className || "Class", selected: draft.selectedSkills.includes(skill), recommended: false, grants: ["기술 숙련"], choices: [] })), automaticGrants: [`${classMeta.saves.join(" · ")} 내성`, "클래스/배경의 결정적 숙련 grants"], validation: validation.filter((m) => /기술 숙련|후보/.test(m.message)) },
    { id: "class-choices", kind: "class-choices", label: "클래스 초기 선택", description: "현재 레벨에서 실제로 열린 클래스 ChoiceDefinition만 표시합니다.", status: classChoices.length ? sectionStatus(true, !draft.className, selectedClassChoices.length === 1) : "not-applicable", required: classChoices.length > 0, dependsOn: ["class"], options: optionWithSelection(classChoices, selectedClassChoices), automaticGrants: classMeta.features, validation: validation.filter((m) => /전투 방식/.test(m.message)) },
    { id: "equipment", kind: "equipment", label: "장비", description: "시작 장비와 그 결과 ItemInstance를 별도 선택합니다.", status: sectionStatus(true, !draft.className, Boolean(draft.equipmentPreset)), required: true, dependsOn: ["class"], options: classMeta.equipment.map((entry) => ({ id: entry.id, name: entry.label, nameEn: entry.id, summary: "시작 장비 구성", source: draft.className || "Class", selected: draft.equipmentPreset === entry.id, recommended: entry.id === classMeta.equipment[0]?.id, grants: ["시작 ItemInstances", "장착 상태 및 파생값 재계산"], choices: [] })), automaticGrants: [], validation: [] },
    { id: "spells", kind: "spells", label: "주문 · 기타 선택", description: "현재 source graph가 주문 Choice를 만들 때만 활성화됩니다.", status: spellChoices.length ? sectionStatus(true, !draft.className, draft.selectedSpells.length === 2) : "not-applicable", required: spellChoices.length > 0, dependsOn: ["class"], options: optionWithSelection(spellChoices, draft.selectedSpells), automaticGrants: spellChoices.length ? ["클래스 주문 시전 RuleSource"] : [], validation: validation.filter((m) => /주문 선택/.test(m.message)) },
    { id: "review", kind: "review", label: "검토", description: "Source choices, AutomaticGrants, 파생값, validation과 provenance를 분리해 검토합니다.", status: validation.some((message) => message.severity === "blocking") ? "incomplete" : "complete", required: true, dependsOn: ["identity", "species", "background", "class", "abilities", "proficiencies", "equipment"], options: [], automaticGrants: [], validation },
  ];
  const recommended = sections.find((section) => section.status === "incomplete")?.id ?? "review";
  return {
    draftId: draft.id,
    rulesProfileId: draft.rulesProfileId,
    activeSectionId: draft.activeSectionId && sections.some((section) => section.id === draft.activeSectionId) ? draft.activeSectionId : recommended,
    recommendedSectionId: recommended,
    sections,
    summary: {
      name: draft.name,
      species: draft.species,
      background: draft.background,
      className: draft.className,
      level: draft.level,
      subclassName: draft.subclassName || undefined,
      abilities: cp(draft.abilities),
      unresolvedCount: sections.filter((section) => section.status === "incomplete" || section.status === "blocked").length,
      blockingCount: validation.filter((message) => message.severity === "blocking").length,
      warningCount: validation.filter((message) => message.severity === "warning").length,
    },
    validation,
  };
}

function normalizeDraft(draft: CharacterCreateDraft) {
  const cId = classId(draft);
  const meta = CLASS_META[cId] ?? CLASS_META["class.fighter"];
  if (!draft.activeSectionId) draft.activeSectionId = "identity";
  if (!draft.selectedClassChoices) draft.selectedClassChoices = cId === "class.fighter" ? [] : [];
  if (draft.level <= 1 && !draft.editingCharacterId) draft.subclassName = "";
  const con = abilityModifier(draft.abilities.con);
  const baseHp = meta.hitDie + con;
  const dex = abilityModifier(draft.abilities.dex);
  let ac = 10 + dex;
  if (draft.equipmentPreset === "chain-shield") ac = 18;
  else if (draft.equipmentPreset === "scale-shield") ac = 16;
  else if (draft.equipmentPreset === "leather-kit" || draft.equipmentPreset === "bard-pack") ac = 11 + dex;
  draft.derived = {
    proficiencyBonus: draft.level >= 5 ? 3 : 2,
    hp: draft.overrides.hp ?? Math.max(1, baseHp + Math.max(0, draft.level - 1) * Math.max(1, Math.floor(meta.hitDie / 2) + 1 + con)),
    ac: draft.overrides.ac ?? ac,
    speed: draft.overrides.speed ?? 30,
  };
  draft.validation = planValidation({ ...draft, validation: draft.validation.filter((message) => !/현재 레벨의 전투 방식|현재 레벨 주문 선택|종족을 선택|배경을 선택|클래스를 선택|후보에 없는 기술/.test(message.message)) });
  return draft;
}

function recommendedAbilities(draft: CharacterCreateDraft) {
  const cId = classId(draft);
  const [primary, secondary] = CLASS_META[cId]?.recommended ?? ["str", "con"];
  const remaining = abilityKeys.filter((key) => key !== primary && key !== secondary);
  const scores = [15, 14, 13, 12, 10, 8];
  const order = [primary, secondary, ...remaining];
  return Object.fromEntries(order.map((key, index) => [key, scores[index]])) as CharacterCreateDraft["abilities"];
}

function starterItems(draft: CharacterCreateDraft): ItemInstanceVm[] {
  const source = `${draft.className || "Class"} 시작 장비`;
  if (draft.className === "마법사") return [
    { id: "item.spellbook.new", definitionId: "item.spellbook", name: "주문서", kind: "equipment", quantity: 1, equipped: true, passiveEffects: ["준비/학습 주문의 source"], grantedActionIds: [], provenance: [source] },
    { id: "item.dagger.new", definitionId: "item.dagger", name: "단검", kind: "equipment", quantity: 1, equipped: true, passiveEffects: [], grantedActionIds: [], provenance: [source] },
  ];
  if (draft.className === "음유시인") return [
    { id: "item.leather.new", definitionId: "item.leather", name: "가죽 갑옷", kind: "equipment", quantity: 1, equipped: true, passiveEffects: ["기본 AC 11 + 민첩"], grantedActionIds: [], provenance: [source] },
    { id: "item.rapier.new", definitionId: "item.rapier", name: "레이피어", kind: "equipment", quantity: 1, equipped: true, passiveEffects: [], grantedActionIds: [], provenance: [source] },
  ];
  return [
    { id: "item.armor.new", definitionId: "item.starter-armor", name: draft.equipmentPreset === "chain-shield" ? "체인 메일" : "시작 방어구", kind: "equipment", quantity: 1, equipped: true, passiveEffects: [`AC ${draft.derived.ac}`], grantedActionIds: [], provenance: [source] },
    { id: "item.weapon.new", definitionId: "item.starter-weapon", name: draft.className === "성직자" ? "메이스" : "롱소드", kind: "equipment", quantity: 1, equipped: true, passiveEffects: [], grantedActionIds: [], provenance: [source] },
  ];
}

function sheetFromDraft(draft: CharacterCreateDraft): CharacterSheet {
  const cId = classId(draft);
  const meta = CLASS_META[cId] ?? CLASS_META["class.fighter"];
  const primary = meta.recommended[0];
  const abilityBonus = abilityModifier(draft.abilities[primary]);
  const proficiency = draft.derived.proficiencyBonus;
  const fightingStyle = draft.selectedClassChoices?.[0] ? FIGHTER_CHOICES.find((choice) => choice.id === draft.selectedClassChoices?.[0])?.name : undefined;
  const features = [...meta.features, ...(fightingStyle ? [fightingStyle] : [])];
  const attacks = draft.className === "마법사"
    ? [{ id: "action.dagger", name: "단검", bonus: proficiency + abilityModifier(draft.abilities.dex), damage: "1d4 + 민첩 관통" }]
    : [{ id: "action.starter-weapon", name: draft.className === "성직자" ? "메이스" : draft.className === "음유시인" ? "레이피어" : "롱소드", bonus: proficiency + abilityBonus, damage: "시작 무기 피해" }];
  return {
    id: `char.${draft.name.trim().toLowerCase().replace(/\s+/g, "-") || "new"}`,
    name: draft.name.trim() || "이름 없음",
    className: draft.className,
    subclassName: draft.subclassName || undefined,
    level: draft.level,
    species: draft.species,
    background: draft.background,
    hp: draft.derived.hp,
    maxHp: draft.derived.hp,
    tempHp: 0,
    ac: draft.derived.ac,
    speed: draft.derived.speed,
    proficiencyBonus: draft.derived.proficiencyBonus,
    saveState: "saved",
    abilities: cp(draft.abilities),
    saves: meta.saves.map((save) => `${save} +${proficiency}`),
    skills: cp(draft.selectedSkills),
    features,
    equipment: starterItems(draft).map((item) => item.name),
    items: starterItems(draft),
    resources: draft.className === "전사" ? [{ id: "resource.second-wind", label: "세컨드 윈드", current: 1, max: 1, source: "전사 1레벨" }] : [],
    attacks,
  };
}

const EXTRA_CATALOG: CatalogEntry[] = [
  ...CLASSES.filter((item) => item.id !== "class.fighter").map((item) => ({ id: item.id, category: "class" as const, nameKo: item.name, nameEn: item.nameEn, scope: "builtin" as const, source: item.source, version: "0.1", description: item.summary, relationships: [], capabilities: ["character-create", "progression"] })),
  ...SPECIES.filter((item) => item.id !== "species.human").map((item) => ({ id: item.id, category: "species" as const, nameKo: item.name, nameEn: item.nameEn, scope: "builtin" as const, source: item.source, version: "0.1", description: item.summary, relationships: [], capabilities: ["character-create"] })),
  ...BACKGROUNDS.filter((item) => item.id !== "background.soldier").map((item) => ({ id: item.id, category: "background" as const, nameKo: item.name, nameEn: item.nameEn, scope: "builtin" as const, source: item.source, version: "0.1", description: item.summary, relationships: [], capabilities: ["character-create"] })),
];

const originalGetSnapshot = MockAdapter.prototype.getSnapshot;
const originalCreateDraft = MockAdapter.prototype.createCharacterDraft;
const originalEditDraft = MockAdapter.prototype.editCharacterDraft;
const originalUpdateDraft = MockAdapter.prototype.updateCharacterDraft;
const originalFinalizeDraft = MockAdapter.prototype.finalizeCharacterDraft;

MockAdapter.prototype.getSnapshot = async function getSnapshotV09() {
  const snapshot = await originalGetSnapshot.call(this);
  if (snapshot.createDraft) {
    const draft = normalizeDraft(snapshot.createDraft);
    snapshot.createDraft = cp(draft);
    snapshot.creationPlan = buildPlan(draft);
  } else {
    snapshot.creationPlan = null;
  }
  for (const entry of EXTRA_CATALOG) if (!snapshot.catalog.some((existing) => existing.id === entry.id)) snapshot.catalog.push(cp(entry));
  return snapshot;
};

MockAdapter.prototype.createCharacterDraft = async function createCharacterDraftV09(mode = "guided") {
  await originalCreateDraft.call(this, mode);
  const state = this as unknown as CreationState;
  if (state.createDraft) {
    if (mode !== "duplicate") {
      state.createDraft.className = "";
      state.createDraft.subclassName = "";
      state.createDraft.species = "";
      state.createDraft.background = "";
      state.createDraft.selectedSkills = [];
      state.createDraft.selectedSpells = [];
      state.createDraft.selectedClassChoices = [];
      state.createDraft.equipmentPreset = "";
      state.createDraft.level = 1;
      state.createDraft.activeSectionId = mode === "import" ? "identity" : "identity";
    } else {
      state.createDraft.activeSectionId = "identity";
      state.createDraft.selectedClassChoices = state.createDraft.className === "전사" ? ["choice.fighting-style.defense"] : [];
    }
    normalizeDraft(state.createDraft);
  }
  return state.getSnapshot();
};

MockAdapter.prototype.editCharacterDraft = async function editCharacterDraftV09(characterId: string) {
  await originalEditDraft.call(this, characterId);
  const state = this as unknown as CreationState;
  if (state.createDraft) {
    state.createDraft.activeSectionId = "identity";
    state.createDraft.selectedClassChoices = state.createDraft.className === "전사" ? ["choice.fighting-style.defense"] : [];
    normalizeDraft(state.createDraft);
  }
  return state.getSnapshot();
};

MockAdapter.prototype.updateCharacterDraft = async function updateCharacterDraftV09(command) {
  const state = this as unknown as CreationState;
  if (!state.createDraft) await originalCreateDraft.call(this, "guided");
  if (!state.createDraft) return state.getSnapshot();

  if (command.type === "set-section") {
    state.createDraft.activeSectionId = String(command.value ?? "identity");
    return state.getSnapshot();
  }
  if (command.type === "toggle-class-choice") {
    const value = String(command.value ?? "");
    const current = state.createDraft.selectedClassChoices ?? [];
    state.createDraft.selectedClassChoices = current.includes(value) ? [] : [value];
    normalizeDraft(state.createDraft);
    return state.getSnapshot();
  }

  const previousClass = state.createDraft.className;
  await originalUpdateDraft.call(this, command);
  if (!state.createDraft) return state.getSnapshot();

  if (command.type === "set-class" && state.createDraft.className !== previousClass) {
    state.createDraft.subclassName = "";
    state.createDraft.selectedClassChoices = [];
    state.createDraft.selectedSpells = [];
    state.createDraft.selectedSkills = state.createDraft.selectedSkills.filter((skill) => (CLASS_SKILLS[classId(state.createDraft)] ?? []).includes(skill));
    state.createDraft.equipmentPreset = CLASS_META[classId(state.createDraft)]?.equipment[0]?.id ?? "";
  }
  if (command.type === "apply-recommended-array") state.createDraft.abilities = recommendedAbilities(state.createDraft);
  if (command.type === "import-json" && state.createDraft.importStatus === "valid") {
    state.createDraft.subclassName = state.createDraft.level > 1 ? state.createDraft.subclassName : "";
    state.createDraft.activeSectionId = "review";
  }
  normalizeDraft(state.createDraft);
  return state.getSnapshot();
};

MockAdapter.prototype.finalizeCharacterDraft = async function finalizeCharacterDraftV09() {
  const state = this as unknown as CreationState;
  const draft = state.createDraft;
  if (!draft) return originalFinalizeDraft.call(this);
  normalizeDraft(draft);
  const plan = buildPlan(draft);
  if (state.edgeState === "save-error" || plan.validation.some((message) => message.severity === "blocking")) return state.getSnapshot();
  if (draft.editingCharacterId) return originalFinalizeDraft.call(this);

  const sheet = sheetFromDraft(draft);
  state.activeCharacter = cp(sheet);
  state.characters = [...state.characters.filter((character) => character.id !== sheet.id), cp(sheet)];
  state.createDraft = null;
  return state.getSnapshot();
};

export { buildPlan as buildCharacterCreationPlanV09 };
