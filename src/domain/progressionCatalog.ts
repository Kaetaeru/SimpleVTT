import rawCatalog from "../generated/progressionCatalog.generated.json";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type SpellcastingMode = "none" | "full" | "half" | "pact";

export interface ProgressionRow {
  level: number;
  proficiencyBonus: number;
  features: string[];
  columns: Record<string, string | null>;
}

export interface ProgressionClassDefinition {
  id: string;
  slug: string;
  nameKo: string;
  nameEn: string;
  srdSubclassName: string;
  sourcePath: string;
  hitDie: number;
  primaryAbilitiesText: string;
  savingThrowsText: string;
  spellcastingMode: SpellcastingMode;
  multiclassGrants: string[];
  progression: ProgressionRow[];
  spellSlots: { headers: Array<string | null>; rows: Array<Record<string, string | null>> } | null;
}

interface RawProgressionCatalog {
  schemaVersion: string;
  source: { repository: string; revision: string; root: string; documents: string[] };
  classes: ProgressionClassDefinition[];
  levelAdvancement: { growth: Array<Record<string, string | null>>; fixedHp: Array<Record<string, string | null>> };
  multiclass: {
    prerequisites: Array<Record<string, string | null>>;
    fullCasterClasses: string[];
    halfCasterClasses: string[];
    pactCasterClasses: string[];
    halfCasterRounding: string;
    spellSlots: { headers: Array<string | null>; rows: Array<Record<string, string | null>> };
  };
}

export const PROGRESSION_CATALOG = rawCatalog as unknown as RawProgressionCatalog;

const LEGACY_CLASS_NAMES: Record<string, string> = {
  "전사": "fighter",
  "음유시인": "bard",
  "성직자": "cleric",
  "마법사": "wizard",
};
const ABILITY_KO: Record<string, AbilityKey> = { "근력":"str", "민첩":"dex", "건강":"con", "지능":"int", "지혜":"wis", "매력":"cha" };

export function classById(id: string) {
  return PROGRESSION_CATALOG.classes.find((entry) => entry.id === id);
}

export function classBySlug(slug: string) {
  return PROGRESSION_CATALOG.classes.find((entry) => entry.slug === slug);
}

export function classByName(name: string) {
  const alias = LEGACY_CLASS_NAMES[name];
  return PROGRESSION_CATALOG.classes.find((entry) => entry.slug === alias || entry.nameKo === name || entry.nameEn === name || entry.id === name);
}

export function progressionRow(classId: string, level: number) {
  return classById(classId)?.progression.find((row) => row.level === level);
}

export function proficiencyBonusForTotalLevel(level: number) {
  if (level < 1) return 0;
  return Math.min(6, 2 + Math.floor((Math.min(level, 20) - 1) / 4));
}

export function fixedHpGain(classId: string) {
  const definition = classById(classId);
  if (!definition) throw new Error(`unknown class ${classId}`);
  return Math.floor(definition.hitDie / 2) + 1;
}

export type PrerequisiteGroup = AbilityKey[];
export interface MulticlassPrerequisite {
  classId: string;
  className: string;
  groups: PrerequisiteGroup[];
  raw: string;
}

function parseRequirement(raw: string): PrerequisiteGroup[] {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const andParts = normalized.split(/\s*과\s*/);
  const groups: PrerequisiteGroup[] = [];
  for (const part of andParts) {
    const alternatives = part.split(/\s*또는\s*/).map((item) => item.trim());
    const keys = alternatives.flatMap((item) => {
      const match = item.match(/(근력|민첩|건강|지능|지혜|매력)\s*13/);
      return match ? [ABILITY_KO[match[1]]] : [];
    });
    if (keys.length) groups.push(keys);
  }
  return groups;
}

const prerequisiteByName = new Map(
  PROGRESSION_CATALOG.multiclass.prerequisites.map((row) => [String(row["클래스"] ?? ""), String(row["필요한 능력치"] ?? "")]),
);

export function multiclassPrerequisite(classId: string): MulticlassPrerequisite {
  const definition = classById(classId);
  if (!definition) throw new Error(`unknown class ${classId}`);
  const raw = prerequisiteByName.get(definition.nameKo) ?? "";
  return { classId, className: definition.nameKo, groups: parseRequirement(raw), raw };
}

export function meetsPrerequisite(abilities: Record<AbilityKey, number>, prerequisite: MulticlassPrerequisite) {
  return prerequisite.groups.every((group) => group.some((ability) => abilities[ability] >= 13));
}

export interface ClassTrackLike { classId: string; level: number }

export function multiclassEligibility(abilities: Record<AbilityKey, number>, currentTracks: ClassTrackLike[], targetClassId: string) {
  const requiredClassIds = [...new Set([...currentTracks.map((track) => track.classId), targetClassId])];
  const checks = requiredClassIds.map((classId) => {
    const prerequisite = multiclassPrerequisite(classId);
    return { prerequisite, met: meetsPrerequisite(abilities, prerequisite) };
  });
  return {
    eligible: checks.every((check) => check.met),
    checks,
    reason: checks.filter((check) => !check.met).map((check) => `${check.prerequisite.className}: ${check.prerequisite.raw}`).join(" · "),
  };
}

function numericCell(value: string | null | undefined) {
  if (!value || value === "—") return 0;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function multiclassSpellcasterLevel(tracks: ClassTrackLike[]) {
  let total = 0;
  for (const track of tracks) {
    const definition = classById(track.classId);
    if (!definition) continue;
    if (definition.spellcastingMode === "full") total += track.level;
    if (definition.spellcastingMode === "half") total += Math.ceil(track.level / 2);
  }
  return total;
}

export function multiclassSpellSlots(tracks: ClassTrackLike[]) {
  const casterLevel = multiclassSpellcasterLevel(tracks);
  if (casterLevel <= 0) return { casterLevel: 0, slots: {} as Record<number, number> };
  const row = PROGRESSION_CATALOG.multiclass.spellSlots.rows.find((entry) => numericCell(entry["주문 시전자 레벨"]) === casterLevel);
  const slots: Record<number, number> = {};
  for (let level = 1; level <= 9; level += 1) slots[level] = numericCell(row?.[`${level}레벨`]);
  return { casterLevel, slots };
}

export function classProgressionColumns(classId: string, level: number) {
  return progressionRow(classId, level)?.columns ?? {};
}

export function numericProgressionColumn(classId: string, level: number, key: string) {
  return numericCell(classProgressionColumns(classId, level)[key]);
}
