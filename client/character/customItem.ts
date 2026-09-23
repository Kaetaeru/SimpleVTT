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
import { parseContract } from "../rules/contract";
import { damageTypeKo } from "./origin";
import type { DerivedAttack, DerivedItem } from "./types";

/** D352/D359: damage of another type on the weapon's hits — only against some creature types, or only while an effect runs. */
export interface ExtraDamage { dice: string; type: string; when?: { targetTypes?: string[]; effect?: string } }
export interface CustomItemBonus { /** D352: extra damage of its own type on this weapon's hits (화염의 혀: 2d6 화염). */ extraDamage?: ExtraDamage[]; ac?: number; attack?: number; damage?: number; damageDice?: string; saves?: number; checks?: number; speed?: number; hpMax?: number; spellDc?: number; spellAttack?: number }
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
  use?: {
    healing?: string; consumes?: boolean;
    /** D353: temporary hit points it gives the drinker ("10", "2d4"). */
    tempHp?: string;
    /** D353: an effect on the drinker for a while — the same fields an item carries, under `grants`. */
    effect?: { name?: string; duration: string; rounds?: number; grants: CustomItem; /** D356: it never ends (교본: 능력치가 영구히 오른다). */ permanent?: boolean };
    /** D353: the drinker is under this spell for a while, without concentration (속도의 물약: 가속). */
    spell?: { spellId: string; duration?: string; rounds?: number };
  };
  /**
   * D351: charges — how many it holds, the dice that come back at dawn (a long rest here), and what happens when the
   * last one is spent, which is the table's to roll (`note`).
   */
  charges?: { max: number; recharge?: string; note?: string };
  /** D351: spells it casts from those charges — how many each costs, and the DC or attack bonus it casts with when it has its own. */
  spells?: Array<{ spellId: string; charges: number; /** D358: the `uses` pool it spends (default: `charges`). */ pool?: string; dc?: number; attackBonus?: number; level?: number; /** D356: each extra charge spent raises the spell's level by one, up to `maxLevel`. */ perLevel?: number; maxLevel?: number }>;
  /** D352: ability scores it sets while it works — the score becomes this unless it is already higher (거인력 장갑: 근력 19). */
  abilities?: Partial<Record<AbilityKey, number>>;
  /** D356: ability scores it raises while it works, each up to a maximum (건강의 아이운 스톤: 건강 +2, 최대 20). */
  abilityBonuses?: Partial<Record<AbilityKey, { amount: number; max: number }>>;
  /** D356: the damage type its weapon deals instead of the base weapon's (태양검: 광휘). */
  damageType?: string;
  /** D352: damage types (English ids) and conditions it makes the bearer immune to. */
  immunities?: string[];
  conditionImmunities?: string[];
  /** D352: speeds it gives, in feet; `"walk"` means equal to the walking speed. */
  speeds?: { fly?: number | "walk"; swim?: number | "walk"; climb?: number | "walk" };
  darkvision?: number;
  /** D359: it works only while held (in a hand slot), not merely carried. */
  worksWhen?: "held";
  /** D360: who may attune to it — a spellcaster, a class (id or its last segment); `note` for what the app cannot check. */
  attunementRequires?: { spellcaster?: boolean; classes?: string[]; note?: string };
  /**
   * D360: a curse. While the item works its `grants` (the same fields an item carries — a penalty, a vulnerability)
   * are the bearer's; `cannotUnattune` keeps the bearer attuned. Lifting it (remove curse, the DM's call) ends both.
   */
  curse?: { cannotUnattune?: boolean; grants?: CustomItem; note?: string };
  /** D360: damage types (English ids) it makes the bearer vulnerable to. */
  vulnerabilities?: string[];
  /**
   * D358: pools of its own besides `charges` — a use a dawn, a use a short rest, dice back at dawn, or none back.
   * Its spells (`pool`) and its contract (`resource:self.<id>`) spend them.
   */
  uses?: ItemPool[];
  /** D358: a `common-play` contract, as a module entry carries — standing properties, buttons, reactions. */
  contract?: Record<string, unknown>;
  /**
   * D354: the item is made from a weapon or armour the giver picks (불꽃 혀: any melee weapon) — the kinds of base it
   * may be. Given with a base, it is carried as that base (`base`), named "<item> (<base>)".
   */
  baseOptions?: BaseOptions;
}
export interface ItemPool { id: string; label: string; max: number; /** `dawn`, `long-rest`, `short-rest`, `never`, or dice back at dawn ("1d6+1"). */ recharge?: string; note?: string }
export const ITEM_RECHARGES = ["dawn", "long-rest", "short-rest", "never"];
const RECHARGE_DICE = /^[0-9]*d[0-9]+([+-][0-9]+)?$|^[0-9]+$/;
export interface BaseOptions { kind: "weapon" | "armor" | "shield" | "ammunition"; training?: string[]; mode?: "melee" | "ranged"; ids?: string[]; exclude?: string[] }

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
      if (key === "extraDamage") {
        const parts: ExtraDamage[] = [];
        for (const part of Array.isArray(value) ? value : [value]) {
          const dice = isObject(part) && typeof part.dice === "string" ? part.dice.replace(/\s+/g, "") : "";
          if (!isObject(part) || !/^[0-9]*d[0-9]+([+-][0-9]+)?$/.test(dice) || !DAMAGE_TYPES.includes(String(part.type))) { warnings.push('bonus.extraDamage: { "dice": "2d6", "type": "fire" } 형식이어야 합니다 (배열도 된다)'); continue; }
          const when = isObject(part.when) ? part.when : undefined;
          const targetTypes = Array.isArray(when?.targetTypes) ? (when!.targetTypes as unknown[]).map((type) => String(type).toLowerCase()) : undefined;
          const effect = when ? text(when.effect) : undefined;
          parts.push({ dice, type: String(part.type), ...(targetTypes?.length || effect ? { when: { ...(targetTypes?.length ? { targetTypes } : {}), ...(effect ? { effect } : {}) } } : {}) });
        }
        if (parts.length) bonus.extraDamage = parts;
        continue;
      }
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
      spells.push({ spellId, charges, ...(text(value.pool) ? { pool: text(value.pool) } : {}), ...(typeof value.dc === "number" ? { dc: value.dc } : {}), ...(typeof value.attackBonus === "number" ? { attackBonus: value.attackBonus } : {}), ...(typeof value.level === "number" ? { level: value.level } : {}), ...(typeof value.perLevel === "number" && value.perLevel > 0 ? { perLevel: Math.floor(value.perLevel) } : {}), ...(typeof value.maxLevel === "number" && value.maxLevel <= 9 ? { maxLevel: Math.floor(value.maxLevel) } : {}) });
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
  if (isObject(raw.abilityBonuses)) {
    const bonuses: NonNullable<CustomItem["abilityBonuses"]> = {};
    for (const [key, value] of Object.entries(raw.abilityBonuses)) {
      if (!ABILITIES.includes(key as AbilityKey) || !isObject(value) || typeof value.amount !== "number" || typeof value.max !== "number") { warnings.push(`abilityBonuses.${key}: str/dex/con/int/wis/cha에 { "amount": 2, "max": 20 } 형식이어야 합니다`); continue; }
      bonuses[key as AbilityKey] = { amount: Math.floor(value.amount), max: Math.floor(value.max) };
    }
    if (Object.keys(bonuses).length) item.abilityBonuses = bonuses;
  }
  const damageType = text(raw.damageType);
  if (damageType !== undefined) { if (DAMAGE_TYPES.includes(damageType)) item.damageType = damageType; else warnings.push(`damageType: "${damageType}"는 ${DAMAGE_TYPES.join("/")} 중 하나가 아닙니다`); }
  for (const [field, known] of [["immunities", DAMAGE_TYPES], ["vulnerabilities", DAMAGE_TYPES], ["conditionImmunities", CONDITIONS]] as const) {
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
  if (isObject(raw.attunementRequires)) {
    const req = raw.attunementRequires;
    const classes = Array.isArray(req.classes) ? req.classes.map(String) : undefined;
    for (const cls of classes ?? []) if (!catalog.classById(cls) && !catalog.classBySlug(cls)) warnings.push(`attunementRequires.classes: "${cls}"는 목록에 없는 직업입니다`);
    item.attunementRequires = { ...(req.spellcaster === true ? { spellcaster: true } : {}), ...(classes?.length ? { classes } : {}), ...(text(req.note) ? { note: text(req.note) } : {}) };
    if (!item.attunement) warnings.push("attunementRequires: attunement가 true가 아니면 쓰이지 않습니다");
  }
  if (isObject(raw.curse)) {
    const curse = raw.curse;
    const grants = isObject(curse.grants) ? parseCustomItem(JSON.stringify({ ...curse.grants, name: `${name} (저주)` }), catalog) : undefined;
    if (grants && "error" in grants) warnings.push(`curse.grants: ${grants.error}`);
    else if (grants) warnings.push(...grants.warnings.map((line) => `curse.grants: ${line}`));
    item.curse = { ...(curse.cannotUnattune === true ? { cannotUnattune: true } : {}), ...(grants && !("error" in grants) ? { grants: grants.item } : {}), ...(text(curse.note) ? { note: text(curse.note) } : {}) };
  }
  if (raw.worksWhen !== undefined) { if (raw.worksWhen === "held") item.worksWhen = "held"; else warnings.push('worksWhen: "held"만 있습니다'); }
  if (isObject(raw.baseOptions)) {
    const options = raw.baseOptions;
    if (!["weapon", "armor", "shield", "ammunition"].includes(String(options.kind))) warnings.push("baseOptions.kind: weapon/armor/shield/ammunition 중 하나여야 합니다");
    else {
      const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : undefined);
      item.baseOptions = { kind: options.kind as BaseOptions["kind"], ...(list(options.training) ? { training: list(options.training) } : {}), ...(options.mode === "melee" || options.mode === "ranged" ? { mode: options.mode } : {}), ...(list(options.ids) ? { ids: list(options.ids) } : {}), ...(list(options.exclude) ? { exclude: list(options.exclude) } : {}) };
      if (!baseChoices(catalog, item.baseOptions).length) warnings.push("baseOptions: 고를 수 있는 기반 아이템이 없습니다");
    }
  }
  if (Array.isArray(raw.uses)) {
    const pools: ItemPool[] = [];
    for (const [index, value] of raw.uses.entries()) {
      const id = isObject(value) ? text(value.id) : undefined;
      if (!isObject(value) || !id || !/^[a-z0-9-]+$/.test(id) || id === "charges") { warnings.push(`uses[${index}].id: 소문자·숫자·- 로 된 id가 필요합니다 ("charges"는 charges 필드의 이름)`); continue; }
      if (typeof value.max !== "number" || !Number.isInteger(value.max) || value.max < 1) { warnings.push(`uses[${index}].max: 1 이상의 정수여야 합니다`); continue; }
      const recharge = text(value.recharge)?.replace(/\s+/g, "");
      if (recharge !== undefined && !ITEM_RECHARGES.includes(recharge) && !RECHARGE_DICE.test(recharge)) warnings.push(`uses[${index}].recharge: ${ITEM_RECHARGES.join("/")} 또는 "1d6+1" 형식이어야 합니다`);
      pools.push({ id, label: text(value.label) ?? id, max: value.max, ...(recharge && (ITEM_RECHARGES.includes(recharge) || RECHARGE_DICE.test(recharge)) ? { recharge } : {}), ...(text(value.note) ? { note: text(value.note) } : {}) });
    }
    if (pools.length) item.uses = pools;
  }
  for (const spell of item.spells ?? []) if (spell.pool && spell.pool !== "charges" && !item.uses?.some((pool) => pool.id === spell.pool)) warnings.push(`spells: "${spell.spellId}"의 pool "${spell.pool}"이 uses에 없습니다`);
  if (isObject(raw.contract)) {
    const contract = parseContract(raw.contract, "item");
    for (const gap of contract.unsupported) warnings.push(`contract: 실행할 수 없는 부분 — ${gap}`);
    item.contract = raw.contract;
  }
  if (raw.format !== undefined && raw.format !== "simplevtt.magic-item/2") warnings.push(`format: "${String(raw.format)}"는 모르는 형식입니다 (simplevtt.magic-item/2)`);
  if (isObject(raw.use)) {
    const use: NonNullable<CustomItem["use"]> = {};
    const healing = text(raw.use.healing)?.replace(/\s+/g, "");
    if (healing !== undefined) { if (/^[0-9]*d[0-9]+([+-][0-9]+)?$/.test(healing)) use.healing = healing; else warnings.push(`use.healing: "${healing}"는 "2d4+2" 형식이어야 합니다`); }
    if (typeof raw.use.consumes === "boolean") use.consumes = raw.use.consumes;
    const tempHp = text(raw.use.tempHp)?.replace(/\s+/g, "");
    if (tempHp !== undefined) { if (/^[0-9]*d[0-9]+([+-][0-9]+)?$|^[0-9]+$/.test(tempHp)) use.tempHp = tempHp; else warnings.push(`use.tempHp: "${tempHp}"는 "10"이나 "2d4" 형식이어야 합니다`); }
    if (isObject(raw.use.effect)) {
      const effect = raw.use.effect;
      const grants = parseCustomItem(JSON.stringify({ ...(isObject(effect.grants) ? effect.grants : {}), name: text(effect.name) ?? name }), catalog);
      if ("error" in grants) warnings.push(`use.effect.grants: ${grants.error}`);
      else if (!text(effect.duration)) warnings.push("use.effect.duration: 지속시간 글이 필요합니다 (\"1시간\")");
      else { warnings.push(...grants.warnings.map((line) => `use.effect.grants: ${line}`)); use.effect = { ...(text(effect.name) ? { name: text(effect.name) } : {}), duration: text(effect.duration)!, ...(typeof effect.rounds === "number" ? { rounds: effect.rounds } : {}), grants: grants.item, ...(effect.permanent === true ? { permanent: true } : {}) }; }
    }
    if (isObject(raw.use.spell)) {
      const spell = raw.use.spell;
      const spellId = text(spell.spellId);
      if (!spellId || !catalog.spellById(spellId)) warnings.push(`use.spell.spellId: "${String(spell.spellId)}"는 목록에 없는 주문입니다`);
      else use.spell = { spellId, ...(text(spell.duration) ? { duration: text(spell.duration) } : {}), ...(typeof spell.rounds === "number" ? { rounds: spell.rounds } : {}) };
    }
    if (Object.keys(use).length) item.use = use;
  }
  const base = item.base ? catalog.itemById(item.base) : undefined;
  if ((item.bonus?.attack || item.bonus?.damage || item.bonus?.damageDice || item.bonus?.extraDamage) && !base?.weapon && base?.kind !== "ammunition" && item.baseOptions?.kind !== "weapon" && item.baseOptions?.kind !== "ammunition") warnings.push("attack/damage 보너스는 base가 무기일 때만 그 무기의 공격에 붙습니다 — 지금은 모든 공격에 붙습니다");
  return { item, warnings };
}

/**
 * D360: why this character may not attune to the item, or nothing. A class is named by its catalog id or the last
 * segment of it, as the content writes it.
 */
export function attunementProblem(magic: Pick<CustomItem, "attunementRequires"> | undefined, derived: { spellSlots: Record<number, number>; pactMagic?: unknown; classes: Array<{ classId: string; name?: string }> }): string | undefined {
  const req = magic?.attunementRequires;
  if (!req) return undefined;
  // A spellcaster has the Spellcasting or Pact Magic of a class — slots of their own, not a feat's single spell.
  if (req.spellcaster && !Object.values(derived.spellSlots).some((count) => count > 0) && !derived.pactMagic) return "주문 시전자만 조율할 수 있습니다";
  if (req.classes?.length && !derived.classes.some((state) => req.classes!.some((cls) => state.classId === cls || state.classId.endsWith(`.${cls}`)))) return `이 직업만 조율할 수 있습니다: ${req.classes.join(", ")}`;
  return undefined;
}

/** D354: the catalog items a `baseOptions` allows, in catalog order. */
export function baseChoices(catalog: Pick<ContentCatalog, "items">, options: BaseOptions) {
  return catalog.items.filter((item) => {
    if (item.kind !== options.kind) return false;
    if (options.ids && !options.ids.includes(item.id)) return false;
    if (options.exclude?.includes(item.id)) return false;
    const training = item.weapon?.training ?? item.armor?.training;
    if (options.training && (!training || !options.training.includes(training))) return false;
    if (options.mode && item.weapon?.mode !== options.mode) return false;
    return true;
  });
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
  // D359: an item that works only in hand (지팡이, 막대) — held is equipped in a hand slot.
  if (item.magic.worksWhen === "held" && !item.equipped) return false;
  return true;
}

/** The item's numbers as an effect application. Attack and damage go to its own attack row when it is a weapon. */
export function customItemApplication(item: DerivedItem, /** D359: the effects running on the bearer, by name. */ running: string[] = []): EffectApplication {
  const magic = item.magic!;
  const bonus = magic.bonus ?? {};
  // D353: magic ammunition has a row per weapon that shoots it (`<id>:<weapon>`), and its bonus is on those rows.
  const own = item.kind === "weapon" || item.kind === "ammunition" ? (attack: DerivedAttack) => attack.id === customAttackId(item) || attack.id.startsWith(`${customAttackId(item)}:`) : undefined;
  return {
    ...(bonus.ac ? { ac: { add: bonus.ac } } : {}),
    ...(bonus.attack ? { attack: { value: bonus.attack, ...(own ? { filter: own } : {}) } } : {}),
    ...(bonus.damage || bonus.damageDice ? { damage: { ...(bonus.damageDice ? { dice: bonus.damageDice } : {}), ...(bonus.damage ? { value: bonus.damage } : {}), ...(own ? { filter: own } : {}) } } : {}),
    // D359: a part that waits for an effect (불꽃 혀를 켰을 때) is on the row only while it runs.
    ...(bonus.extraDamage?.length ? { damageTyped: bonus.extraDamage.filter((part) => !part.when?.effect || running.includes(part.when.effect)).map((part) => ({ dice: part.dice, type: damageTypeKo(part.type), ...(own ? { filter: own } : {}), ...(part.when?.targetTypes ? { versus: part.when.targetTypes } : {}) })) } : {}),
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
