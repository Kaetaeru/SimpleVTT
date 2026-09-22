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

export interface CustomItemBonus { /** D352: extra damage of its own type on this weapon's hits (화염의 혀: 2d6 화염). */ extraDamage?: { dice: string; type: string }; ac?: number; attack?: number; damage?: number; damageDice?: string; saves?: number; checks?: number; speed?: number; hpMax?: number; spellDc?: number; spellAttack?: number }
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
  /** H5d (D247): what using it does — the healing it rolls, and whether it is used up. */
  use?: { healing?: string; consumes?: boolean };
  /**
   * D351: charges — how many it holds, the dice that come back at dawn (a long rest here), and what happens when the
   * last one is spent, which is the table's to roll (`note`).
   */
  charges?: { max: number; recharge?: string; note?: string };
  /** D351: spells it casts from those charges — how many each costs, and the DC or attack bonus it casts with when it has its own. */
  spells?: Array<{ spellId: string; charges: number; dc?: number; attackBonus?: number; level?: number }>;
  /** D352: ability scores it sets while it works — the score becomes this unless it is already higher (거인력 장갑: 근력 19). */
  abilities?: Partial<Record<AbilityKey, number>>;
  /** D352: damage types (English ids) and conditions it makes the bearer immune to. */
  immunities?: string[];
  conditionImmunities?: string[];
  /** D352: speeds it gives, in feet; `"walk"` means equal to the walking speed. */
  speeds?: { fly?: number | "walk"; swim?: number | "walk"; climb?: number | "walk" };
  darkvision?: number;
}

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const CONDITIONS = ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
const BONUS_KEYS: Array<keyof CustomItemBonus> = ["ac", "attack", "damage", "saves", "checks", "speed", "hpMax", "spellDc", "spellAttack"];
export const RARITY_KO: Record<string, string> = { common: "일반", uncommon: "고급", rare: "희귀", "very-rare": "매우 희귀", legendary: "전설", artifact: "아티팩트" };

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/** A base named by catalog id, English name or Korean name ("longsword", a full catalog id, "장검"). */
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
      if (key === "extraDamage") { if (isObject(value) && typeof value.dice === "string" && /^[0-9]*d[0-9]+([+-][0-9]+)?$/.test(value.dice.replace(/\s+/g, "")) && DAMAGE_TYPES.includes(String(value.type))) bonus.extraDamage = { dice: value.dice.replace(/\s+/g, ""), type: String(value.type) }; else warnings.push('bonus.extraDamage: { "dice": "2d6", "type": "fire" } 형식이어야 합니다'); continue; }
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
  if (isObject(raw.charges)) {
    const max = raw.charges.max;
    if (typeof max === "number" && Number.isInteger(max) && max > 0) {
      const recharge = text(raw.charges.recharge)?.replace(/\s+/g, "");
      if (recharge !== undefined && !/^[0-9]*d[0-9]+([+-][0-9]+)?$|^[0-9]+$/.test(recharge)) warnings.push(`charges.recharge: "${recharge}"는 "1d6+4" 형식이어야 합니다`);
      item.charges = { max, ...(recharge && /^[0-9]*d[0-9]+([+-][0-9]+)?$|^[0-9]+$/.test(recharge) ? { recharge } : {}), ...(text(raw.charges.note) ? { note: text(raw.charges.note) } : {}) };
    } else warnings.push("charges.max: 1 이상의 정수여야 합니다");
  }
  if (Array.isArray(raw.spells)) {
    const spells: NonNullable<CustomItem["spells"]> = [];
    for (const [index, value] of raw.spells.entries()) {
      if (!isObject(value) || !text(value.spellId)) { warnings.push(`spells[${index}]: spellId가 필요합니다`); continue; }
      const spellId = text(value.spellId)!;
      if (!catalog.spellById(spellId)) warnings.push(`spells[${index}]: "${spellId}"는 목록에 없는 주문입니다`);
      const charges = typeof value.charges === "number" && value.charges >= 0 ? Math.floor(value.charges) : 1;
      spells.push({ spellId, charges, ...(typeof value.dc === "number" ? { dc: value.dc } : {}), ...(typeof value.attackBonus === "number" ? { attackBonus: value.attackBonus } : {}), ...(typeof value.level === "number" ? { level: value.level } : {}) });
    }
    if (spells.length) item.spells = spells;
  }
  if (isObject(raw.abilities)) {
    const abilities: NonNullable<CustomItem["abilities"]> = {};
    for (const [key, value] of Object.entries(raw.abilities)) {
      if (!ABILITIES.includes(key as AbilityKey) || typeof value !== "number" || !Number.isInteger(value)) { warnings.push(`abilities.${key}: str/dex/con/int/wis/cha에 정수여야 합니다`); continue; }
      abilities[key as AbilityKey] = value;
    }
    if (Object.keys(abilities).length) item.abilities = abilities;
  }
  for (const [field, known] of [["immunities", DAMAGE_TYPES], ["conditionImmunities", CONDITIONS]] as const) {
    if (!Array.isArray(raw[field])) continue;
    const values = (raw[field] as unknown[]).map(String);
    for (const value of values) if (!known.includes(value)) warnings.push(`${field}: "${value}"는 ${known.join("/")} 중 하나가 아닙니다`);
    const valid = values.filter((value) => known.includes(value));
    if (valid.length) item[field] = valid;
  }
  if (isObject(raw.speeds)) {
    const speeds: NonNullable<CustomItem["speeds"]> = {};
    for (const [key, value] of Object.entries(raw.speeds)) {
      if (!["fly", "swim", "climb"].includes(key) || !(value === "walk" || (typeof value === "number" && value > 0))) { warnings.push(`speeds.${key}: fly/swim/climb에 피트 수나 "walk"여야 합니다`); continue; }
      speeds[key as "fly"] = value as number | "walk";
    }
    if (Object.keys(speeds).length) item.speeds = speeds;
  }
  if (typeof raw.darkvision === "number" && raw.darkvision > 0) item.darkvision = raw.darkvision;
  if (isObject(raw.use)) {
    const use: NonNullable<CustomItem["use"]> = {};
    const healing = text(raw.use.healing)?.replace(/\s+/g, "");
    if (healing !== undefined) { if (/^[0-9]*d[0-9]+([+-][0-9]+)?$/.test(healing)) use.healing = healing; else warnings.push(`use.healing: "${healing}"는 "2d4+2" 형식이어야 합니다`); }
    if (typeof raw.use.consumes === "boolean") use.consumes = raw.use.consumes;
    if (Object.keys(use).length) item.use = use;
  }
  const base = item.base ? catalog.itemById(item.base) : undefined;
  if ((item.bonus?.attack || item.bonus?.damage || item.bonus?.damageDice || item.bonus?.extraDamage) && !base?.weapon) warnings.push("attack/damage 보너스는 base가 무기일 때만 그 무기의 공격에 붙습니다 — 지금은 모든 공격에 붙습니다");
  return { item, warnings };
}

/**
 * D350: an official magic item's definition, read by the same parser a pasted one goes through. The content writes
 * the same fields a player would paste, so everything that already works for a pasted item works for it; what the
 * parser warns about is the content author's to fix (the module check reports it), not the player's.
 */
export function officialMagicItem(name: string, definition: Record<string, unknown>, catalog: ContentCatalog): CustomItem | undefined {
  const parsed = parseCustomItem(JSON.stringify({ ...definition, name }), catalog);
  return "error" in parsed ? undefined : parsed.item;
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
    ...(bonus.extraDamage ? { damageTyped: { dice: bonus.extraDamage.dice, type: damageTypeKo(bonus.extraDamage.type), ...(own ? { filter: own } : {}) } } : {}),
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
