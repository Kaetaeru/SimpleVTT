import type { AbilityKey, CharacterCreationOptionVm } from "./contracts";
import classesJson from "../../content/modules/dnd-srd-5.2.1.classes/module.json";
import originsJson from "../../content/modules/dnd-srd-5.2.1.origins/module.json";
import featsJson from "../../content/modules/dnd-srd-5.2.1.feats/module.json";
import loadoutsAJson from "../../content/modules/dnd-srd-5.2.1.starting-loadouts-a/module.json";
import loadoutsBJson from "../../content/modules/dnd-srd-5.2.1.starting-loadouts-b/module.json";
import loadoutsDJson from "../../content/modules/dnd-srd-5.2.1.starting-loadouts-d/module.json";
import rogueLoadoutJson from "../../content/modules/dnd-srd-5.2.1.starting-loadout-rogue/module.json";
import sorcererLoadoutJson from "../../content/modules/dnd-srd-5.2.1.starting-loadout-sorcerer/module.json";
import simpleWeaponsJson from "../../content/modules/dnd-srd-5.2.1.equipment-simple-melee/module.json";
import martialMeleeJson from "../../content/modules/dnd-srd-5.2.1.equipment-martial-melee/module.json";
import martialRangedJson from "../../content/modules/dnd-srd-5.2.1.equipment-martial-ranged/module.json";
import armorJson from "../../content/modules/dnd-srd-5.2.1.equipment-armor/module.json";
import gearJson from "../../content/modules/dnd-srd-5.2.1.equipment-adventuring-core/module.json";
import booksJson from "../../content/modules/dnd-srd-5.2.1.equipment-books/module.json";
import packsJson from "../../content/modules/dnd-srd-5.2.1.equipment-packs/module.json";
import utilityJson from "../../content/modules/dnd-srd-5.2.1.equipment-starting-utility/module.json";
import toolsJson from "../../content/modules/dnd-srd-5.2.1.equipment-tools/module.json";
import fighterSemantic from "../../tools/srd521/semantics/classes/fighter.json";
import barbarianSemantic from "../../tools/srd521/semantics/classes/barbarian.json";
import bardSemantic from "../../tools/srd521/semantics/classes/bard.json";

export type Option = Omit<CharacterCreationOptionVm, "selected">;
type Config = Record<string, unknown>;
type Mechanic = { kind: string; config: Config };
type Entry = {
  id: string;
  category: string;
  presentation: { originalName: string; locales: Record<string, { name: string; summary?: string }> };
  tags?: string[];
  progressionContributions?: Array<{ threshold: number; grants: string[] }>;
  mechanics?: Mechanic[];
};
type Module = { content: Entry[] };
type LoadoutOption = { id: string; items?: Array<{ itemId: string; quantity?: number }>; choices?: unknown[]; gp?: number; startingGoldGp?: number };
type LoadoutConfig = { ownerContentId: string; options: LoadoutOption[] };
type ClassDef = { hitDie: number; primaryAbilities: AbilityKey[]; savingThrowProficiencies: AbilityKey[]; skillChoiceCount: number; spellcasting?: string };
type SpeciesDef = { size?: string[]; speed?: number; darkvision?: number; choices?: Record<string, unknown>; traits?: string[] };
type BackgroundDef = { abilityChoices?: AbilityKey[]; abilityIncreaseModes?: string[]; skills?: string[]; tool?: string; toolChoice?: string; originFeat?: string; equipmentChoice?: boolean };

const asModule = (value: unknown) => value as Module;
const entries = (value: unknown) => asModule(value).content;
const cfg = <T,>(entry: Entry, kind: string): T | undefined => entry.mechanics?.find((item) => item.kind === kind)?.config as T | undefined;
const ko = (entry: Entry) => entry.presentation.locales["ko-KR"]?.name ?? entry.presentation.originalName;
const summary = (entry: Entry) => entry.presentation.locales["ko-KR"]?.summary ?? `${entry.presentation.originalName} · SRD 5.2.1`;
export const opt = (id: string, name: string, nameEn: string, text: string, grants: string[], choices: string[] = [], recommended = false): Option => ({ id, name, nameEn, summary: text, source: "SRD 5.2.1 · Catalog", recommended, grants, choices });
const pretty = (value: string) => value.split(/[.\-]/).slice(-3).join(" ");
const ABILITY: Record<AbilityKey, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };
export const SKILL_LABELS: Record<string, string> = { "acrobatics":"곡예", "animal-handling":"동물 조련", "arcana":"비전", "athletics":"운동", "deception":"기만", "history":"역사", "insight":"통찰", "intimidation":"위협", "investigation":"조사", "medicine":"의학", "nature":"자연", "perception":"지각", "performance":"공연", "persuasion":"설득", "religion":"종교", "sleight-of-hand":"손재주", "stealth":"은신", "survival":"생존" };
const ALL_SKILLS = Object.values(SKILL_LABELS);

const classEntries = entries(classesJson).filter((entry) => entry.category === "class");
const originEntries = entries(originsJson);
const featEntries = entries(featsJson);
const loadoutEntries = [loadoutsAJson, loadoutsBJson, loadoutsDJson, rogueLoadoutJson, sorcererLoadoutJson].flatMap(entries);
const itemEntries = [simpleWeaponsJson, martialMeleeJson, martialRangedJson, armorJson, gearJson, booksJson, packsJson, utilityJson, toolsJson].flatMap(entries);
const itemById = new Map(itemEntries.map((entry) => [entry.id, entry]));

function classOption(entry: Entry): Option {
  const def = cfg<ClassDef>(entry, "class-definition");
  const level1 = entry.progressionContributions?.find((item) => item.threshold === 1)?.grants ?? [];
  const grants = def ? [`Hit Die d${def.hitDie}`, `주 능력 ${def.primaryAbilities.map((key) => ABILITY[key]).join(" / ")}`, `${def.savingThrowProficiencies.map((key) => ABILITY[key]).join(" · ")} 내성`, ...(def.spellcasting ? [`주문 시전 · ${def.spellcasting}`] : [])] : [];
  const choices = level1.filter((value) => value.includes("choice")).map((value) => `레벨 1 선택 · ${pretty(value)}`);
  return opt(entry.id, ko(entry), entry.presentation.originalName, summary(entry), grants, choices);
}
function speciesOption(entry: Entry): Option {
  const def = cfg<SpeciesDef>(entry, "species-definition") ?? {};
  const grants = [...(def.size?.length ? [`크기 ${def.size.join(" / ")}`] : []), ...(def.speed ? [`이동 ${def.speed} ft`] : []), ...(def.darkvision ? [`암시야 ${def.darkvision} ft`] : []), ...(def.traits ?? []).slice(0, 3).map((value) => pretty(value))];
  return opt(entry.id, ko(entry), entry.presentation.originalName, summary(entry), grants, Object.keys(def.choices ?? {}).map((value) => `선택 · ${pretty(value)}`));
}
function backgroundOption(entry: Entry): Option {
  const def = cfg<BackgroundDef>(entry, "background-definition") ?? {};
  const grants = [...(def.skills?.map((value) => `${SKILL_LABELS[value] ?? value} 숙련`) ?? []), ...(def.originFeat ? [`Origin Feat · ${pretty(def.originFeat)}`] : []), ...((def.tool || def.toolChoice) ? [`도구 · ${pretty(def.tool ?? def.toolChoice!)}`] : [])];
  const choices = [...(def.abilityIncreaseModes?.map((value) => `능력치 증가 ${value}`) ?? []), ...(def.equipmentChoice ? ["시작 장비 또는 시작 금화"] : [])];
  return opt(entry.id, ko(entry), entry.presentation.originalName, summary(entry), grants, choices);
}
function fightingStyleOption(entry: Entry): Option {
  const def = cfg<Record<string, unknown>>(entry, "feat-definition") ?? {};
  let text = "Fighting Style Feat";
  if (typeof def.armorAcBonus === "number") text = `방어구 착용 중 AC +${def.armorAcBonus}`;
  else if (typeof def.rangedWeaponAttackBonus === "number") text = `원거리 무기 공격 굴림 +${def.rangedWeaponAttackBonus}`;
  else if (typeof def.damageDieMinimum === "number") text = `대형/양손 무기 피해 주사위 최솟값 ${def.damageDieMinimum}`;
  else if (def.lightExtraAttackAbilityModifier) text = "경량 무기 추가 공격에 능력 수정치 적용";
  return opt(entry.id, ko(entry), entry.presentation.originalName, text, ["SRD Fighting Style Feat"]);
}

export const CLASSES = classEntries.map(classOption);
export const SPECIES = originEntries.filter((entry) => entry.category === "species").map(speciesOption);
export const BACKGROUNDS = originEntries.filter((entry) => entry.category === "background").map(backgroundOption);
export const FIGHTER = featEntries.filter((entry) => entry.category === "feat" && entry.tags?.includes("fighting-style")).map(fightingStyleOption);

const demoSpell = (id: string, name: string, nameEn: string, text: string, recommended = false) => ({ ...opt(id, name, nameEn, text, ["DEMO spell choice · class list mapping pending"], [], recommended), source: "DEMO fallback · SRD spell-list mapping pending" });
export const SPELLS: Record<string, Option[]> = {
  "dnd.srd521.class.bard": [demoSpell("spell.healing-word", "치유의 단어", "Healing Word", "원거리 회복 주문", true), demoSpell("spell.vicious-mockery", "신랄한 조롱", "Vicious Mockery", "지혜 내성 정신 공격", true), demoSpell("spell.thunderwave", "천둥파", "Thunderwave", "범위 천둥 주문")],
  "dnd.srd521.class.wizard": [demoSpell("spell.magic-missile", "마법 미사일", "Magic Missile", "자동 명중 역장 주문", true), demoSpell("spell.shield", "방패", "Shield", "공격에 반응하는 방어 주문", true), demoSpell("spell.thunderwave", "천둥파", "Thunderwave", "범위 천둥 주문")],
  "dnd.srd521.class.cleric": [demoSpell("spell.healing-word", "치유의 단어", "Healing Word", "원거리 회복 주문", true), demoSpell("spell.guiding-bolt", "인도하는 화살", "Guiding Bolt", "빛나는 원거리 주문 공격", true), demoSpell("spell.sacred-flame", "신성한 불꽃", "Sacred Flame", "민첩 내성 신성 공격")],
};

function loadoutConfig(entry: Entry) { return cfg<LoadoutConfig>(entry, "starting-loadout-definition"); }
function labelLoadout(option: LoadoutOption) {
  if (option.startingGoldGp !== undefined) return `시작 금화 ${option.startingGoldGp} GP`;
  const names = (option.items ?? []).map((item) => itemById.get(item.itemId)).filter((entry): entry is Entry => Boolean(entry)).map(ko);
  const visible = names.slice(0, 4).join(" + ");
  const rest = names.length > 4 ? ` 외 ${names.length - 4}` : "";
  const choice = option.choices?.length ? ` · 추가 선택 ${option.choices.length}` : "";
  return `${visible || "시작 장비"}${rest}${choice}${option.gp !== undefined ? ` · ${option.gp} GP` : ""}`;
}

export type Meta = { hit: number; saves: string[]; rec: AbilityKey[]; skills: string[]; skillCount: number; skillsMapped: boolean; gear: Array<{ id: string; label: string }>; features: string[]; pendingChoices: string[] };
function skillData(classId: string, count: number) {
  if (classId === fighterSemantic.classId) return { count: fighterSemantic.skillChoice.min, skills: fighterSemantic.skillChoice.options.map((value) => SKILL_LABELS[value] ?? value), mapped: true };
  if (classId === barbarianSemantic.classId) return { count: barbarianSemantic.core.skillChoice.count, skills: barbarianSemantic.core.skillChoice.options.map((value) => SKILL_LABELS[value] ?? value), mapped: true };
  if (classId === bardSemantic.classId) return { count: 3, skills: ALL_SKILLS, mapped: true };
  return { count, skills: [] as string[], mapped: false };
}
function classMeta(entry: Entry): Meta {
  const def = cfg<ClassDef>(entry, "class-definition") ?? { hitDie: 8, primaryAbilities: ["str"], savingThrowProficiencies: [], skillChoiceCount: 2 };
  const level1 = entry.progressionContributions?.find((item) => item.threshold === 1)?.grants ?? [];
  const skill = skillData(entry.id, def.skillChoiceCount);
  const rec = [...def.primaryAbilities];
  for (const fallback of ["con", "dex", "wis", "str", "cha", "int"] as AbilityKey[]) if (!rec.includes(fallback) && rec.length < 2) rec.push(fallback);
  const loadout = loadoutEntries.find((item) => loadoutConfig(item)?.ownerContentId === entry.id);
  const gear = (loadoutConfig(loadout ?? ({ mechanics: [] } as unknown as Entry))?.options ?? []).map((option) => ({ id: `${loadout!.id}#${option.id}`, label: labelLoadout(option) }));
  const supportedChoices = entry.id === "dnd.srd521.class.fighter" ? new Set(["fighter.fighting-style-choice"]) : new Set<string>();
  return { hit: def.hitDie, saves: def.savingThrowProficiencies.map((key) => ABILITY[key]), rec: rec.slice(0, 2), skills: skill.skills, skillCount: skill.count, skillsMapped: skill.mapped, gear, features: level1.filter((value) => !value.includes("choice")).map(pretty), pendingChoices: level1.filter((value) => value.includes("choice") && !supportedChoices.has(value)) };
}
export const META: Record<string, Meta> = Object.fromEntries(classEntries.map((entry) => [entry.id, classMeta(entry)]));
export const classIdFromName = (name: string) => CLASSES.find((entry) => entry.name === name || entry.nameEn === name || entry.id === name)?.id ?? "dnd.srd521.class.fighter";

const presetMap = new Map<string, { loadout: Entry; option: LoadoutOption }>();
for (const loadout of loadoutEntries) for (const option of loadoutConfig(loadout)?.options ?? []) presetMap.set(`${loadout.id}#${option.id}`, { loadout, option });
export function equipmentForPreset(preset: string) {
  const selected = presetMap.get(preset)?.option;
  return (selected?.items ?? []).map((item) => ({ id: item.itemId, quantity: item.quantity ?? 1, entry: itemById.get(item.itemId) })).filter((item): item is { id: string; quantity: number; entry: Entry } => Boolean(item.entry));
}
export function acFromEquipmentPreset(preset: string, dexMod: number) {
  let ac = 10 + dexMod;
  let shield = 0;
  for (const item of equipmentForPreset(preset)) {
    const armor = cfg<{ ac: { base: number; dex?: string; dexMax?: number } }>(item.entry, "armor-definition");
    const shieldDef = cfg<{ acBonus: number }>(item.entry, "shield-definition");
    if (armor) ac = armor.ac.base + (armor.ac.dex === "full" ? dexMod : armor.ac.dexMax !== undefined ? Math.min(dexMod, armor.ac.dexMax) : 0);
    if (shieldDef) shield += shieldDef.acBonus;
  }
  return ac + shield;
}
export function itemName(entry: Entry) { return ko(entry); }
export function itemMechanic(entry: Entry, kind: string) { return entry.mechanics?.find((item) => item.kind === kind)?.config; }
