import "./creationContracts";
import type { AbilityKey, CharacterCreateDraft, CharacterCreationOptionVm, CharacterCreationPlan, CharacterCreationSection, ValidationMessage } from "./contracts";
import { BACKGROUNDS, CLASSES, SPECIES, SKILL_LABELS, backgroundSkills, classIdFromName, classLoadoutOptions, classMeta, classSkillOptions, itemMechanic, opt, speciesDefinition, speciesTraits, type Option } from "./characterCreationV10Data";
import { classAndBackgroundLoadout, creationChoiceSpecs, finalAbilities, nonClassSkillNames, normalizeChoiceSelections, speciesAutomaticEffects } from "./characterCreationV10Choices";
import { decorateSpellOption } from "./spellPresentation";

const choose = (xs: Option[], value: string | string[] | undefined) => {
  const values = Array.isArray(value) ? value : [value];
  return xs.map((x) => ({ ...x, selected: values.includes(x.id) || values.includes(x.name) }));
};

const abilityLegacy = /배열|Roll Slot|포인트 구매|커스텀 능력치|수동 Override/;
const status = (required: boolean, blocked: boolean, done: boolean): CharacterCreationSection["status"] => blocked ? "blocked" : !required ? "not-applicable" : done ? "complete" : "incomplete";
const abilityMod = (score: number) => Math.floor((score - 10) / 2);

function equipmentAc(draft: CharacterCreateDraft, dexMod: number) {
  const { items } = classAndBackgroundLoadout(draft);
  let armorAc: number | undefined;
  let shield = 0;
  let hasArmor = false;
  let hasShield = false;
  for (const item of items) {
    const armor = itemMechanic(item.entry, "armor-definition") as { ac?: { base?: number; dex?: string; dexMax?: number } } | undefined;
    const shieldDef = itemMechanic(item.entry, "shield-definition") as { acBonus?: number } | undefined;
    if (armor?.ac?.base !== undefined) {
      hasArmor = true;
      const dex = armor.ac.dex === "full" ? dexMod : armor.ac.dexMax !== undefined ? Math.min(dexMod, armor.ac.dexMax) : 0;
      armorAc = Math.max(armorAc ?? -Infinity, armor.ac.base + dex);
    }
    if (shieldDef?.acBonus) { hasShield = true; shield += shieldDef.acBonus; }
  }
  return { ac:(armorAc ?? (10 + dexMod)) + shield, hasArmor, hasShield, shield };
}

export function validateCreationV10(draft: CharacterCreateDraft): ValidationMessage[] {
  const out = draft.validation.filter((item) => abilityLegacy.test(item.message));
  if (!draft.name.trim()) out.push({ severity:"blocking", message:"캐릭터 이름을 입력해야 합니다." });
  if (!draft.species) out.push({ severity:"blocking", message:"종족을 선택해야 합니다." });
  if (!draft.background) out.push({ severity:"blocking", message:"배경을 선택해야 합니다." });
  if (!draft.className) out.push({ severity:"blocking", message:"클래스를 선택해야 합니다." });
  if (draft.className) {
    const semantic = classMeta(classIdFromName(draft.className)).semantics;
    if (draft.selectedSkills.length !== semantic.skills.count) out.push({ severity:"blocking", message:`${draft.className} 기술 숙련은 ${semantic.skills.count}개가 필요합니다. 현재 ${draft.selectedSkills.length}/${semantic.skills.count}` });
    const loadouts = classLoadoutOptions(classIdFromName(draft.className));
    if (loadouts.length && !loadouts.some((item) => item.id === draft.equipmentPreset)) out.push({ severity:"blocking", message:"클래스 시작 장비 또는 시작 금화를 선택해야 합니다." });
  }
  for (const spec of creationChoiceSpecs(draft)) {
    if (spec.blocked) continue;
    const count = draft.choiceSelections?.[spec.id]?.length ?? 0;
    if (count !== spec.count) out.push({ severity:"blocking", message:`${spec.label}: ${spec.count}개 선택이 필요합니다. 현재 ${count}/${spec.count}` });
  }
  return out;
}

export function normalizeCreationV10(draft: CharacterCreateDraft) {
  draft.activeSectionId ||= "identity";
  draft.selectedClassChoices ??= [];
  draft.choiceSelections ??= {};
  if (draft.level <= 1 && !draft.editingCharacterId) draft.subclassName = "";
  normalizeChoiceSelections(draft);
  const abilities = finalAbilities(draft);
  draft.finalAbilities = abilities;
  const meta = classMeta(classIdFromName(draft.className));
  const dex = abilityMod(abilities.dex);
  const con = abilityMod(abilities.con);
  const speciesSpeed = speciesAutomaticEffects(draft).speed ?? speciesDefinition(draft.species).speed ?? 30;
  const loadout = classAndBackgroundLoadout(draft);
  draft.goldGp = loadout.gp;
  const equipment = equipmentAc(draft, dex);
  const classId = classIdFromName(draft.className);
  let automaticAc = equipment.ac;
  if (classId === "dnd.srd521.class.barbarian" && !equipment.hasArmor) automaticAc = Math.max(automaticAc, 10 + dex + con + equipment.shield);
  if (classId === "dnd.srd521.class.monk" && !equipment.hasArmor && !equipment.hasShield) automaticAc = Math.max(automaticAc, 10 + dex + abilityMod(abilities.wis));
  if (equipment.hasArmor && (draft.choiceSelections?.["class.fighting-style"] ?? []).includes("dnd.srd521.feat.fighting-style.defense")) automaticAc += 1;
  const speciesHp = speciesTraits(draft.species).includes("dwarven-toughness") ? draft.level : 0;
  draft.derived = {
    proficiencyBonus: draft.level >= 17 ? 6 : draft.level >= 13 ? 5 : draft.level >= 9 ? 4 : draft.level >= 5 ? 3 : 2,
    hp: draft.overrides.hp ?? Math.max(1, meta.hit + con + speciesHp),
    ac: draft.overrides.ac ?? automaticAc,
    speed: draft.overrides.speed ?? speciesSpeed,
  };
  draft.validation = validateCreationV10(draft);
  return draft;
}

function section(
  id: string,
  kind: CharacterCreationSection["kind"],
  label: string,
  description: string,
  sectionStatus: CharacterCreationSection["status"],
  required: boolean,
  dependsOn: string[],
  options: CharacterCreationOptionVm[] = [],
  automaticGrants: string[] = [],
  validation: ValidationMessage[] = [],
): CharacterCreationSection {
  return { id, kind, label, description, status:sectionStatus, required, dependsOn, options:options.map(decorateSpellOption), automaticGrants, validation };
}

function dynamicSections(draft: CharacterCreateDraft, validation: ValidationMessage[]) {
  return creationChoiceSpecs(draft).map((spec) => {
    const selected = draft.choiceSelections?.[spec.id] ?? [];
    const complete = selected.length === spec.count;
    const blocking = validation.filter((item) => item.message.startsWith(`${spec.label}:`));
    return {
      ...section(
        `choice:${spec.id}`,
        "dynamic-choice",
        spec.label,
        spec.description,
        status(true, Boolean(spec.blocked), complete),
        true,
        [spec.owner],
        spec.options.map((item) => ({ ...item, selected:selected.includes(item.id) })),
        spec.automaticGrants ?? [],
        blocking,
      ),
      selection: { choiceId:spec.id, count:spec.count },
    } satisfies CharacterCreationSection;
  });
}

export function buildCreationPlanV10(draft: CharacterCreateDraft): CharacterCreationPlan {
  normalizeChoiceSelections(draft);
  const validation = validateCreationV10(draft);
  const classId = classIdFromName(draft.className);
  const meta = classMeta(classId);
  const outsideSkills = new Set(nonClassSkillNames(draft));
  const skillOptions = draft.className ? classSkillOptions(classId).filter((item) => !outsideSkills.has(item.name)) : [];
  const abilityBlocking = validation.some((item) => item.severity === "blocking" && abilityLegacy.test(item.message));
  const classLoadouts = draft.className ? classLoadoutOptions(classId) : [];
  const classEquipment = section(
    "class-equipment",
    "equipment",
    "시작 장비",
    "클래스의 SRD 시작 장비 세트 또는 시작 금화를 선택합니다.",
    classLoadouts.length ? status(true, !draft.className, classLoadouts.some((item) => item.id === draft.equipmentPreset)) : "not-applicable",
    classLoadouts.length > 0,
    ["class"],
    classLoadouts.map((item) => ({ ...item, selected:item.id === draft.equipmentPreset })),
  );

  const primary: CharacterCreationSection[] = [
    section("rules", "rules-profile", "규칙", "규칙 의미와 호환 콘텐츠 범위를 결정합니다.", "complete", true, [], [{ ...opt(draft.rulesProfileId, "D&D SRD 5.2.1", "D&D SRD 5.2.1", "SRD RuleModule과 선언형 캐릭터 생성 인덱스를 사용합니다.", ["stable content IDs", "generic choices"]), selected:true }], ["RulesProfile identity/version 저장"]),
    section("identity", "identity", "정체성", "이름과 공용어 외 표준 언어 두 개를 정합니다.", status(true, false, Boolean(draft.name.trim())), true, []),
    section("species", "species", "종족", "SRD 종족과 해당 종족의 후속 선택을 정합니다.", status(true, false, Boolean(draft.species)), true, ["rules"], choose(SPECIES, draft.species), draft.species ? SPECIES.find((item) => item.name === draft.species)?.grants ?? [] : []),
    section("background", "background", "배경", "능력치 증가, 기원 재주, 도구와 배경 장비를 함께 정합니다.", status(true, false, Boolean(draft.background)), true, ["rules"], choose(BACKGROUNDS, draft.background), draft.background ? BACKGROUNDS.find((item) => item.name === draft.background)?.grants ?? [] : []),
    section("class", "class", "클래스", "12개 SRD 클래스와 해당 1레벨 선택을 정합니다.", status(true, false, Boolean(draft.className)), true, ["rules"], choose(CLASSES, draft.className), draft.className ? CLASSES.find((item) => item.name === draft.className)?.grants ?? [] : []),
    section("abilities", "abilities", "능력치", "RulesProfile 방식으로 기본 능력치를 정한 뒤 배경 증가를 적용합니다.", status(true, !draft.className, !abilityBlocking), true, ["class", "background"], [], [], validation.filter((item) => abilityLegacy.test(item.message))),
    section("proficiencies", "proficiencies", "기술 숙련", draft.className ? `${draft.className} 클래스 목록에서 기술 숙련 ${meta.semantics.skills.count}개를 선택합니다.` : "클래스를 먼저 선택합니다.", status(true, !draft.className, Boolean(draft.className) && draft.selectedSkills.length === meta.semantics.skills.count), true, ["class"], skillOptions.map((item) => ({ ...item, selected:draft.selectedSkills.includes(item.name) })), meta.saves.map((key) => `${key.toUpperCase()} 내성`), validation.filter((item) => item.message.includes("기술 숙련"))),
    section("review", "review", "검토", "모든 SRD source 선택과 최종 파생값을 검토합니다.", validation.some((item) => item.severity === "blocking") ? "incomplete" : "complete", true, ["identity", "species", "background", "class", "abilities", "proficiencies"], [], [], validation),
  ];
  const dynamic = dynamicSections(draft, validation);
  const sections = [primary[0], ...primary.slice(1, 4), primary[4], classEquipment, ...primary.slice(5, 7), ...dynamic, primary[7]];
  const unresolved = sections.filter((item) => item.status === "incomplete" || item.status === "blocked");
  const unresolvedPrimary = unresolved.map((item) => item.dependsOn[0] ?? item.id).find((id) => ["identity","species","background","class","abilities","proficiencies","review"].includes(id));
  const recommended = unresolvedPrimary ?? (validation.some((item) => item.severity === "blocking") ? "review" : "review");
  return {
    draftId:draft.id,
    rulesProfileId:draft.rulesProfileId,
    activeSectionId:sections.some((item) => item.id === draft.activeSectionId) ? draft.activeSectionId! : recommended,
    recommendedSectionId:recommended,
    sections,
    summary:{
      name:draft.name,
      species:draft.species,
      background:draft.background,
      className:draft.className,
      subclassName:draft.subclassName || undefined,
      level:draft.level,
      abilities:structuredClone(draft.finalAbilities ?? draft.abilities),
      unresolvedCount:unresolved.length,
      blockingCount:validation.filter((item) => item.severity === "blocking").length,
      warningCount:validation.filter((item) => item.severity === "warning").length,
    },
    validation,
  };
}

export function recommendedAbilitiesV10(draft: CharacterCreateDraft) {
  const [a, b] = classMeta(classIdFromName(draft.className)).rec;
  const rest = (Object.keys(draft.abilities) as AbilityKey[]).filter((key) => key !== a && key !== b);
  const values = [15,14,13,12,10,8];
  return Object.fromEntries([a,b,...rest].map((key,index) => [key, values[index]])) as CharacterCreateDraft["abilities"];
}
