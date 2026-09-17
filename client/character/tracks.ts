/**
 * Class tracks in the order the levels were gained: primary-class training and skills, multiclass prerequisites and
 * grants, every level row's features, the level-up choices (ASI/feat, epic boon, expertise, fighting style,
 * subclass and subclass options, mystic arcanum, blessed strikes…), and the class-wide pools whose size grows with
 * class level (weapon mastery, invocations, metamagic, resources, spells).
 */
import type { ClassLevelRow, ClassView } from "../catalog/catalog";
import type { IndexClassChoiceJson } from "../catalog/types";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KO } from "../catalog/types";
import {
  CLASS_RESOURCES, CLASS_TRAINING, COLUMN, DEFT_EXPLORER_LANGUAGES, EXPERTISE_SCHEDULE, METAMAGIC_KNOWN, numericColumn, SUBCLASS_LEVEL,
  type ArmorTraining, type WeaponTraining,
} from "../rules/classes";
import { MULTICLASS_PREREQUISITES } from "../rules/tables";
import { SRD_SUBCLASSES } from "../data/srd";
import type { SrdSubclassData } from "../data/srd/subclasses";
import {
  artisanToolOptions, classOptionList, featOptions, fixedOptions, instrumentOptions, invocationOptions, languageOptions, skillOptions, spellOptions,
  subclassOptions, toolName, weaponMasteryOptions, type FeatContext,
} from "./choices";
import { applyFeat } from "./feats";
import type { ClassState, Ledger } from "./ledger";
import { resolveToolId } from "./origin";
import { applyClassSpellcasting, classSpellEntry } from "./spells";

const ASI_FEAT_ID = "dnd.srd521.feat.ability-score-improvement";
const RECOVERY_KO: Record<string, string> = { "short-rest": "짧은 휴식", "long-rest": "긴 휴식", "short-rest:1": "긴 휴식 (짧은 휴식마다 1회 회복)", "short-rest:half": "긴 휴식 (짧은 휴식에 절반 회복)" };
const LAND_RESISTANCE: Record<string, string> = { arid: "fire", polar: "cold", temperate: "lightning", tropical: "poison" };

const featContext = (ledger: Ledger, hasFightingStyle = false): FeatContext => ({
  level: ledger.level,
  abilityScore: (key) => ledger.abilityScore(key),
  taken: (id) => ledger.feats.some((feat) => feat.id === id),
  hasSpellcasting: ledger.hasSpellcasting(),
  hasFightingStyle,
});

export function applyTracks(ledger: Ledger) {
  const { catalog, source } = ledger;
  if (source.tracks.length === 0) { ledger.blocking.push("직업을 고르세요 (1레벨)."); return; }
  if (source.tracks.length > 20) ledger.blocking.push("최대 레벨은 20입니다.");
  source.tracks.forEach((track, index) => {
    const cls = catalog.classById(track.classId);
    if (!cls) { ledger.blocking.push(`${index + 1}레벨의 직업 "${track.classId}"을(를) 찾을 수 없습니다.`); return; }
    let state = ledger.classes.get(cls.id);
    if (!state) {
      state = { classId: cls.id, slug: cls.slug, name: cls.name, level: 0, firstTrack: index, subclassChoices: {}, hitDie: cls.hitDie };
      ledger.classes.set(cls.id, state);
      if (index === 0) applyPrimaryClass(ledger, cls, index); else applyMulticlassEntry(ledger, cls, index);
    }
    state.level += 1;
    const row = cls.progression[state.level - 1];
    if (!row) { ledger.blocking.push(`${cls.name}의 ${state.level}레벨 표가 없습니다.`); return; }
    applyLevelRow(ledger, cls, state, row, index);
  });
  for (const state of ledger.classes.values()) {
    const cls = catalog.classById(state.classId);
    if (cls) applyClassWide(ledger, cls, state);
  }
}

function trainingOf(ledger: Ledger, cls: ClassView) {
  const known = CLASS_TRAINING[cls.slug];
  if (known) return known;
  const def = (ledger.catalog.entry(cls.id)?.mechanics.find((item) => item.kind === "class-definition")?.config ?? {}) as { armorTraining?: ArmorTraining[]; weaponTraining?: WeaponTraining[]; toolProficiencies?: string[]; multiclass?: { armor?: ArmorTraining[]; weapons?: WeaponTraining[]; skills?: number; tools?: string[] } };
  return { armor: def.armorTraining ?? [], weapons: def.weaponTraining ?? ["simple"], tools: def.toolProficiencies, multiclass: { armor: def.multiclass?.armor ?? [], weapons: def.multiclass?.weapons ?? [], skills: def.multiclass?.skills, tools: def.multiclass?.tools } };
}

function applyPrimaryClass(ledger: Ledger, cls: ClassView, index: number) {
  const { catalog } = ledger;
  const sourceLabel = `${cls.name} 1레벨`;
  for (const key of cls.savingThrows) ledger.saves.set(key, cls.name);
  const training = trainingOf(ledger, cls);
  for (const armor of training.armor) ledger.armor.add(armor);
  for (const weapon of training.weapons) ledger.weapons.add(weapon);
  for (const tool of training.tools ?? []) { const id = resolveToolId(ledger, tool); ledger.tools.set(id, toolName(catalog, id)); }
  const picked = ledger.ask({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.skills`, label: `기술 숙련 (${cls.skillChoice.count}개)`, count: cls.skillChoice.count, options: skillOptions(catalog, cls.skillChoice.options, (id) => ledger.hasSkill(id)) });
  for (const skill of picked) ledger.addSkill(skill, cls.name);
  applyLevel1Choices(ledger, cls, index, false);
}

function applyMulticlassEntry(ledger: Ledger, cls: ClassView, index: number) {
  const { catalog } = ledger;
  const sourceLabel = `${cls.name} 1레벨 (멀티클래스)`;
  const check = (slug: string, name: string) => {
    const rule = MULTICLASS_PREREQUISITES[slug];
    if (!rule) return;
    const ok = rule.all ? rule.all.every((key) => ledger.abilityScore(key) >= 13) : (rule.any ?? []).some((key) => ledger.abilityScore(key) >= 13);
    if (!ok) {
      const text = rule.all ? rule.all.map((key) => `${ABILITY_KO[key]} 13`).join("과 ") : (rule.any ?? []).map((key) => `${ABILITY_KO[key]} 13`).join(" 또는 ");
      ledger.blocking.push(`${index + 1}레벨에서 ${cls.name}을(를) 추가하려면 ${name}의 조건(${text})이 필요합니다.`);
    }
  };
  check(cls.slug, cls.name);
  for (const other of ledger.classes.values()) if (other.classId !== cls.id) check(other.slug, other.name);
  const training = trainingOf(ledger, cls);
  for (const armor of training.multiclass.armor) ledger.armor.add(armor);
  for (const weapon of training.multiclass.weapons) ledger.weapons.add(weapon);
  for (const tool of training.multiclass.tools ?? []) { const id = resolveToolId(ledger, tool); ledger.tools.set(id, toolName(catalog, id)); }
  if (training.multiclass.skills) {
    const picked = ledger.ask({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.skills`, label: `기술 숙련 (${training.multiclass.skills}개)`, count: training.multiclass.skills, options: skillOptions(catalog, cls.skillChoice.options, (id) => ledger.hasSkill(id)) });
    for (const skill of picked) ledger.addSkill(skill, cls.name);
  }
  if (training.multiclass.instruments) {
    const picked = ledger.ask({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.instruments`, label: `악기 숙련 (${training.multiclass.instruments}개)`, count: training.multiclass.instruments, options: instrumentOptions(catalog, (id) => ledger.tools.has(id)) });
    for (const id of picked) ledger.tools.set(id, toolName(catalog, id));
  }
  applyLevel1Choices(ledger, cls, index, true);
}

/** Level-1 choices from the creation index, except the ones the schedules below own (mastery, style, expertise, invocations). */
function applyLevel1Choices(ledger: Ledger, cls: ClassView, index: number, multiclass: boolean) {
  const { catalog } = ledger;
  const sourceLabel = `${cls.name} 1레벨`;
  const ask = { scope: "class" as const, sourceLabel, trackIndex: index };
  for (const choice of cls.level1Choices) {
    const id = `class.${index}.${choice.id.replace(/^class\./, "")}`;
    switch (choice.kind) {
      case "weapon-mastery":
      case "fighting-style":
      case "selected-skill-expertise":
        break;
      case "instrument-proficiency": {
        if (multiclass) break;
        const picked = ledger.ask({ ...ask, id, label: `${choice.label} (${choice.count}개)`, description: choice.description, count: choice.count, options: instrumentOptions(catalog, (item) => ledger.tools.has(item)) });
        for (const tool of picked) ledger.tools.set(tool, toolName(catalog, tool));
        break;
      }
      case "artisan-or-instrument": {
        if (multiclass) break;
        const picked = ledger.ask({ ...ask, id, label: choice.label, description: choice.description ?? "장인 도구 또는 악기 하나.", count: choice.count, options: [...artisanToolOptions(catalog, (item) => ledger.tools.has(item)), ...instrumentOptions(catalog, (item) => ledger.tools.has(item))] });
        for (const tool of picked) ledger.tools.set(tool, toolName(catalog, tool));
        break;
      }
      case "language": {
        if (multiclass) break;
        const pool = choice.languagePool === "general" ? "general" : "standard";
        const picked = ledger.ask({ ...ask, id, label: choice.label, description: choice.description, count: choice.count, options: [...languageOptions(catalog, "standard", (item) => ledger.languages.has(item)), ...(pool === "general" ? languageOptions(catalog, "general", (item) => ledger.languages.has(item)) : [])] });
        for (const language of picked) ledger.languages.set(language, [...catalog.languages.standard, ...catalog.languages.general].find((item) => item.id === language)?.name ?? language);
        break;
      }
      case "fixed-options": {
        if (choice.id === "class.eldritch-invocation") break;
        applyFixedOptionChoice(ledger, cls, choice, id, index);
        break;
      }
      default: {
        if (choice.options?.length) {
          const picked = ledger.ask({ ...ask, id, label: choice.label, description: choice.description, count: choice.count, options: fixedOptions(choice.options) });
          for (const optionId of picked) {
            const option = choice.options.find((item) => item.id === optionId);
            if (option) ledger.addFeature({ id: `${cls.id}.${choice.id}.${optionId}`, name: `${choice.label}: ${option.name}`, nameEn: option.nameEn, source: "class", sourceLabel, level: 1, description: option.summary, descriptionSource: "srd-summary" });
          }
        }
      }
    }
  }
}

/** Divine Order / Primal Order and other fixed option lists: the option becomes a feature and applies its training. */
function applyFixedOptionChoice(ledger: Ledger, cls: ClassView, choice: IndexClassChoiceJson, id: string, index: number) {
  const sourceLabel = `${cls.name} 1레벨`;
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id, label: choice.label, description: choice.description, options: fixedOptions(choice.options ?? []) });
  if (!picked) return;
  const option = choice.options?.find((item) => item.id === picked);
  if (option) ledger.addFeature({ id: `${cls.id}.${choice.id}.${picked}`, name: `${choice.label}: ${option.name}`, nameEn: option.nameEn, source: "class", sourceLabel, level: 1, description: option.summary, descriptionSource: "srd-summary" });
  if (picked === "protector") { ledger.weapons.add("martial"); ledger.armor.add("heavy"); }
  if (picked === "warden") { ledger.weapons.add("martial"); ledger.armor.add("medium"); }
  if (picked === "thaumaturge" || picked === "magician") ledger.flags.add(`bonus-cantrip:${cls.id}`);
  // R97 (D232): 기적술사 adds Wisdom to Arcana and Religion checks, 마법사 to Arcana and Nature (minimum +1).
  if (picked === "thaumaturge") for (const skill of ["arcana", "religion"]) ledger.flags.add(`wis-skill-bonus:${skill}`);
  if (picked === "magician") for (const skill of ["arcana", "nature"]) ledger.flags.add(`wis-skill-bonus:${skill}`);
}

function applyLevelRow(ledger: Ledger, cls: ClassView, state: ClassState, row: ClassLevelRow, index: number) {
  const { catalog } = ledger;
  const level = state.level;
  const sourceLabel = `${cls.name} ${level}레벨`;
  const ask = { scope: "class" as const, sourceLabel, trackIndex: index };

  for (const feature of row.featureRecords) {
    const key = feature.id.split(".").pop() ?? feature.id;
    if (feature.nameEn === "Ability Score Improvement") { askAsi(ledger, cls, index, sourceLabel); continue; }
    if (feature.nameEn === "Epic Boon") { askEpicBoon(ledger, cls, index, sourceLabel); continue; }
    if (feature.nameEn === "Subclass Feature") continue;
    if (/Subclass$/.test(feature.nameEn) && level === SUBCLASS_LEVEL) {
      const picked = ledger.askOne({ ...ask, id: `class.${index}.subclass`, label: `${cls.name} 서브클래스`, description: feature.description, options: subclassOptions(catalog, cls.id) });
      if (picked) {
        state.subclassId = picked;
        const subclass = catalog.subclassById(picked);
        if (subclass) ledger.addFeature({ id: subclass.id, name: `서브클래스: ${subclass.name}`, nameEn: subclass.nameEn, source: "subclass", sourceLabel, level, description: subclass.description ?? subclass.summary, descriptionSource: subclass.scope === "installed" ? "module" : "srd-summary" });
      }
      continue;
    }
    ledger.addFeature({ id: `${cls.slug}.${level}.${feature.id}`, name: feature.name, nameEn: feature.nameEn, source: "class", sourceLabel, level, description: feature.description, descriptionSource: feature.descriptionSource });

    if (key === "expertise" || key === "expertise-2") askExpertise(ledger, cls, state, index, sourceLabel, EXPERTISE_SCHEDULE[cls.slug]?.[level] ?? 1);
    if (key === "deft-explorer") {
      askExpertise(ledger, cls, state, index, sourceLabel, EXPERTISE_SCHEDULE[cls.slug]?.[level] ?? 1);
      const picked = ledger.ask({ ...ask, id: `class.${index}.languages`, label: `언어 (${DEFT_EXPLORER_LANGUAGES}개)`, count: DEFT_EXPLORER_LANGUAGES, options: [...languageOptions(catalog, "standard", (item) => ledger.languages.has(item)), ...languageOptions(catalog, "general", (item) => ledger.languages.has(item))] });
      for (const language of picked) ledger.languages.set(language, [...catalog.languages.standard, ...catalog.languages.general].find((item) => item.id === language)?.name ?? language);
    }
    if (key === "fighting-style") askFightingStyle(ledger, cls, index, sourceLabel);
    if (key === "primal-knowledge") {
      const picked = ledger.ask({ ...ask, id: `class.${index}.primal-knowledge`, label: "원초적 지식 — 기술 숙련", count: 1, options: skillOptions(catalog, cls.skillChoice.options, (id) => ledger.hasSkill(id)) });
      for (const skill of picked) ledger.addSkill(skill, `${cls.name} 원초적 지식`);
    }
    if (key === "blessed-strikes") askClassOption(ledger, index, sourceLabel, `class.${index}.blessed-strikes`, "축복받은 일격", "cleric.blessed-strikes");
    if (key === "elemental-fury") askClassOption(ledger, index, sourceLabel, `class.${index}.elemental-fury`, "원소의 격노", "druid.elemental-fury");
    const arcanum = /^mystic-arcanum-(\d)$/.exec(key);
    if (arcanum) {
      const spellLevel = Number(arcanum[1]);
      const picked = ledger.askOne({ ...ask, id: `class.${index}.arcanum${spellLevel}`, label: `신비한 비전 — ${spellLevel}레벨 주문`, description: "이 주문은 항상 준비되며 긴 휴식마다 1회 슬롯 없이 시전합니다.", options: spellOptions(catalog, [cls.id], [spellLevel]) });
      if (picked) {
        const entry = classSpellEntry(ledger, cls);
        entry.alwaysPrepared.add(picked);
        ledger.addResource({ id: `resource.warlock.arcanum.${spellLevel}`, label: `신비한 비전 ${spellLevel}레벨 (${catalog.spellById(picked)?.name ?? picked}) 무료 시전`, max: 1, recovery: "긴 휴식", source: cls.name, freeCastSpellId: picked });
      }
    }
    if (key === "magical-secrets") ledger.flags.add(`magical-secrets:${cls.id}`);
    if (key === "druidic") ledger.languages.set("druidic", "드루이드어");
    if (key === "thieves-cant") ledger.languages.set("thieves-cant", "도둑 은어");
    if (key === "unarmored-defense") ledger.flags.add(`unarmored-defense:${cls.slug}`);
    if (key === "fast-movement") ledger.flags.add("fast-movement");
    if (key === "unarmored-movement") ledger.flags.add("unarmored-movement");
    if (key === "jack-of-all-trades") ledger.flags.add("jack-of-all-trades");
    if (key === "disciplined-survivor") ledger.flags.add("all-saves");
    if (key === "pact-magic") ledger.flags.add("pact-magic");
    if (key === "spellcasting") ledger.flags.add(`spellcasting:${cls.id}`);
    if (key === "martial-arts") ledger.flags.add("martial-arts");
    if (key === "primal-champion") { ledger.addAbilityBonus("str", 4, "원초의 투사", 24); ledger.addAbilityBonus("con", 4, "원초의 투사", 24); }
    if (key === "feral-senses") ledger.senses.blindsight = Math.max(ledger.senses.blindsight ?? 0, 30);
    if (key === "indomitable-might") ledger.flags.add("indomitable-might");
    // R97 (D232): what these features change on the sheet itself, which used to be a note asking the player to do it.
    if (key === "body-and-mind") { ledger.addAbilityBonus("dex", 4, "몸과 마음", 25); ledger.addAbilityBonus("wis", 4, "몸과 마음", 25); }
    if (key === "slippery-mind") { ledger.saves.set("wis", "미끄러운 정신"); ledger.saves.set("cha", "미끄러운 정신"); }
    if (key === "scholar") {
      const scholarly = ["arcana", "history", "investigation", "medicine", "nature", "religion"];
      const options = skillOptions(catalog, scholarly).map((option) => (!ledger.hasSkill(option.id) ? { ...option, disabledReason: "숙련 없음" } : ledger.hasExpertise(option.id) ? { ...option, disabledReason: "이미 전문화" } : option));
      for (const skill of ledger.ask({ ...ask, id: `class.${index}.scholar`, label: "학자 — 전문화 1개", description: "숙련한 학문 기술 하나의 숙련 보너스를 두 배로 받습니다.", count: 1, options })) ledger.addExpertise(skill, "학자");
    }
  }

  applySubclassLevel(ledger, cls, state, index, sourceLabel);
}

function askAsi(ledger: Ledger, cls: ClassView, index: number, sourceLabel: string) {
  const { catalog } = ledger;
  const options = featOptions(catalog, ["general"], featContext(ledger), [ASI_FEAT_ID]);
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.asi`, label: "능력치 향상 또는 일반 재주", description: "능력치 향상 재주(+2 하나 또는 +1 둘)를 얻거나, 조건을 만족하는 일반 재주 하나를 고릅니다.", options });
  const feat = picked ? catalog.featById(picked) : undefined;
  if (feat) applyFeat(ledger, feat, { key: `class.${index}.asi`, sourceLabel, trackIndex: index });
  void cls;
}

function askEpicBoon(ledger: Ledger, cls: ClassView, index: number, sourceLabel: string) {
  const { catalog } = ledger;
  const options = featOptions(catalog, ["epic-boon", "general"], featContext(ledger), [ASI_FEAT_ID]);
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.epic-boon`, label: "에픽 은총", description: "에픽 은총 재주 하나를 얻거나, 조건을 만족하는 다른 재주로 대신합니다.", options });
  const feat = picked ? catalog.featById(picked) : undefined;
  if (feat) applyFeat(ledger, feat, { key: `class.${index}.epic-boon`, sourceLabel, trackIndex: index });
  void cls;
}

function askExpertise(ledger: Ledger, cls: ClassView, state: ClassState, index: number, sourceLabel: string, count: number) {
  const { catalog } = ledger;
  const options = skillOptions(catalog, "any").map((option) => {
    if (!ledger.hasSkill(option.id)) return { ...option, disabledReason: "숙련 없음" };
    if (ledger.hasExpertise(option.id)) return { ...option, disabledReason: "이미 전문화" };
    return option;
  });
  const picked = ledger.ask({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.expertise`, label: `전문화 (${count}개)`, description: "숙련한 기술 중 고릅니다. 숙련 보너스를 두 배로 받습니다.", count, options });
  for (const skill of picked) ledger.addExpertise(skill, `${cls.name} ${state.level}레벨 전문화`);
}

function askFightingStyle(ledger: Ledger, cls: ClassView, index: number, sourceLabel: string) {
  const { catalog } = ledger;
  const options = featOptions(catalog, ["fighting-style"], featContext(ledger, true));
  const extraDefs = cls.slug === "paladin" ? [{ id: "paladin.blessed-warrior", name: "축복받은 전사", nameEn: "Blessed Warrior", summary: "전투 방식 재주 대신 클레릭 소마법 두 개를 항상 준비합니다.", list: "cleric" }]
    : cls.slug === "ranger" ? [{ id: "ranger.druidic-warrior", name: "드루이드 전사", nameEn: "Druidic Warrior", summary: "전투 방식 재주 대신 드루이드 소마법 두 개를 항상 준비합니다.", list: "druid" }] : [];
  const all = [...options, ...extraDefs.map((extra) => ({ id: extra.id, name: extra.name, nameEn: extra.nameEn, summary: extra.summary, group: "직업 대체 옵션" }))];
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.fighting-style`, label: "전투 방식", options: all });
  if (!picked) return;
  const feat = catalog.featById(picked);
  if (feat) { applyFeat(ledger, feat, { key: `class.${index}.fighting-style`, sourceLabel, trackIndex: index }); return; }
  const extra = extraDefs.find((item) => item.id === picked);
  if (!extra) return;
  ledger.addFeature({ id: extra.id, name: `전투 방식: ${extra.name}`, nameEn: extra.nameEn, source: "class", sourceLabel, description: extra.summary, descriptionSource: "srd-summary" });
  const listClass = catalog.classBySlug(extra.list);
  if (!listClass) return;
  const cantrips = ledger.ask({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.fighting-style.cantrips`, label: `${extra.name} — ${listClass.name} 소마법 2개`, count: 2, options: spellOptions(catalog, [listClass.id], [0]) });
  const entry = classSpellEntry(ledger, cls);
  for (const id of cantrips) entry.extraCantrips.add(id);
}

function askClassOption(ledger: Ledger, index: number, sourceLabel: string, id: string, label: string, listKey: string) {
  const { catalog } = ledger;
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id, label, options: classOptionList(catalog, listKey) });
  const option = picked ? catalog.classOptions[listKey]?.find((item) => item.id === picked) : undefined;
  if (option) ledger.addFeature({ id: option.id, name: `${label}: ${option.name}`, nameEn: option.nameEn, source: "class", sourceLabel, description: option.description, descriptionSource: "srd-summary" });
}

function subclassData(subclassId: string): SrdSubclassData | undefined {
  return SRD_SUBCLASSES.find((item) => item.id === subclassId);
}

function applySubclassLevel(ledger: Ledger, cls: ClassView, state: ClassState, index: number, sourceLabel: string) {
  const { catalog } = ledger;
  if (!state.subclassId) return;
  const subclass = catalog.subclassById(state.subclassId);
  if (!subclass) { ledger.blocking.push(`서브클래스 "${state.subclassId}"을(를) 찾을 수 없습니다.`); return; }
  if (subclass.classId !== cls.id) ledger.blocking.push(`${subclass.name}은(는) ${cls.name}의 서브클래스가 아닙니다.`);
  const level = state.level;
  const subclassLabel = `${subclass.name} ${level}레벨`;
  for (const feature of subclass.features) {
    if (feature.level !== level) continue;
    ledger.addFeature({ id: feature.id, name: feature.name, nameEn: feature.nameEn, source: "subclass", sourceLabel: subclassLabel, level, description: feature.description, descriptionSource: feature.descriptionSource })
    // R97 (D232): 추가 숙련 (전승 학파) — three skills of the player choosing.
    if (feature.id.endsWith("college-of-lore.bonus-proficiencies")) for (const skill of ledger.ask({ scope: "class", sourceLabel: subclassLabel, trackIndex: index, id: `class.${index}.lore-skills`, label: "추가 숙련 — 기술 3개", count: 3, options: skillOptions(catalog, "any", (id) => ledger.hasSkill(id)) })) ledger.addSkill(skill, "전승 학파");;
  }
  const spellsAtLevel = subclass.spells[level] ?? [];
  if (spellsAtLevel.length) {
    const entry = classSpellEntry(ledger, cls);
    for (const id of spellsAtLevel) { if (catalog.spellById(id)) entry.alwaysPrepared.add(id); else ledger.warnings.push(`${subclass.name}의 주문 "${id}"을(를) 찾을 수 없습니다.`); }
  }
  const data = subclassData(subclass.id);
  if (!data) return;
  for (const choice of data.choices ?? []) {
    if (choice.level === level) {
      const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.${choice.id}`, label: choice.label, description: choice.description, options: fixedOptions(choice.options) });
      if (picked) {
        state.subclassChoices[choice.id] = picked;
        const option = choice.options.find((item) => item.id === picked);
        if (option) ledger.addFeature({ id: `${subclass.id}.${choice.id}.${picked}`, name: `${choice.label}: ${option.name}`, nameEn: option.nameEn, source: "subclass", sourceLabel: subclassLabel, level, description: option.summary, descriptionSource: "srd-summary" });
      }
    }
    const chosen = state.subclassChoices[choice.id];
    if (!chosen) continue;
    const names = data.spellsByOption?.[choice.id]?.[chosen]?.[level] ?? [];
    if (names.length) {
      const entry = classSpellEntry(ledger, cls);
      for (const name of names) { const spell = catalog.spellByName(name); if (spell) entry.alwaysPrepared.add(spell.id); else ledger.warnings.push(`${subclass.name} 주문 "${name}"을(를) 찾을 수 없습니다.`); }
    }
    if (choice.id === "subclass.land-type" && level === 10) { ledger.resistances.add(LAND_RESISTANCE[chosen] ?? chosen); ledger.conditionImmunities.add("poisoned"); }
    if (choice.id === "subclass.elemental-affinity" && level === 6) ledger.resistances.add(chosen);
  }
}

function applyClassWide(ledger: Ledger, cls: ClassView, state: ClassState) {
  const { catalog, source } = ledger;
  const level = state.level;
  const first = state.firstTrack;
  const row = cls.progression[level - 1];
  if (!row) return;
  const ask = { scope: "class" as const, sourceLabel: cls.name, trackIndex: first };

  const masteryCount = numericColumn(row.columns[COLUMN.mastery]);
  if (masteryCount > 0) {
    const filter = cls.level1Choices.find((choice) => choice.kind === "weapon-mastery")?.weaponFilter ?? "all-simple-or-martial";
    const picked = ledger.ask({ ...ask, id: `class.${first}.weapon-mastery`, label: `무기 통달 (${masteryCount}종)`, description: "고른 무기의 통달 속성을 쓸 수 있습니다. 긴 휴식마다 하나를 바꿀 수 있습니다.", count: masteryCount, options: weaponMasteryOptions(catalog, filter, ledger.weapons) });
    for (const id of picked) ledger.weaponMasteries.add(id);
  }

  const invocationCount = numericColumn(row.columns[COLUMN.invocations]);
  if (invocationCount > 0) {
    const id = `class.${first}.invocations`;
    const raw = source.choices[id] ?? [];
    const picked = ledger.ask({ ...ask, id, label: `섬뜩한 기원술 (${invocationCount}개)`, count: invocationCount, options: invocationOptions(catalog, level, raw) });
    applyInvocations(ledger, cls, first, picked);
  }

  if (cls.slug === "sorcerer" && level >= 2) {
    const count = Object.entries(METAMAGIC_KNOWN).filter(([threshold]) => Number(threshold) <= level).reduce((max, [, value]) => Math.max(max, value), 0);
    const picked = ledger.ask({ ...ask, id: `class.${first}.metamagic`, label: `메타매직 (${count}개)`, count, options: classOptionList(catalog, "sorcerer.metamagic") });
    for (const optionId of picked) {
      const option = catalog.classOptions["sorcerer.metamagic"]?.find((item) => item.id === optionId);
      if (option) ledger.addFeature({ id: option.id, name: `메타매직: ${option.name}`, nameEn: option.nameEn, source: "metamagic", sourceLabel: cls.name, description: option.description, descriptionSource: "srd-summary" });
    }
  }

  for (const rule of CLASS_RESOURCES) {
    if (rule.classSlug !== cls.slug || level < rule.minLevel) continue;
    if (rule.subclassId && state.subclassId !== rule.subclassId) continue;
    const max = rule.column ? numericColumn(row.columns[rule.column]) : rule.maximum ? rule.maximum(level, (key) => ledger.abilityMod(key)) : 0;
    if (max <= 0) continue;
    const recovery = rule.recoveryFrom && level >= rule.recoveryFrom.level ? rule.recoveryFrom.recovery : rule.recovery;
    ledger.addResource({ id: rule.id, label: rule.label, max, recovery: RECOVERY_KO[recovery] ?? recovery, source: cls.name, freeCastSpellId: rule.spell ? catalog.spellByName(rule.spell)?.id : undefined });
  }

  applyClassSpellcasting(ledger, cls, state, row);
}

function applyInvocations(ledger: Ledger, cls: ClassView, first: number, picked: string[]) {
  const { catalog } = ledger;
  const list = catalog.classOptions["warlock.invocations"] ?? [];
  const entry = classSpellEntry(ledger, cls);
  const ask = { scope: "class" as const, sourceLabel: `${cls.name} 기원술`, trackIndex: first };
  for (const optionId of picked) {
    const option = list.find((item) => item.id === optionId);
    if (!option) continue;
    const slug = option.id.replace(/^invocation\./, "");
    ledger.addFeature({ id: option.id, name: option.name, nameEn: option.nameEn, source: "invocation", sourceLabel: cls.name, description: option.description, descriptionSource: "srd-summary" });
    if (option.targetKind === "origin-feat") {
      const featId = ledger.askOne({ ...ask, id: `class.${first}.invocation.${slug}.feat`, label: `${option.name} — 기원 재주`, options: featOptions(catalog, ["origin"], featContext(ledger)) });
      const feat = featId ? catalog.featById(featId) : undefined;
      if (feat) applyFeat(ledger, feat, { key: `invocation.${first}.${slug}`, sourceLabel: `${cls.name} · ${option.name}`, trackIndex: first });
    }
    if (option.targetKind === "damage-cantrip" || option.targetKind === "attack-cantrip") {
      // R93 (D228): the class cantrips are picked after the invocations, so the picks in the source count as known too.
      const known = [...new Set([...entry.cantrips, ...entry.extraCantrips, ...(ledger.source.choices[`class.${first}.cantrips`] ?? [])])].map((id) => catalog.spellById(id)).filter((spell): spell is NonNullable<typeof spell> => Boolean(spell));
      const target = ledger.askOne({ ...ask, id: `class.${first}.invocation.${slug}.target`, label: `${option.name} — 대상 소마법`, description: "알고 있는 워락 소마법 중 피해를 주는 것.", options: known.map((spell) => ({ id: spell.id, name: spell.name, nameEn: spell.nameEn, summary: spell.summary })), optional: true });
      if (target) ledger.addFeatureTarget(option.id, target);
    }
    if (slug === "pact-of-the-tome") {
      const allClassIds = catalog.classes.filter((item) => item.casterKind !== "none").map((item) => item.id);
      const cantrips = ledger.ask({ ...ask, id: `class.${first}.tome.cantrips`, label: "그림자의 서 — 소마법 3개 (어느 목록이든)", count: 3, options: spellOptions(catalog, allClassIds, [0]) });
      for (const id of cantrips) entry.extraCantrips.add(id);
      const rituals = ledger.ask({ ...ask, id: `class.${first}.tome.rituals`, label: "그림자의 서 — 의식 1레벨 주문 2개", count: 2, options: spellOptions(catalog, allClassIds, [1], (spell) => spell.ritual) });
      for (const id of rituals) entry.alwaysPrepared.add(id);
    }
    if (slug === "gift-of-the-depths") ledger.extraSpeeds.swim = -1;
    if (slug === "witch-sight") ledger.senses.truesight = Math.max(ledger.senses.truesight ?? 0, 30);
    if (slug === "devils-sight") ledger.flags.add("devils-sight");
  }
}

export const abilityLabel = (key: AbilityKey) => ABILITY_KO[key];
