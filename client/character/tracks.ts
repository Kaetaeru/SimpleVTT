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
import { COLUMN, numericColumn, type ArmorTraining, type ClassOptionPool, type WeaponTraining } from "../rules/classes";
import {
  artisanToolOptions, classOptionList, featOptions, fixedOptions, instrumentOptions, languageOptions, skillOptions, spellOptions,
  subclassOptions, toolName, weaponMasteryOptions, type FeatContext,
} from "./choices";
import { applyFeat } from "./feats";
import { featureRuleKey } from "../rules/activation";
import { featureContract } from "../rules/contractActivation";
import { evaluate, GAIN_INVOCATION, type ExprValue } from "../rules/contract";
import { ABILITY_KEYS } from "../catalog/types";
import type { ClassState, Ledger } from "./ledger";
import { resolveToolId } from "./origin";
import { applyClassSpellcasting, classSpellEntry } from "./spells";

export const RECOVERY_KO: Record<string, string> = { "short-rest": "짧은 휴식", "long-rest": "긴 휴식", "short-rest:1": "긴 휴식 (짧은 휴식마다 1회 회복)", "short-rest:half": "긴 휴식 (짧은 휴식에 절반 회복)", "short-or-long-rest": "짧은 휴식" };

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

function applyPrimaryClass(ledger: Ledger, cls: ClassView, index: number) {
  const { catalog } = ledger;
  const sourceLabel = `${cls.name} 1레벨`;
  for (const key of cls.savingThrows) ledger.saves.set(key, cls.name);
  const training = cls.rules;
  for (const armor of training.armorTraining) ledger.armor.add(armor);
  for (const weapon of training.weaponTraining) ledger.weapons.add(weapon);
  for (const tool of training.toolProficiencies) { const id = resolveToolId(ledger, tool); ledger.tools.set(id, toolName(catalog, id)); }
  const picked = ledger.ask({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.skills`, label: `기술 숙련 (${cls.skillChoice.count}개)`, count: cls.skillChoice.count, options: skillOptions(catalog, cls.skillChoice.options, (id) => ledger.hasSkill(id)) });
  for (const skill of picked) ledger.addSkill(skill, cls.name);
  applyLevel1Choices(ledger, cls, index, false);
}

function applyMulticlassEntry(ledger: Ledger, cls: ClassView, index: number) {
  const { catalog } = ledger;
  const sourceLabel = `${cls.name} 1레벨 (멀티클래스)`;
  const check = (other: ClassView | undefined, name: string) => {
    const rule = other?.rules.multiclass.prerequisites;
    if (!rule) return;
    const ok = rule.all ? rule.all.every((key) => ledger.abilityScore(key) >= 13) : (rule.any ?? []).some((key) => ledger.abilityScore(key) >= 13);
    if (!ok) {
      const text = rule.all ? rule.all.map((key) => `${ABILITY_KO[key]} 13`).join("과 ") : (rule.any ?? []).map((key) => `${ABILITY_KO[key]} 13`).join(" 또는 ");
      ledger.blocking.push(`${index + 1}레벨에서 ${cls.name}을(를) 추가하려면 ${name}의 조건(${text})이 필요합니다.`);
    }
  };
  check(cls, cls.name);
  for (const other of ledger.classes.values()) if (other.classId !== cls.id) check(catalog.classById(other.classId), other.name);
  const training = cls.rules;
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
  // H3d (D242): what the option grants is in its contract.
  applyGainContract(ledger, cls, index, `${cls.id}.${choice.id}.${picked}`, option ? `${choice.label}: ${option.name}` : choice.label, sourceLabel);
}

function applyLevelRow(ledger: Ledger, cls: ClassView, state: ClassState, row: ClassLevelRow, index: number) {
  const { catalog } = ledger;
  const level = state.level;
  const sourceLabel = `${cls.name} ${level}레벨`;
  const ask = { scope: "class" as const, sourceLabel, trackIndex: index };

  for (const feature of row.featureRecords) {
    const key = feature.id.split(".").pop() ?? feature.id;
    // D310, D314: the class's level table names the row's role (ASI, Epic Boon, subclass) — the SRD's as a module's.
    const role = feature.role;
    if (role === "asi") { askAsi(ledger, cls, index, sourceLabel); continue; }
    if (role === "epic-boon") { askEpicBoon(ledger, cls, index, sourceLabel); continue; }
    if (role === "subclass-feature") continue;
    if (role === "subclass") {
      const picked = ledger.askOne({ ...ask, id: `class.${index}.subclass`, label: `${cls.name} 서브클래스`, description: feature.description, options: subclassOptions(catalog, cls.id) });
      if (picked) {
        state.subclassId = picked;
        const subclass = catalog.subclassById(picked);
        if (subclass) ledger.addFeature({ id: subclass.id, name: `서브클래스: ${subclass.name}`, nameEn: subclass.nameEn, source: "subclass", sourceLabel, level, description: subclass.description ?? subclass.summary, descriptionSource: subclass.scope === "installed" ? "module" : "srd-summary" });
      }
      continue;
    }
    ledger.addFeature({ id: `${cls.slug}.${level}.${feature.id}`, name: feature.name, nameEn: feature.nameEn, source: "class", sourceLabel, level, description: feature.description, descriptionSource: feature.descriptionSource });

    // H3 (D240): what gaining this feature asks or grants is in its contract.
    applyGainContract(ledger, cls, index, `${cls.slug}.${level}.${feature.id}`, feature.name, sourceLabel);
  }

  applySubclassLevel(ledger, cls, state, index, sourceLabel);
}

/** The repeatable feats of a tier go first in its picker (능력치 향상, taken again and again). */
const repeatableFeats = (feats: ReadonlyArray<{ id: string; tier: string; repeatable: boolean }>, tier: string) => feats.filter((feat) => feat.tier === tier && feat.repeatable).map((feat) => feat.id);

function askAsi(ledger: Ledger, cls: ClassView, index: number, sourceLabel: string) {
  const { catalog } = ledger;
  const options = featOptions(catalog, ["general"], featContext(ledger), repeatableFeats(catalog.feats, "general"));
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.asi`, label: "능력치 향상 또는 일반 재주", description: "능력치 향상 재주(+2 하나 또는 +1 둘)를 얻거나, 조건을 만족하는 일반 재주 하나를 고릅니다.", options });
  const feat = picked ? catalog.featById(picked) : undefined;
  if (feat) applyFeat(ledger, feat, { key: `class.${index}.asi`, sourceLabel, trackIndex: index });
  void cls;
}

function askEpicBoon(ledger: Ledger, cls: ClassView, index: number, sourceLabel: string) {
  const { catalog } = ledger;
  const options = featOptions(catalog, ["epic-boon", "general"], featContext(ledger), repeatableFeats(catalog.feats, "general"));
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.epic-boon`, label: "에픽 은총", description: "에픽 은총 재주 하나를 얻거나, 조건을 만족하는 다른 재주로 대신합니다.", options });
  const feat = picked ? catalog.featById(picked) : undefined;
  if (feat) applyFeat(ledger, feat, { key: `class.${index}.epic-boon`, sourceLabel, trackIndex: index });
  void cls;
}

/**
 * H3 (V0.9, D240): what a feature does the moment it is gained — the choices it asks and what it grants — read from
 * its contract's `gain` entry point. This code knows only the grammar; which feature asks what, how many and from
 * which list is data (content/modules/…effect-common-play), so a module feature works the same way.
 */
export function applyGainContract(ledger: Ledger, owner: ClassView | undefined, index: number, featureId: string, featureName: string, sourceLabel: string, at?: { level: number; defaultLevel: number }) {
  const { catalog } = ledger;
  const contract = featureContract(catalog, featureRuleKey(featureId));
  // H7a (D251): a species trait gains through the same grammar; the operations that belong to a class say so.
  const ask = owner ? { scope: "class" as const, sourceLabel, trackIndex: index } : { scope: "origin" as const, sourceLabel };
  // D302: a pool a feature grants is often "your Wisdom modifier, minimum one". Answering only the proficiency bonus
  // and the level meant those expressions came out NaN and the pool was silently dropped — the feature then had a
  // button nobody could pay for. Ability modifiers and class levels are known while the sheet is built, so they answer.
  const scope = (ref: string): ExprValue => {
    if (ref === "proficiency.bonus") return ledger.proficiencyBonus;
    if (ref === "actor.level") return ledger.level;
    const ability = /^ability\.([a-z]{3})\.modifier$/.exec(ref);
    if (ability) return ledger.abilityMod(ability[1] as AbilityKey);
    const score = /^ability\.([a-z]{3})\.score$/.exec(ref);
    if (score) return ledger.abilityScore(score[1] as AbilityKey);
    const classLevel = /^actor\.class-level:(.+)$/.exec(ref);
    if (classLevel) return [...ledger.classes.values()].find((state) => state.classId === classLevel[1])?.level ?? 0;
    return undefined;
  };
  const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : typeof value === "string" && value ? [value] : []);
  for (const operation of (contract?.entryPoints ?? []).filter((entry) => entry.invocation === GAIN_INVOCATION).flatMap((entry) => entry.operations)) {
    if (operation.kind !== "property.modify") continue;
    const p = operation.params ?? {};
    // H3d (D242): a choice kept across levels runs its operations at their own level (땅 유형's resistance at 10).
    if (at && Number(p.atLevel ?? at.defaultLevel) !== at.level) continue;
    const amount = Number(evaluate(operation.value, scope)) || 1;
    // D300: every operation that writes into a *class's* spell list or table belongs to a class feature; a species
    // trait or a module entry that names one is told so instead of derailing the whole sheet.
    const CLASS_ONLY = new Set(["choice.spell", "choice.spells", "choice.fighting-style", "grant.cantrips", "grant.speed-bonus", "grant.martial-arts",
      "grant.spells", "grant.spellbook-picks", "grant.ritual-casting", "choice.class-option"]);
    if (!owner && (CLASS_ONLY.has(operation.property) || (operation.property === "choice.skills" && p.from === "class") || (operation.property === "grant.hp-per-level" && p.per !== "character"))) { ledger.warnings.push(`${featureName}: ${operation.property}은(는) 직업 특성에서만 씁니다`); continue; }
    const cls = owner as ClassView;
    const id = `class.${index}.${String(p.id ?? operation.property)}`;
    const label = String(p.label ?? featureName);
    const description = p.description ? { description: String(p.description) } : {};
    switch (operation.property) {
      case "choice.skills": {
        const expertise = p.mode === "expertise";
        const from = p.from === "class" ? cls.skillChoice.options : Array.isArray(p.from) ? strings(p.from) : "any";
        const options = expertise
          ? skillOptions(catalog, from).map((option) => (!ledger.hasSkill(option.id) ? { ...option, disabledReason: "숙련 없음" } : ledger.hasExpertise(option.id) ? { ...option, disabledReason: "이미 전문화" } : option))
          : skillOptions(catalog, from, (skill) => ledger.hasSkill(skill));
        for (const skill of ledger.ask({ ...ask, id, label: `${label} (${amount}개)`, ...description, count: amount, options })) {
          if (expertise) ledger.addExpertise(skill, label); else ledger.addSkill(skill, label);
        }
        break;
      }
      case "choice.languages": {
        const picked = ledger.ask({ ...ask, id, label: `${label} (${amount}개)`, ...description, count: amount, options: [...languageOptions(catalog, "standard", (item) => ledger.languages.has(item)), ...languageOptions(catalog, "general", (item) => ledger.languages.has(item))] });
        for (const language of picked) ledger.languages.set(language, [...catalog.languages.standard, ...catalog.languages.general].find((item) => item.id === language)?.name ?? language);
        break;
      }
      case "choice.class-option": askClassOption(ledger, index, sourceLabel, id, label, String(p.list ?? "")); break;
      case "choice.fighting-style": askFightingStyle(ledger, cls, index, sourceLabel, Array.isArray(p.extra) ? (p.extra as FightingStyleExtra[]) : []); break;
      case "choice.spell": {
        const picked = ledger.askOne({ ...ask, id, label, ...description, options: spellOptions(catalog, [cls.id], [amount]) });
        if (!picked) break;
        classSpellEntry(ledger, cls).alwaysPrepared.add(picked);
        // V3g (D261): `atWill` — the free cast is never used up (주문 숙련).
        if (p.resourceId) ledger.addResource({ id: String(p.resourceId), label: `${label} (${catalog.spellById(picked)?.name ?? picked}) 무료 시전`, max: 1, recovery: p.atWill === true ? "무제한" : String(p.recovery ?? "긴 휴식"), source: cls.name, freeCastSpellId: picked, ...(p.atWill === true ? { atWill: true } : {}) });
        break;
      }
      case "choice.spells": {
        // V3h (D262): `classes` narrows the lists and `levels` widens the level (마법의 발견).
        const casters = strings(p.classes).length ? strings(p.classes) : catalog.classes.filter((item) => item.casterKind !== "none").map((item) => item.id);
        const levels = Array.isArray(p.levels) ? p.levels.map(Number) : [Number(p.level ?? 0)];
        const picked = ledger.ask({ ...ask, id, label: `${label} (${amount}개)`, ...description, count: amount, options: spellOptions(catalog, casters, levels, p.ritual === true ? (spell) => spell.ritual : undefined) });
        const entry = classSpellEntry(ledger, cls);
        for (const spellId of picked) (p.into === "alwaysPrepared" ? entry.alwaysPrepared : entry.extraCantrips).add(spellId);
        break;
      }
      case "grant.language": ledger.languages.set(String(p.id ?? ""), String(p.name ?? p.id ?? "")); break;
      case "grant.save-proficiency": for (const ability of p.abilities === "all" ? ABILITY_KEYS : (strings(p.abilities) as AbilityKey[])) ledger.saves.set(ability, label); break;
      case "grant.ability": for (const ability of strings(p.abilities) as AbilityKey[]) ledger.addAbilityBonus(ability, amount, label, typeof p.cap === "number" ? p.cap : undefined); break;
      case "grant.senses": { const sense = String(p.sense ?? "") as keyof typeof ledger.senses; ledger.senses[sense] = Math.max(ledger.senses[sense] ?? 0, amount); break; }
      case "grant.speed": { const mode = String(p.mode ?? "") as keyof typeof ledger.extraSpeeds; ledger.extraSpeeds[mode] = p.equalsWalk === true ? -1 : amount; break; }
      case "grant.ac-formula": ledger.acFormulas.push({ abilities: strings(p.abilities) as AbilityKey[], shield: p.shield === true, label }); break;
      case "grant.speed-bonus": ledger.speedGrants.push({ amount: Number(evaluate(operation.value, () => undefined)) || 0, classId: cls.id, ...(p.column ? { column: String(p.column) } : {}), unless: String(p.unless ?? "none"), modes: strings(p.modes), label }); break;
      case "grant.hp-per-level":
        // H7a (D251): per character level (드워프의 강인함) or per level of the granting class (용의 회복력).
        if (p.per === "character") { ledger.hpPerLevelBonus += amount; ledger.hpPerLevelSource = label; } else ledger.hpPerClassLevel.push({ classId: cls.id, amount, label });
        break;
      case "grant.resource": {
        // H7a (D251): a pool the feature grants, its size an expression (숙련 보너스), from a level on.
        if (p.minLevel !== undefined && ledger.level < Number(p.minLevel)) break;
        const max = Number(evaluate(operation.value, scope)) || 0;
        // V3g (D261): `spell` — the pool casts that spell free (용 동료).
        const freeCast = p.spell ? catalog.spellById(String(p.spell))?.id : undefined;
        if (max > 0) ledger.addResource({ id: String(p.id ?? `resource.${featureRuleKey(featureId)}`), label, max, recovery: p.atWill === true ? "무제한" : RECOVERY_KO[String(p.recovery ?? "long-rest")] ?? String(p.recovery ?? "긴 휴식"), source: sourceLabel, ...(freeCast ? { freeCastSpellId: freeCast } : {}), ...(p.atWill === true ? { atWill: true } : {}), ...(typeof p.maxLevel === "number" ? { freeCastMaxLevel: p.maxLevel } : {}), ...(p.maximized === true ? { freeCastMaximized: true } : {}), ...(Array.isArray(p.spells) && p.spells.length ? { freeCastSpellIds: p.spells.map(String) } : {}) });
        break;
      }
      case "grant.half-proficiency": ledger.halfProficiency = label; break;
      case "grant.martial-arts": ledger.martialArts = { classId: cls.id, column: String(p.column ?? ""), ability: String(p.ability ?? "dex") as AbilityKey }; break;
      // D329: tools travel the same way weapons and armour do (요리사의 조리 도구, 장인의 도구, 악기).
      case "grant.proficiency": for (const weapon of strings(p.weapons)) ledger.weapons.add(weapon as WeaponTraining); for (const armor of strings(p.armor)) ledger.armor.add(armor as ArmorTraining); for (const tool of strings(p.tools)) { const id = resolveToolId(ledger, tool); ledger.tools.set(id, toolName(catalog, id)); } break;
      case "grant.cantrips": ledger.bonusCantrips.set(cls.id, (ledger.bonusCantrips.get(cls.id) ?? 0) + amount); break;
      case "grant.skill-ability-bonus": for (const skill of strings(p.skills)) ledger.skillAbilityBonuses.push({ skill, ability: String(p.ability ?? "wis") as AbilityKey, min: Number(p.min ?? 0), label }); break;
      case "grant.resistance": for (const type of strings(p.types)) ledger.resistances.add(type); break;
      case "grant.condition-immunity": for (const condition of strings(p.conditions)) ledger.conditionImmunities.add(condition); break;
      // V3g (D261): ritual spells in the spellbook cast as rituals without being prepared (의식 숙련).
      case "grant.ritual-casting": classSpellEntry(ledger, cls).ritualFromSpellbook = true; break;
      // V3g (D261): extra spellbook picks of one school; the count is worked out with the final class level (방출술 전문가).
      case "grant.spellbook-picks": { const entry = classSpellEntry(ledger, cls); entry.schoolPicks = [...(entry.schoolPicks ?? []), { id: String(p.id ?? "school-picks"), label, school: String(p.school ?? ""), count: operation.value }]; break; }
      // V3h (D262): named spells, always prepared (창조의 언어).
      case "grant.spells": { const entry = classSpellEntry(ledger, cls); for (const spellId of strings(p.spells)) { const spell = catalog.spellById(spellId); if (spell) (p.into === "cantrips" ? entry.extraCantrips : entry.alwaysPrepared).add(spell.id); else ledger.warnings.push(`${featureName}: 주문 ${spellId} 없음`); } break; }
      // D305: other classes' lists this class prepares from (마법의 비밀). The case was listed but fell through to the
      // warning, so the lists never opened.
      case "grant.spell-lists": ledger.extraSpellLists.set(cls.id, [...new Set([...(ledger.extraSpellLists.get(cls.id) ?? []), ...strings(p.classes)])]); break;
      default: ledger.warnings.push(`${featureName}: 알 수 없는 획득 연산 ${operation.property}`);
    }
  }
}

interface FightingStyleExtra { id: string; name: string; nameEn: string; summary: string; list: string; count: number }

function askFightingStyle(ledger: Ledger, cls: ClassView, index: number, sourceLabel: string, extraDefs: FightingStyleExtra[]) {
  const { catalog } = ledger;
  const options = featOptions(catalog, ["fighting-style"], featContext(ledger, true));
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
  const cantrips = ledger.ask({ scope: "class", sourceLabel, trackIndex: index, id: `class.${index}.fighting-style.cantrips`, label: `${extra.name} — ${listClass.name} 소마법 ${extra.count}개`, count: extra.count, options: spellOptions(catalog, [listClass.id], [0]) });
  const entry = classSpellEntry(ledger, cls);
  for (const id of cantrips) entry.extraCantrips.add(id);
}

function askClassOption(ledger: Ledger, index: number, sourceLabel: string, id: string, label: string, listKey: string) {
  const { catalog } = ledger;
  const picked = ledger.askOne({ scope: "class", sourceLabel, trackIndex: index, id, label, options: classOptionList(catalog, listKey) });
  const option = picked ? catalog.classOptions[listKey]?.find((item) => item.id === picked) : undefined;
  if (option) ledger.addFeature({ id: option.id, name: `${label}: ${option.name}`, nameEn: option.nameEn, source: "class", sourceLabel, description: option.description, descriptionSource: "srd-summary" });
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
    applyGainContract(ledger, cls, index, feature.id, feature.name, subclassLabel);;
  }
  const spellsAtLevel = subclass.spells[level] ?? [];
  if (spellsAtLevel.length) {
    const entry = classSpellEntry(ledger, cls);
    for (const id of spellsAtLevel) { if (catalog.spellById(id)) entry.alwaysPrepared.add(id); else ledger.warnings.push(`${subclass.name}의 주문 "${id}"을(를) 찾을 수 없습니다.`); }
  }
  // H7b (D252): the subclass's own choices, from the catalog — SRD extras or a module's subclass-definition.
  for (const choice of subclass.choices) {
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
    const names = subclass.spellsByOption[choice.id]?.[chosen]?.[level] ?? [];
    if (names.length) {
      const entry = classSpellEntry(ledger, cls);
      for (const name of names) { const spell = catalog.spellByName(name); if (spell) entry.alwaysPrepared.add(spell.id); else ledger.warnings.push(`${subclass.name} 주문 "${name}"을(를) 찾을 수 없습니다.`); }
    }
    applyGainContract(ledger, cls, index, `${subclass.id}.${choice.id}.${chosen}`, choice.label, subclassLabel, { level, defaultLevel: choice.level });
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

  // H4 (D243): option lists known in growing numbers (메타매직), from the class definition — and D303, from the subclass.
  // D310: the count may be a progression column (기원술), and the options are gated by the list's own data.
  const subclass = state.subclassId ? catalog.subclassById(state.subclassId) : undefined;
  for (const pool of [...cls.rules.optionPools, ...(subclass?.optionPools ?? [])]) {
    const count = pool.column ? numericColumn(row.columns[pool.column]) : Object.entries(pool.known ?? {}).filter(([threshold]) => Number(threshold) <= level).reduce((max, [, value]) => Math.max(max, value), 0);
    if (count <= 0) continue;
    const id = `class.${first}.${pool.id}`;
    const picked = ledger.ask({ ...ask, id, label: `${pool.label} (${count}개)`, count, options: classOptionList(catalog, pool.list, { className: cls.name, level, selected: source.choices[id] ?? [] }) });
    applyPoolOptions(ledger, cls, first, pool, picked);
  }

  // H4 (D243): resource pools from the class definition — a progression column or an expression.
  const scope = (ref: string) => {
    if (ref === "class.level") return level;
    const ability = /^ability\.([a-z]{3})\.modifier$/.exec(ref);
    return ability ? ledger.abilityMod(ability[1] as AbilityKey) : undefined;
  };
  for (const rule of cls.rules.resources) {
    if (level < rule.minLevel) continue;
    if (rule.subclassId && state.subclassId !== rule.subclassId) continue;
    const max = rule.column ? numericColumn(row.columns[rule.column]) : Number(evaluate(rule.max, scope)) || 0;
    if (max <= 0) continue;
    const recovery = rule.recoveryFrom && level >= rule.recoveryFrom.level ? rule.recoveryFrom.recovery : rule.recovery;
    ledger.addResource({ id: rule.id, label: rule.label, max, recovery: RECOVERY_KO[recovery] ?? recovery, source: cls.name, freeCastSpellId: rule.spell ? catalog.spellByName(rule.spell)?.id : undefined, ...(typeof rule.freeCastMaxLevel === "number" ? { freeCastMaxLevel: rule.freeCastMaxLevel } : {}) });
  }

  applyClassSpellcasting(ledger, cls, state, row);
}

/**
 * The options taken from a pool: each is a feature, asks for what it targets (D310: `targetKind` — an origin feat, a
 * cantrip it empowers), and runs its own gain contract. The follow-up choice ids are `class.<first>.<option id>.feat`
 * and `….target`, and the feat's key puts the class's first track after the option id's first part — the ids the
 * warlock's invocations have always been saved under.
 */
function applyPoolOptions(ledger: Ledger, cls: ClassView, first: number, pool: ClassOptionPool, picked: string[]) {
  const { catalog } = ledger;
  const list = catalog.classOptions[pool.list] ?? [];
  const entry = classSpellEntry(ledger, cls);
  const ask = { scope: "class" as const, sourceLabel: `${cls.name} ${pool.label}`, trackIndex: first };
  for (const optionId of picked) {
    const option = list.find((item) => item.id === optionId);
    if (!option) continue;
    const [head, ...rest] = option.id.split(".");
    ledger.addFeature({ id: option.id, name: pool.featureName === "option" ? option.name : `${pool.label}: ${option.name}`, nameEn: option.nameEn, source: pool.source ?? "class", sourceLabel: cls.name, description: option.description, descriptionSource: "srd-summary" });
    if (option.targetKind === "origin-feat") {
      const featId = ledger.askOne({ ...ask, id: `class.${first}.${option.id}.feat`, label: `${option.name} — 기원 재주`, options: featOptions(catalog, ["origin"], featContext(ledger)) });
      const feat = featId ? catalog.featById(featId) : undefined;
      if (feat) applyFeat(ledger, feat, { key: [head, first, ...rest].join("."), sourceLabel: `${cls.name} · ${option.name}`, trackIndex: first });
    }
    if (option.targetKind === "damage-cantrip" || option.targetKind === "attack-cantrip") {
      // R93 (D228): the class cantrips are picked after the invocations, so the picks in the source count as known too.
      const known = [...new Set([...entry.cantrips, ...entry.extraCantrips, ...(ledger.source.choices[`class.${first}.cantrips`] ?? [])])].map((id) => catalog.spellById(id)).filter((spell): spell is NonNullable<typeof spell> => Boolean(spell));
      const target = ledger.askOne({ ...ask, id: `class.${first}.${option.id}.target`, label: `${option.name} — 대상 소마법`, description: `알고 있는 ${cls.name} 소마법 중 피해를 주는 것.`, options: known.map((spell) => ({ id: spell.id, name: spell.name, nameEn: spell.nameEn, summary: spell.summary })), optional: true });
      if (target) ledger.addFeatureTarget(option.id, target);
    }
    // H3 (D240): 그림자의 서, 심연의 선물, 마녀의 눈 — what an invocation grants is in its contract.
    applyGainContract(ledger, cls, first, option.id, option.name, cls.name);
  }
}

export const abilityLabel = (key: AbilityKey) => ABILITY_KO[key];
