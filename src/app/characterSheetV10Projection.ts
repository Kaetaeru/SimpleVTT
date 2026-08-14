import "./creationContracts";
import type { AbilityKey, CharacterSheet } from "./contracts";
import type { CharacterSheetSpellVm, CharacterSheetTraitVm } from "./creationContracts";
import { classIdFromName, classMeta, classSemantics, originFeatOptions, spellOptions } from "./characterCreationV10Data";
import { featDescription, featureDescription, featureLabel } from "./rulePresentation";

export const SHEET_ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "근력",
  dex: "민첩",
  con: "건강",
  int: "지능",
  wis: "지혜",
  cha: "매력",
};

export const SHEET_SKILLS: Array<{ name: string; ability: AbilityKey }> = [
  { name:"운동", ability:"str" },
  { name:"곡예", ability:"dex" },
  { name:"손재주", ability:"dex" },
  { name:"은신", ability:"dex" },
  { name:"비전", ability:"int" },
  { name:"역사", ability:"int" },
  { name:"조사", ability:"int" },
  { name:"자연", ability:"int" },
  { name:"종교", ability:"int" },
  { name:"동물 조련", ability:"wis" },
  { name:"통찰", ability:"wis" },
  { name:"의학", ability:"wis" },
  { name:"지각", ability:"wis" },
  { name:"생존", ability:"wis" },
  { name:"기만", ability:"cha" },
  { name:"위협", ability:"cha" },
  { name:"공연", ability:"cha" },
  { name:"설득", ability:"cha" },
];

const SKILLS_BY_ABILITY: Record<AbilityKey, string[]> = {
  str: SHEET_SKILLS.filter((item) => item.ability === "str").map((item) => item.name),
  dex: SHEET_SKILLS.filter((item) => item.ability === "dex").map((item) => item.name),
  con: [],
  int: SHEET_SKILLS.filter((item) => item.ability === "int").map((item) => item.name),
  wis: SHEET_SKILLS.filter((item) => item.ability === "wis").map((item) => item.name),
  cha: SHEET_SKILLS.filter((item) => item.ability === "cha").map((item) => item.name),
};

const mod = (score: number) => Math.floor((score - 10) / 2);
export const signed = (value: number) => value >= 0 ? `+${value}` : String(value);
const cleanKey = (value: string) => value.split(".").at(-1)?.replaceAll("-", " ") ?? value;
const titleCase = (value: string) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

function choiceTraits(c: CharacterSheet, owner: "class" | "species" | "background"): CharacterSheetTraitVm[] {
  const entries = Object.entries(c.creationSelections ?? {});
  return entries.flatMap(([key, values]) => {
    if (!key.startsWith(`${owner}.`) || values.length === 0) return [];
    if (/(spells|spellbook|prepared|cantrips|loadout|equipment|ability|size)/.test(key)) return [];
    const choice = cleanKey(key);
    return values.map((value, index) => ({
      id:`${key}.${index}`,
      name:`${titleCase(choice)} · ${titleCase(cleanKey(value))}`,
      source:owner === "background" ? "background" : owner,
      sourceLabel:owner === "class" ? `직업 · ${c.className}` : owner === "species" ? `종족 · ${c.species}` : `배경 · ${c.background}`,
      detailLines:[`선택 ID · ${key}`, `값 · ${value}`],
    }));
  });
}

function originFeats(c: CharacterSheet): CharacterSheetTraitVm[] {
  const known = originFeatOptions.map((item) => ({ id:item.id, name:item.name }));
  const result: CharacterSheetTraitVm[] = [];
  for (const feature of c.features) {
    const direct = known.find((item) => feature === item.name);
    const magic = feature.startsWith("마법 입문자") ? known.find((item) => item.id === "dnd.srd521.feat.magic-initiate") : undefined;
    const found = direct ?? magic;
    if (!found) continue;
    if (result.some((item) => item.id === `${found.id}:${feature}`)) continue;
    result.push({
      id:`${found.id}:${feature}`,
      name:feature,
      source:"feat",
      sourceLabel:"기원 재주",
      description:featDescription(found.id),
      detailLines:[found.id, "SRD 5.2.1"],
    });
  }
  return result;
}

function classAutomatic(c: CharacterSheet): CharacterSheetTraitVm[] {
  const classId = classIdFromName(c.className);
  return classMeta(classId).features.map((token) => ({
    id:token,
    name:featureLabel(token),
    source:"class" as const,
    sourceLabel:`직업 · ${c.className}`,
    description:featureDescription(token),
    detailLines:[token, "레벨 1 자동 획득"],
  }));
}

function speciesAutomatic(c: CharacterSheet, classFeatures: CharacterSheetTraitVm[], feats: CharacterSheetTraitVm[]): CharacterSheetTraitVm[] {
  const classTokens = new Set(classFeatures.map((item) => item.id));
  const featNames = new Set(feats.map((item) => item.name));
  return c.features
    .filter((feature) => !classTokens.has(feature) && !featNames.has(feature) && !feature.includes(" · "))
    .map((feature) => ({
      id:`species.auto.${feature}`,
      name:featureLabel(feature),
      source:"species" as const,
      sourceLabel:`종족 · ${c.species}`,
      detailLines:[feature, "종족 자동 획득"],
    }));
}

function spellNameMap(c: CharacterSheet) {
  const classId = classIdFromName(c.className);
  const options = [...spellOptions(classId, 0), ...spellOptions(classId, 1)];
  return new Map(options.map((item) => [item.id, item]));
}

function spellEntries(c: CharacterSheet): CharacterSheetSpellVm[] {
  const names = spellNameMap(c);
  const cantrips = new Set(c.cantrips ?? []);
  const preparedRaw = c.preparedSpells ?? [];
  const prepared = new Set(preparedRaw.map((id) => id.replace(/^always:/, "")));
  const always = new Set(preparedRaw.filter((id) => id.startsWith("always:")).map((id) => id.slice("always:".length)));
  const spellbook = new Set(c.spellbookSpells ?? []);
  const ids = [...new Set([...cantrips, ...prepared, ...spellbook])];
  return ids.map((id) => {
    const option = names.get(id);
    const level = cantrips.has(id) ? 0 : 1;
    const raw = id.replace(/^dnd\.srd521\.spell\./, "").replaceAll("-", " ");
    return {
      id,
      name:option?.name ?? titleCase(raw),
      nameEn:option?.nameEn,
      level,
      prepared:cantrips.has(id) || prepared.has(id),
      alwaysPrepared:always.has(id),
      description:option?.description,
      detailLines:[level === 0 ? "소마법" : "1레벨 주문", ...(spellbook.has(id) ? ["주문서"] : []), ...(always.has(id) ? ["항상 준비"] : []), "SRD 5.2.1"],
    };
  });
}

function expertiseSet(c: CharacterSheet) {
  return new Set((c.creationSelections?.["class.expertise"] ?? []).map((value) => value.replace(/^expertise\./, "")));
}

export type OfficialSheetProjection = {
  hitDie: number;
  saveProficiencies: Set<AbilityKey>;
  skillsByAbility: Record<AbilityKey, string[]>;
  skillBonus(name: string, ability: AbilityKey): number;
  skillProficient(name: string): boolean;
  skillExpertise(name: string): boolean;
  passivePerception: number;
  classFeatures: CharacterSheetTraitVm[];
  speciesTraits: CharacterSheetTraitVm[];
  feats: CharacterSheetTraitVm[];
  otherTraits: CharacterSheetTraitVm[];
  spells: CharacterSheetSpellVm[];
  spellSlots: Array<{ level: number; total?: number }>;
};

export function projectOfficialSheet(c: CharacterSheet): OfficialSheetProjection {
  const classId = classIdFromName(c.className);
  const meta = classMeta(classId);
  const expertise = expertiseSet(c);
  const classFeatures = [...classAutomatic(c), ...choiceTraits(c, "class")];
  const feats = originFeats(c);
  const speciesTraits = [...speciesAutomatic(c, classFeatures, feats), ...choiceTraits(c, "species")];
  const otherTraits = choiceTraits(c, "background");
  const skillProficient = (name: string) => c.skills.includes(name);
  const skillExpertise = (name: string) => expertise.has(name);
  const skillBonus = (name: string, ability: AbilityKey) => mod(c.abilities[ability]) + (skillProficient(name) ? c.proficiencyBonus * (skillExpertise(name) ? 2 : 1) : 0);
  const perception = skillBonus("지각", "wis");
  const semantic = classSemantics(classId);
  const levelOneSlots = semantic.spells ? (classId === "dnd.srd521.class.warlock" ? 1 : 2) : undefined;
  const spellSlots = Array.from({ length:9 }, (_, index) => ({ level:index + 1, total:c.level === 1 && index === 0 ? levelOneSlots : undefined }));
  return {
    hitDie:meta.hit,
    saveProficiencies:new Set(meta.saves),
    skillsByAbility:SKILLS_BY_ABILITY,
    skillBonus,
    skillProficient,
    skillExpertise,
    passivePerception:10 + perception,
    classFeatures,
    speciesTraits,
    feats,
    otherTraits,
    spells:spellEntries(c),
    spellSlots,
  };
}
