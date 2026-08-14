import type { AbilityKey, CharacterCreationOptionVm } from "./contracts";
import creationIndexJson from "../../content/indexes/dnd-srd-5.2.1.character-creation.json";
import classesJson from "../../content/modules/dnd-srd-5.2.1.classes/module.json";
import originsJson from "../../content/modules/dnd-srd-5.2.1.origins/module.json";
import featsJson from "../../content/modules/dnd-srd-5.2.1.feats/module.json";
import loadoutsAJson from "../../content/modules/dnd-srd-5.2.1.starting-loadouts-a/module.json";
import loadoutsBJson from "../../content/modules/dnd-srd-5.2.1.starting-loadouts-b/module.json";
import loadoutsDJson from "../../content/modules/dnd-srd-5.2.1.starting-loadouts-d/module.json";
import rogueLoadoutJson from "../../content/modules/dnd-srd-5.2.1.starting-loadout-rogue/module.json";
import sorcererLoadoutJson from "../../content/modules/dnd-srd-5.2.1.starting-loadout-sorcerer/module.json";
import backgroundLoadoutJson from "../../content/modules/dnd-srd-5.2.1.starting-loadouts-backgrounds/module.json";
import simpleWeaponsJson from "../../content/modules/dnd-srd-5.2.1.equipment-simple-melee/module.json";
import martialMeleeJson from "../../content/modules/dnd-srd-5.2.1.equipment-martial-melee/module.json";
import martialRangedJson from "../../content/modules/dnd-srd-5.2.1.equipment-martial-ranged/module.json";
import armorJson from "../../content/modules/dnd-srd-5.2.1.equipment-armor/module.json";
import gearJson from "../../content/modules/dnd-srd-5.2.1.equipment-adventuring-core/module.json";
import booksJson from "../../content/modules/dnd-srd-5.2.1.equipment-books/module.json";
import packsJson from "../../content/modules/dnd-srd-5.2.1.equipment-packs/module.json";
import utilityJson from "../../content/modules/dnd-srd-5.2.1.equipment-starting-utility/module.json";
import toolsJson from "../../content/modules/dnd-srd-5.2.1.equipment-tools/module.json";
import { BACKGROUNDS, CLASSES, FIGHTER, SPECIES, opt, type Option } from "./srdCatalogBridge";

export { BACKGROUNDS, CLASSES, FIGHTER, SPECIES, opt, type Option };

type Config = Record<string, unknown>;
type Mechanic = { kind: string; config: Config };
export type Entry = {
  id: string;
  category: string;
  presentation: { originalName: string; locales: Record<string, { name: string; summary?: string }> };
  tags?: string[];
  progressionContributions?: Array<{ threshold: number; grants: string[] }>;
  mechanics?: Mechanic[];
};
type Module = { content: Entry[] };
type LoadoutChoice = { kind: string; itemIds?: string[]; categories?: string[]; quantity?: number };
type LoadoutOption = { id: string; items?: Array<{ itemId: string; quantity?: number }>; choices?: LoadoutChoice[]; gp?: number; startingGoldGp?: number; itemVariants?: Record<string, string> };
type LoadoutConfig = { ownerContentId: string; options: LoadoutOption[] };
type ClassDef = { hitDie: number; primaryAbilities: AbilityKey[]; savingThrowProficiencies: AbilityKey[]; skillChoiceCount: number; spellcasting?: string };
export type SpeciesDef = { size?: string[]; speed?: number; darkvision?: number; choices?: Record<string, unknown>; traits?: string[] };
export type BackgroundDef = { abilityChoices?: AbilityKey[]; abilityIncreaseModes?: string[]; skills?: string[]; tool?: string; toolChoice?: string; originFeat?: string; equipmentChoice?: boolean };
type WeaponDef = { training: "simple" | "martial"; mode: "melee" | "ranged"; properties: string[]; mastery?: string };
type ToolDef = { variants?: string[] };

type IndexOption = { id: string; name: string; nameEn: string; summary: string };
export type IndexedClassChoice = { id: string; kind: string; count: number; label: string; description: string; weaponFilter?: string; languagePool?: string; options?: IndexOption[] };
export type IndexedClassSemantics = {
  skills: { count: number; options: string[] | "any" };
  choices: IndexedClassChoice[];
  spells?: { cantrips?: number; prepared?: number; spellbook?: number; preparedFromSpellbook?: number; alwaysPrepared?: string[]; bonusCantripChoice?: { choiceId: string; value: string } };
};
export type IndexedSpeciesEffect = { cantrips?: string[]; prepared?: string[]; speed?: number; features?: string[] };
export type IndexedSpeciesSemantics = {
  baseCantrips?: string[];
  basePrepared?: string[];
  baseFeatures?: string[];
  extraChoices?: Array<{ id: string; label: string; description: string; count: number; options: IndexOption[] }>;
  byChoice?: Record<string, Record<string, IndexedSpeciesEffect>>;
};
type CreationIndex = {
  source: Record<string, string>;
  skills: Record<string, string>;
  standardLanguages: IndexOption[];
  generalLanguages: IndexOption[];
  classes: Record<string, IndexedClassSemantics>;
  species?: Record<string, IndexedSpeciesSemantics>;
  spellLists: Record<string, Record<"0" | "1", string[]>>;
  instrumentVariants: string[];
  gamingSetVariants: string[];
  artisanToolIds: string[];
};

const INDEX = creationIndexJson as unknown as CreationIndex;
export const CREATION_SOURCE = `SRD 5.2.1 · ${INDEX.source.translationRevision.slice(0, 8)}`;
export const SKILL_LABELS = INDEX.skills;
export const ALL_SKILLS = Object.values(SKILL_LABELS);
const asModule = (value: unknown) => value as Module;
const entries = (value: unknown) => asModule(value).content;
export const config = <T,>(entry: Entry, kind: string): T | undefined => entry.mechanics?.find((item) => item.kind === kind)?.config as T | undefined;
export const entryName = (entry: Entry) => entry.presentation.locales["ko-KR"]?.name ?? entry.presentation.originalName;
const option = (id: string, name: string, nameEn: string, summary: string, grants: string[] = []): Option => opt(id, name, nameEn, summary, grants);

const classEntries = entries(classesJson).filter((entry) => entry.category === "class");
const originEntries = entries(originsJson);
const featEntries = entries(featsJson);
const loadoutEntries = [loadoutsAJson, loadoutsBJson, loadoutsDJson, rogueLoadoutJson, sorcererLoadoutJson, backgroundLoadoutJson].flatMap(entries);
const itemEntries = [simpleWeaponsJson, martialMeleeJson, martialRangedJson, armorJson, gearJson, booksJson, packsJson, utilityJson, toolsJson].flatMap(entries);
const itemById = new Map(itemEntries.map((entry) => [entry.id, entry]));
const classById = new Map(classEntries.map((entry) => [entry.id, entry]));
const speciesEntries = originEntries.filter((entry) => entry.category === "species");
const backgroundEntries = originEntries.filter((entry) => entry.category === "background");
const EMPTY_ENTRY: Entry = { id:"__empty__", category:"", presentation:{ originalName:"", locales:{} }, mechanics:[] };

export const classIdFromName = (name: string) => CLASSES.find((entry) => entry.name === name || entry.nameEn === name || entry.id === name)?.id ?? "dnd.srd521.class.fighter";
export const speciesIdFromName = (name: string) => speciesEntries.find((entry) => entryName(entry) === name || entry.presentation.originalName === name || entry.id === name)?.id ?? "";
export const backgroundIdFromName = (name: string) => backgroundEntries.find((entry) => entryName(entry) === name || entry.presentation.originalName === name || entry.id === name)?.id ?? "";
export const classSemantics = (classId: string): IndexedClassSemantics => INDEX.classes[classId] ?? { skills: { count: 0, options: [] }, choices: [] };
export const classDefinition = (classId: string) => config<ClassDef>(classById.get(classId) ?? EMPTY_ENTRY, "class-definition");
export const speciesDefinition = (name: string) => config<SpeciesDef>(speciesEntries.find((entry) => entryName(entry) === name) ?? EMPTY_ENTRY, "species-definition") ?? {};
export const backgroundDefinition = (name: string) => config<BackgroundDef>(backgroundEntries.find((entry) => entryName(entry) === name) ?? EMPTY_ENTRY, "background-definition") ?? {};
export const speciesTraits = (name: string) => speciesDefinition(name).traits ?? [];
export const speciesSemantics = (name: string): IndexedSpeciesSemantics => INDEX.species?.[speciesIdFromName(name)] ?? {};

export function classSkillOptions(classId: string): Option[] {
  const semantic = classSemantics(classId).skills;
  const ids = semantic.options === "any" ? Object.keys(SKILL_LABELS) : semantic.options;
  return ids.map((id) => option(`skill.${id}`, SKILL_LABELS[id] ?? id, id, "SRD 클래스 기술 숙련 후보", ["기술 숙련"]));
}

export const originFeatOptions = featEntries
  .filter((entry) => entry.category === "feat" && entry.tags?.includes("origin"))
  .map((entry) => option(entry.id, entryName(entry), entry.presentation.originalName, "SRD 기원 재주", ["Origin Feat"]));

const instrumentNames: Record<string, string> = { bagpipes:"백파이프", drum:"북", dulcimer:"덜시머", flute:"플루트", horn:"호른", lute:"류트", lyre:"리라", "pan-flute":"팬파이프", shawm:"숌", viol:"비올" };
const gamingNames: Record<string, string> = { dice:"주사위 세트", dragonchess:"드래곤 체스", "playing-cards":"카드 세트", "three-dragon-ante":"쓰리 드래곤 앤티" };
export const instrumentOptions = INDEX.instrumentVariants.map((id) => option(`instrument.${id}`, instrumentNames[id] ?? id, id, "악기 종류", ["악기 숙련"]));
export const gamingSetOptions = INDEX.gamingSetVariants.map((id) => option(`gaming-set.${id}`, gamingNames[id] ?? id, id, "게임 도구 종류", ["게임 도구 숙련"]));
export const artisanToolOptions = INDEX.artisanToolIds.map((id) => itemById.get(id)).filter((entry): entry is Entry => Boolean(entry)).map((entry) => option(entry.id, entryName(entry), entry.presentation.originalName, "장인 도구", ["도구 숙련"]));
const specialToolEntries = itemEntries.filter((entry) => entry.category === "tool" && !INDEX.artisanToolIds.includes(entry.id) && !["dnd.srd521.item.tool.musical-instrument", "dnd.srd521.item.tool.gaming-set"].includes(entry.id));
export const specialToolOptions = specialToolEntries.map((entry) => option(entry.id, entryName(entry), entry.presentation.originalName, "도구 숙련", ["도구 숙련"]));
export const allToolProficiencyOptions = [...artisanToolOptions, ...specialToolOptions, ...instrumentOptions, ...gamingSetOptions];
export const monkToolOptions = [...artisanToolOptions, ...instrumentOptions];
export const standardLanguageOptions = INDEX.standardLanguages.map((entry) => option(`language.${entry.id}`, entry.name, entry.nameEn, "표준 언어", ["언어"]));
export const generalLanguageOptions = INDEX.generalLanguages.map((entry) => option(`language.${entry.id}`, entry.name, entry.nameEn, "언어", ["언어"]));

const weaponEntries = itemEntries.filter((entry) => entry.category === "weapon" && config<WeaponDef>(entry, "weapon-definition"));
export function weaponMasteryOptions(filter: string): Option[] {
  return weaponEntries.filter((entry) => {
    const def = config<WeaponDef>(entry, "weapon-definition")!;
    if (filter === "simple-or-martial-melee") return def.mode === "melee";
    if (filter === "rogue-proficient") return def.training === "simple" || def.properties.some((value) => value === "finesse" || value === "light");
    return true;
  }).map((entry) => {
    const def = config<WeaponDef>(entry, "weapon-definition")!;
    return option(entry.id, entryName(entry), entry.presentation.originalName, `통달 · ${def.mastery ?? "—"}`, [`${def.training} ${def.mode}`]);
  });
}

export const fightingStyleOptions = FIGHTER;

function loadoutConfig(entry: Entry) { return config<LoadoutConfig>(entry, "starting-loadout-definition"); }
const loadoutMap = new Map<string, { entry: Entry; option: LoadoutOption }>();
for (const loadout of loadoutEntries) for (const item of loadoutConfig(loadout)?.options ?? []) loadoutMap.set(`${loadout.id}#${item.id}`, { entry: loadout, option: item });
export function loadoutOptions(ownerId: string): Option[] {
  const loadout = loadoutEntries.find((entry) => loadoutConfig(entry)?.ownerContentId === ownerId);
  if (!loadout) return [];
  return (loadoutConfig(loadout)?.options ?? []).map((item, index) => {
    const names = (item.items ?? []).map((row) => itemById.get(row.itemId)).filter((entry): entry is Entry => Boolean(entry)).map(entryName);
    const detail = item.startingGoldGp !== undefined ? `시작 금화 ${item.startingGoldGp} GP` : `${names.slice(0, 5).join(" + ")}${names.length > 5 ? ` 외 ${names.length - 5}` : ""}${item.gp !== undefined ? ` · ${item.gp} GP` : ""}`;
    return { ...option(`${loadout.id}#${item.id}`, item.startingGoldGp !== undefined ? `금화 ${item.startingGoldGp} GP` : `${item.id} 장비 세트`, item.id, detail || "시작 장비", ["SRD starting-loadout-definition"]), recommended: index === 0 };
  });
}
export const loadoutRaw = (preset: string) => loadoutMap.get(preset)?.option;
export const loadoutNested = (preset: string) => loadoutRaw(preset)?.choices ?? [];

export function loadoutNestedOptions(choice: LoadoutChoice): Option[] {
  if (choice.kind === "choose-one") return (choice.itemIds ?? []).map((id) => itemById.get(id)).filter((entry): entry is Entry => Boolean(entry)).map((entry) => option(entry.id, entryName(entry), entry.presentation.originalName, "시작 장비 하위 선택", ["장비"]));
  if (choice.kind === "tool-variant") return instrumentOptions.map((entry) => ({ ...entry, id: `dnd.srd521.item.tool.musical-instrument#${entry.id.replace("instrument.", "")}` }));
  if (choice.kind === "catalog-filter") return monkToolOptions;
  return [];
}

export type ResolvedItem = { id: string; quantity: number; entry: Entry; variant?: string; name: string };
export function resolveLoadout(preset: string, selections: Record<string, string[]> = {}, choicePrefix = "loadout"): { items: ResolvedItem[]; gp: number } {
  const row = loadoutMap.get(preset)?.option;
  if (!row) return { items: [], gp: 0 };
  const result: ResolvedItem[] = [];
  for (const item of row.items ?? []) {
    const entry = itemById.get(item.itemId);
    if (entry) result.push({ id: item.itemId, quantity: item.quantity ?? 1, entry, variant: row.itemVariants?.[item.itemId], name: entryName(entry) });
  }
  (row.choices ?? []).forEach((choice, index) => {
    const selected = selections[`${choicePrefix}.${index}`] ?? [];
    for (const selectedId of selected) {
      if (selectedId.startsWith("instrument.")) {
        const entry = itemById.get("dnd.srd521.item.tool.musical-instrument");
        if (entry) result.push({ id: entry.id, quantity: choice.quantity ?? 1, entry, variant: selectedId.replace("instrument.", ""), name: instrumentNames[selectedId.replace("instrument.", "")] ?? entryName(entry) });
        continue;
      }
      if (selectedId.startsWith("dnd.srd521.item.tool.musical-instrument#")) {
        const entry = itemById.get("dnd.srd521.item.tool.musical-instrument");
        const variant = selectedId.split("#")[1];
        if (entry) result.push({ id: entry.id, quantity: choice.quantity ?? 1, entry, variant, name: instrumentNames[variant] ?? entryName(entry) });
        continue;
      }
      const entry = itemById.get(selectedId);
      if (entry) result.push({ id: entry.id, quantity: choice.quantity ?? 1, entry, name: entryName(entry) });
    }
  });
  return { items: result, gp: row.startingGoldGp ?? row.gp ?? 0 };
}

export function abilityIncreaseOptions(backgroundName: string): Option[] {
  const def = backgroundDefinition(backgroundName);
  const abilities = def.abilityChoices ?? [];
  const labels: Record<AbilityKey, string> = { str:"근력", dex:"민첩", con:"건강", int:"지능", wis:"지혜", cha:"매력" };
  const result: Option[] = [];
  for (const primary of abilities) for (const secondary of abilities) if (primary !== secondary) result.push(option(`ability-bonus.${primary}+2.${secondary}+1`, `${labels[primary]} +2 / ${labels[secondary]} +1`, `${primary}+2 ${secondary}+1`, "배경 능력치 증가 2+1", ["최대 20"]));
  if (abilities.length === 3) result.push(option(`ability-bonus.${abilities.join("+")}+1`, abilities.map((key) => `${labels[key]} +1`).join(" / "), "1+1+1", "배경 능력치 증가 1+1+1", ["최대 20"]));
  return result;
}

export function backgroundAbilityBonuses(selection: string | undefined): Partial<Record<AbilityKey, number>> {
  if (!selection?.startsWith("ability-bonus.")) return {};
  const body = selection.slice("ability-bonus.".length);
  if (body.endsWith("+1") && body.split(".").length === 1) {
    const keys = body.slice(0, -2).split("+") as AbilityKey[];
    return Object.fromEntries(keys.map((key) => [key, 1]));
  }
  const parts = body.split(".");
  const out: Partial<Record<AbilityKey, number>> = {};
  for (const part of parts) {
    const match = part.match(/^(str|dex|con|int|wis|cha)\+(1|2)$/);
    if (match) out[match[1] as AbilityKey] = Number(match[2]);
  }
  return out;
}

export function spellId(nameEn: string) {
  const ascii = nameEn.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const slug = ascii.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `dnd.srd521.spell.${slug}`;
}
export function spellOptions(classId: string, level: 0 | 1): Option[] {
  const names = INDEX.spellLists[classId]?.[String(level) as "0" | "1"] ?? [];
  return names.map((nameEn) => option(spellId(nameEn), nameEn, nameEn, level === 0 ? "SRD 소마법" : "SRD 1레벨 주문", ["SRD 5.2.1 class spell list"]));
}

export function classMeta(classId: string) {
  const def = classDefinition(classId) ?? { hitDie: 8, primaryAbilities: ["str" as AbilityKey], savingThrowProficiencies: [] as AbilityKey[], skillChoiceCount: 0 };
  const entry = classById.get(classId);
  const level1 = entry?.progressionContributions?.find((row) => row.threshold === 1)?.grants ?? [];
  const rec = [...def.primaryAbilities];
  for (const fallback of ["con","dex","wis","str","cha","int"] as AbilityKey[]) if (!rec.includes(fallback) && rec.length < 2) rec.push(fallback);
  const semanticChoiceTokens = new Set(["fighter.fighting-style-choice","fighter.weapon-mastery-choice","barbarian.weapon-mastery","paladin.weapon-mastery","ranger.weapon-mastery","rogue.weapon-mastery","rogue.expertise","warlock.invocation-choice","cleric.divine-order-choice","druid.primal-order-choice"]);
  return { hit: def.hitDie, saves: def.savingThrowProficiencies, rec: rec.slice(0,2), features: level1.filter((value) => !semanticChoiceTokens.has(value)), semantics: classSemantics(classId), spellcasting: def.spellcasting };
}

export function itemMechanic(entry: Entry, kind: string) { return entry.mechanics?.find((item) => item.kind === kind)?.config; }
export function itemDisplayName(item: ResolvedItem) { return item.variant ? `${item.name} · ${item.variant}` : item.name; }
export const itemEntryById = (id: string) => itemById.get(id);
export const backgroundOriginFeat = (backgroundName: string) => backgroundDefinition(backgroundName).originFeat;
export const backgroundSkills = (backgroundName: string) => backgroundDefinition(backgroundName).skills ?? [];
export const backgroundTool = (backgroundName: string) => backgroundDefinition(backgroundName).tool;
export const backgroundToolChoice = (backgroundName: string) => backgroundDefinition(backgroundName).toolChoice;
export const classLoadoutOptions = (classId: string) => loadoutOptions(classId);
export const backgroundLoadoutOptions = (backgroundName: string) => loadoutOptions(backgroundIdFromName(backgroundName));
export const classEntry = (classId: string) => classById.get(classId);
export const featEntry = (id: string) => featEntries.find((entry) => entry.id === id);
function canonicalFeatId(id: string | undefined) {
  if (!id) return undefined;
  if (id === "dnd.srd521.feat.magic-initiate-cleric" || id === "dnd.srd521.feat.magic-initiate-wizard") return "dnd.srd521.feat.magic-initiate";
  return id;
}
export function humanOriginFeatOptions(backgroundName: string): Option[] {
  const existing = canonicalFeatId(backgroundOriginFeat(backgroundName));
  return originFeatOptions.filter((item) => {
    if (item.id !== existing) return true;
    const def = config<{ repeatable?: boolean }>(featEntries.find((entry) => entry.id === item.id) ?? EMPTY_ENTRY, "feat-definition");
    return def?.repeatable === true;
  });
}

export const toolDefinition = (id: string) => config<ToolDef>(itemById.get(id) ?? EMPTY_ENTRY, "tool-definition");
export type { CharacterCreationOptionVm };
