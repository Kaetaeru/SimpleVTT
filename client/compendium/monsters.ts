/**
 * The compendium's monsters: the generated SRD stat blocks (src/generated/monsterCatalog.generated.json) with the
 * fields the table uses — AC, HP, initiative, abilities, saves, skills, defenses, attacks with bonus and damage
 * dice, save actions with DC and area, recharge timings, legendary actions and spellcasting. A monster dragged to
 * the canvas becomes an NPC journal entry that carries a copy of this block (ROLL20_TABLE_SPEC.md §4.3, §9).
 */
import monsterJson from "../../src/generated/monsterCatalog.generated.json";
import type { AbilityKey } from "../catalog/types";
import type { TraitRule } from "./monsterTraits";

export interface MonsterDamage { average: number; dice: string; count: number; sides: number; flat: number; type: string }
export interface MonsterAttack { mode: "melee" | "ranged" | string; bonus: number; rangeFeet?: number; longRangeFeet?: number; damage: MonsterDamage[]; hitText?: string; riderConditions?: string[] }
export interface MonsterSave { ability: AbilityKey; dc: number; areaText?: string; areaKind?: string; areaFeet?: number; failDamage?: MonsterDamage[]; failText?: string; successDamage?: "half" | "none" | string; successText?: string; failConditions?: string[]; /** H6c (D250): the target repeats this save at the end of each of its turns. */ repeatSave?: "turn-end" }
export interface MonsterSpellcasting { ability: AbilityKey; dc: number; lists: Array<{ frequency: string; uses?: number; spells: string[]; entries: Array<{ name: string; spellId?: string; note?: string; slotLevel?: number }> }> }
export interface MonsterAction {
  name: string;
  nameEn?: string;
  text: string;
  kind: "attack" | "save" | "multiattack" | "text" | "spellcasting" | string;
  attack?: MonsterAttack;
  save?: MonsterSave;
  multiattack?: { count: number; text: string; parsed: boolean; routine?: Array<{ name: string; count: number; alternatives?: string[] }> };
  spellcasting?: MonsterSpellcasting;
  timing?: { recharge?: { min: number; sides: number }; usesPerRound?: number };
  legendaryCost?: number;
  costText?: string;
  /** H1 (D238): what this trait does, as generic patterns (compendium/monsterTraits.ts). */
  rules?: TraitRule[];
}

export interface MonsterView {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  size: string;
  creatureType: string;
  typeText: string;
  alignment: string;
  ac: number;
  acText: string;
  initiativeBonus: number;
  hp: number;
  hitDice: string;
  speedText: string;
  speed: number;
  speeds: Record<string, number>;
  abilities: Record<AbilityKey, number>;
  saves: Record<AbilityKey, number>;
  skills: Record<string, number>;
  damageImmunities: string[];
  damageResistances: string[];
  damageVulnerabilities: string[];
  conditionImmunities: string[];
  sensesText: string;
  senses: Record<string, number>;
  passivePerception: number;
  languagesText: string;
  cr: number;
  crText: string;
  xp: number;
  proficiencyBonus: number;
  traits: MonsterAction[];
  actions: MonsterAction[];
  bonusActions: MonsterAction[];
  reactions: MonsterAction[];
  legendaryActions: MonsterAction[];
  legendaryActionsPerRound: number;
  legendaryResistance: number;
}

const source = monsterJson as unknown as { monsters: Array<MonsterView & { presentation?: unknown }> };
/** Every SRD monster, without the presentation markdown (the sheet renders the structure). */
export const MONSTERS: MonsterView[] = source.monsters.map(({ presentation: _markdown, ...monster }) => monster as MonsterView);
const byId = new Map(MONSTERS.map((monster) => [monster.id, monster]));

export const monsterById = (id: string) => byId.get(id);

export const SIZE_KO: Record<string, string> = { tiny: "초소형", small: "소형", medium: "중형", large: "대형", huge: "거대형", gargantuan: "초대형" };
/** Token footprint in cells by size (5e: large 2×2, huge 3×3, gargantuan 4×4). */
export const sizeCells = (size: string) => (size === "large" ? 2 : size === "huge" ? 3 : size === "gargantuan" ? 4 : 1);

export function searchMonsters(query: string, options: { cr?: string; type?: string; limit?: number } = {}): MonsterView[] {
  const needle = query.trim().toLowerCase();
  const out = MONSTERS.filter((monster) => (!needle || monster.name.toLowerCase().includes(needle) || monster.nameEn.toLowerCase().includes(needle) || monster.slug.includes(needle)) && (!options.cr || monster.crText === options.cr) && (!options.type || monster.creatureType === options.type));
  return out.slice(0, options.limit ?? 60);
}

export const CR_VALUES = [...new Set(MONSTERS.map((monster) => monster.crText))].sort((a, b) => crNumber(a) - crNumber(b));
export const CREATURE_TYPES = [...new Set(MONSTERS.map((monster) => monster.creatureType))].sort();
export function crNumber(text: string) { const [n, d] = text.split("/"); return d ? Number(n) / Number(d) : Number(n); }

/** Dice formula for a damage list ("2d6+3 slashing" → parts). */
export const damageFormula = (damage: MonsterDamage) => `${damage.dice}${damage.flat ? `${damage.flat > 0 ? "+" : "-"}${Math.abs(damage.flat)}` : ""}`;
