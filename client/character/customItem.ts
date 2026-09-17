/**
 * R75 (ROLL20_TABLE_SPEC.md D210): a custom magic item from JSON, given to a character.
 *
 * The catalog has no magic items. A homebrew one is pasted into the sheet's "아이템 추가" window and lands in the
 * bag as a runtime extra that carries its own definition. What it does is written as the numbers the effect engine
 * already applies (AC, attack, damage, saves, checks, speed, HP, spell DC and attack, resistances), so a +1 longsword
 * gets its own attack row with the bonus in the hover, and a ring of protection adds its AC and saves — while it is
 * attuned when it asks for attunement, and while it is worn when it is armour or a shield. The guide is
 * docs/guides/CUSTOM_ITEM_JSON.md.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import type { EffectApplication } from "../rules/effects";
import { damageTypeKo } from "./origin";
import type { DerivedAttack, DerivedItem } from "./types";

export interface CustomItemBonus { ac?: number; attack?: number; damage?: number; damageDice?: string; saves?: number; checks?: number; speed?: number; hpMax?: number; spellDc?: number; spellAttack?: number }
export interface CustomItem {
  name: string;
  type: string;
  rarity?: string;
  attunement?: boolean;
  description?: string;
  /** Catalog item this one is made from (a weapon or armour), so it attacks or is worn like it. */
  base?: string;
  bonus?: CustomItemBonus;
  saveAbilities?: AbilityKey[];
  /** Korean damage type labels, as the sheet's defenses carry them. */
  resistances?: string[];
  notes?: string[];
}

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const BONUS_KEYS: Array<keyof CustomItemBonus> = ["ac", "attack", "damage", "saves", "checks", "speed", "hpMax", "spellDc", "spellAttack"];
export const RARITY_KO: Record<string, string> = { common: "일반", uncommon: "고급", rare: "희귀", "very-rare": "매우 희귀", legendary: "전설", artifact: "아티팩트" };

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/** A base named by catalog id, English name or Korean name ("longsword", "dnd.srd521.item.weapon.longsword", "장검"). */
function findBase(catalog: ContentCatalog, name: string) {
  const needle = name.trim().toLowerCase();
  return catalog.itemById(name) ?? catalog.items.find((item) => item.id.endsWith(`.${needle}`) || item.nameEn.toLowerCase() === needle || item.name === name.trim());
}

export function parseCustomItem(input: string, catalog: ContentCatalog): { item: CustomItem; warnings: string[] } | { error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch (error) { return { error: `JSON이 아닙니다: ${error instanceof Error ? error.message : String(error)}` }; }
  if (!isObject(parsed)) return { error: "맨 바깥은 { } 객체여야 합니다" };
  const raw = parsed;
  const name = text(raw.name)?.trim();
  if (!name) return { error: "name(이름)이 필요합니다" };
  const warnings: string[] = [];
  const item: CustomItem = { name, type: text(raw.type) ?? "wondrous" };
  const rarity = text(raw.rarity);
  if (rarity) { item.rarity = rarity; if (!RARITY_KO[rarity]) warnings.push(`rarity: "${rarity}"는 ${Object.keys(RARITY_KO).join("/")} 중 하나가 아닙니다`); }
  if (raw.attunement === true) item.attunement = true;
  const description = text(raw.description);
  if (description) item.description = description;
  const baseName = text(raw.base);
  if (baseName) {
    const base = findBase(catalog, baseName);
    if (base) item.base = base.id;
    else warnings.push(`base: "${baseName}"는 목록에 없는 아이템입니다 — 무기·방어구로 쓰이지 않습니다`);
  }
  if (isObject(raw.bonus)) {
    const bonus: CustomItemBonus = {};
    for (const [key, value] of Object.entries(raw.bonus)) {
      if (key === "damageDice") { if (typeof value === "string" && /^\d*d\d+$/.test(value.replace(/\s+/g, ""))) bonus.damageDice = value.replace(/\s+/g, ""); else warnings.push(`bonus.damageDice: "${String(value)}"는 "1d6" 형식이어야 합니다`); continue; }
      if (!BONUS_KEYS.includes(key as keyof CustomItemBonus)) { warnings.push(`bonus.${key}: 모르는 보너스입니다 (${[...BONUS_KEYS, "damageDice"].join("/")})`); continue; }
      if (typeof value !== "number" || !Number.isFinite(value)) { warnings.push(`bonus.${key}: 숫자여야 합니다`); continue; }
      (bonus as Record<string, number>)[key] = value;
    }
    if (Object.keys(bonus).length) item.bonus = bonus;
  }
  if (Array.isArray(raw.saveAbilities)) {
    const keys = raw.saveAbilities.map(String);
    for (const key of keys) if (!ABILITIES.includes(key as AbilityKey)) warnings.push(`saveAbilities: "${key}"는 str/dex/con/int/wis/cha 중 하나가 아닙니다`);
    const valid = keys.filter((key): key is AbilityKey => ABILITIES.includes(key as AbilityKey));
    if (valid.length) item.saveAbilities = valid;
  }
  if (Array.isArray(raw.resistances)) {
    const types = raw.resistances.map(String);
    for (const type of types) if (!DAMAGE_TYPES.includes(type)) warnings.push(`resistances: "${type}"는 ${DAMAGE_TYPES.join("/")} 중 하나가 아닙니다`);
    const valid = types.filter((type) => DAMAGE_TYPES.includes(type)).map(damageTypeKo);
    if (valid.length) item.resistances = valid;
  }
  if (Array.isArray(raw.notes)) item.notes = raw.notes.map(String);
  const base = item.base ? catalog.itemById(item.base) : undefined;
  if ((item.bonus?.attack || item.bonus?.damage || item.bonus?.damageDice) && !base?.weapon) warnings.push("attack/damage 보너스는 base가 무기일 때만 그 무기의 공격에 붙습니다 — 지금은 모든 공격에 붙습니다");
  return { item, warnings };
}

export const customAttackId = (item: Pick<DerivedItem, "itemId" | "instanceId">) => `attack.${item.itemId}@${item.instanceId}`;

/** Whether the item's numbers are on the sheet right now. */
export function customItemActive(item: DerivedItem): boolean {
  if (!item.magic) return false;
  if (item.magic.attunement && !item.attuned) return false;
  if ((item.kind === "armor" || item.kind === "shield") && !item.equipped) return false;
  return true;
}

/** The item's numbers as an effect application. Attack and damage go to its own attack row when it is a weapon. */
export function customItemApplication(item: DerivedItem): EffectApplication {
  const magic = item.magic!;
  const bonus = magic.bonus ?? {};
  const own = item.kind === "weapon" ? (attack: DerivedAttack) => attack.id === customAttackId(item) : undefined;
  return {
    ...(bonus.ac ? { ac: { add: bonus.ac } } : {}),
    ...(bonus.attack ? { attack: { value: bonus.attack, ...(own ? { filter: own } : {}) } } : {}),
    ...(bonus.damage || bonus.damageDice ? { damage: { ...(bonus.damageDice ? { dice: bonus.damageDice } : {}), ...(bonus.damage ? { value: bonus.damage } : {}), ...(own ? { filter: own } : {}) } } : {}),
    ...(bonus.saves ? { saves: { value: bonus.saves, ...(magic.saveAbilities ? { keys: magic.saveAbilities } : {}) } } : {}),
    ...(bonus.checks ? { checks: { value: bonus.checks } } : {}),
    ...(bonus.speed ? { speed: { add: bonus.speed } } : {}),
    ...(bonus.hpMax ? { hpMax: bonus.hpMax } : {}),
    ...(bonus.spellDc ? { spellDc: bonus.spellDc } : {}),
    ...(bonus.spellAttack ? { spellAttack: bonus.spellAttack } : {}),
    ...(magic.resistances?.length ? { resistances: magic.resistances } : {}),
  };
}

/** The example the paste window offers and the guide shows. */
export const CUSTOM_ITEM_EXAMPLE = {
  name: "서리송곳 장검 +1",
  type: "weapon",
  rarity: "rare",
  attunement: true,
  base: "longsword",
  description: "칼날에 서리가 맺힌 장검. 조율하면 명중과 피해에 +1, 냉기 피해에 저항한다.",
  bonus: { attack: 1, damage: 1 },
  resistances: ["cold"],
};
