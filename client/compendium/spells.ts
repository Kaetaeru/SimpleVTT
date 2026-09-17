/**
 * The generated spell execution catalog (SRD 5.2, `spellExecutionCatalog.generated.json`): what each spell does when
 * cast at the table — targeting, the primary effect (attack, save, healing, projectiles, tracked effect …),
 * concentration and conditions. Read-only views for the resolver and the command bar.
 */
import catalogJson from "../../src/generated/spellExecutionCatalog.generated.json";
import sustainJson from "../../content/indexes/dnd-srd-5.2.1.spell-sustain.json";
import onHitJson from "../../content/indexes/dnd-srd-5.2.1.spell-on-hit.json";
import bearerJson from "../../content/indexes/dnd-srd-5.2.1.spell-bearer.json";
import weaponSpellJson from "../../content/indexes/dnd-srd-5.2.1.spell-weapon.json";
import type { SpellSummon } from "./summonTemplate";

export interface SpellDice { count: number; sides: number; flat?: number; dicePerSlotAboveBase?: number; flatPerSlotAboveBase?: number; cantripScaling?: boolean; addSpellcastingModifier?: boolean }
export interface SpellDuration { kind: "concentration" | "rounds" | "minutes" | "hours" | "instant" | "special" | "permanent"; amount?: number; anchorActorId?: string; boundary?: "start" | "end" }
export type SpellPrimary =
  | { kind: "attack-damage"; damageType: string; dice: SpellDice }
  | { kind: "save-damage"; saveAbility: string; damageType: string; dice: SpellDice; successDamage: "none" | "half"; ignoresCoverForSave?: boolean }
  | { kind: "save-compound-damage"; saveAbility: string; components: Array<{ damageType: string; dice: SpellDice }>; successDamage: "none" | "half" }
  | { kind: "save-effect"; saveAbility: string; summary?: string; duration?: SpellDuration }
  | { kind: "healing"; dice: SpellDice }
  | { kind: "temporary-hp"; dice: SpellDice }
  | { kind: "automatic-projectiles"; damageType: string; projectileDice: { sides: number; flat?: number }; baseProjectiles: number; projectilesPerSlotAboveBase?: number }
  | { kind: "multi-attack-damage"; damageType: string; dicePerAttack: { count: number; sides: number }; baseAttacks: number; attacksPerSlotAboveBase?: number; cantripAttackScaling?: boolean }
  | { kind: "tracked-effect"; summary?: string; duration?: SpellDuration }
  /** R103 (D238): damage every target takes, one roll for all, no save (a monster aura at the end of its turn). */
  | { kind: "area-damage"; damageType: string; dice: SpellDice }
  | { kind: "maximum-hp" | "dispel" | "full-healing" | "power-word-kill" | "revive"; summary?: string; [key: string]: unknown };

export interface SpellExec {
  spellId: string;
  baseLevel: number;
  castingEconomy: "action" | "bonus-action" | "reaction";
  targeting: { kind: string; rangeFeet?: number; minTargets: number; maxTargets: number; allowedRelations?: string[]; directTarget?: boolean; requiresSight?: boolean };
  primary: SpellPrimary;
  concentration?: boolean;
  effects?: Array<{ conditionId: string; trigger: "failed-save" | "hit" | "always"; duration?: SpellDuration }>;
  trackedEffects?: Array<{ summary: string; trigger: "failed-save" | "hit" | "always"; duration?: SpellDuration } & SpellBearerPart>;
  ritual?: boolean;
  /** R77 (D212): how the spell is used again while it lasts, when that differs from the default (see `sustainOf`). */
  sustain?: Partial<SpellSustain> | false;
  /** R82 (D218): cast right after a weapon hit (the smites) — offered in the on-hit window. */
  onHit?: SpellOnHit;
  /** H2 (D239): cast through a weapon attack (진실의 일격). */
  weaponSpell?: WeaponSpell;
  /** R84 (D219): the creature a summon spell brings, as a template filled in at the cast (compendium/summonTemplate.ts). */
  summon?: SpellSummon;
  /** R77 (D212): set on the execution of a repeat — what it costs, and that it is not a new casting. */
  repeat?: { economy: SpellSustain["economy"] };
}

/**
 * R82 (D218): what a spell cast right after a weapon hit does. `damage` joins the swing (doubled on a critical),
 * `inflicts` lands with the hit, `save` is the target's roll against the caster's DC, posted as its own card.
 */
export interface SpellOnHit {
  weapon?: "melee" | "ranged" | "any";
  damage?: { count: number; sides: number; perSlot?: number; type: string };
  inflicts?: string[];
  /** H5b (D245): more damage only against these creature types (신성한 강타: 악마·언데드 +1d8), added per target. */
  versus?: { creatureTypes: string[]; damage: { count: number; sides: number; type: string } };
  save?: { ability: string; conditions?: string[]; damage?: { count: number; sides: number; perSlot?: number; type: string }; successDamage?: "half" | "none"; note?: string };
  note?: string;
}
const BUILTIN_ON_HIT = (onHitJson as unknown as { spells: Record<string, SpellOnHit> }).spells;
/** R82 (D218): the spell's on-hit rule, from its mechanics or the SRD index. */
export const onHitOf = (exec: SpellExec | undefined): SpellOnHit | undefined => (exec ? exec.onHit ?? BUILTIN_ON_HIT[exec.spellId] : undefined);

/**
 * R90 (D225): what a spell's lasting effect does to the dice of the creature under it (`scope: "actor"`) or of whoever
 * attacks it (`scope: "target"`), and the damage its caster adds against it (`againstTargetOnly`).
 */
export interface SpellBearerPart {
  modifier?: { family: string; scope?: "actor" | "target"; rollState?: "advantage" | "disadvantage"; bonus?: { dice?: { count: number; sides: number }; flat?: number; sign?: number }; consumeOnUse?: boolean; ability?: string };
  attackDamage?: { damageType: string; dice?: { count: number; sides: number }; flat?: number; againstTargetOnly?: boolean; sourceKinds?: string[] };
}
const BUILTIN_BEARER = (bearerJson as unknown as { spells: Record<string, SpellBearerPart[]> }).spells;
/** R90 (D225): the lasting-effect parts of a spell — the catalog's, plus what the SRD index adds (유도 화살's advantage). */
export const bearerPartsOf = (spellId: string): SpellBearerPart[] => [...(spellExec(spellId)?.trackedEffects ?? []), ...(BUILTIN_BEARER[spellId] ?? [])];

/**
 * H2 (D239): a spell cast through a weapon attack — the attack and damage use the spellcasting ability of the list
 * that knows it, and from each character `level` on its extra dice are the step's.
 */
export interface WeaponSpell { ability: "spellcasting"; damageType?: string; extraDice?: Array<{ level: number; dice: string }> }
const BUILTIN_WEAPON_SPELLS = (weaponSpellJson as unknown as { spells: Record<string, WeaponSpell> }).spells;
export const weaponSpellOf = (spellId: string): WeaponSpell | undefined => spellExec(spellId)?.weaponSpell ?? BUILTIN_WEAPON_SPELLS[spellId];

/** R77 (D212): a concentration spell used again without a slot — its economy, and a different effect when it has one. */
export interface SpellSustain { economy: "action" | "bonus-action" | "none"; primary?: SpellPrimary; note?: string; /** R89 (D224): the repeat happens per this many feet moved inside the area (가시 성장), not on entering. */ move?: number }

const raw = catalogJson as unknown as { definitions: Record<string, SpellExec> | SpellExec[] };
const list: SpellExec[] = Array.isArray(raw.definitions) ? raw.definitions : Object.values(raw.definitions);
const byId = new Map(list.map((entry) => [entry.spellId, entry]));

const DAMAGE_KINDS = new Set(["attack-damage", "save-damage", "save-compound-damage", "automatic-projectiles", "multi-attack-damage"]);
const BUILTIN_SUSTAIN = (sustainJson as unknown as { spells: Record<string, Partial<SpellSustain> | false> }).spells;

/**
 * R77 (D212): whether a spell in effect can be used again without a slot, and how. A concentration spell that deals
 * damage repeats its first effect: a single-target one with the economy it was cast with (영적 무기's bonus action,
 * 흡혈의 손길's action), an area one as a roll that costs the caster nothing (a creature entered 달빛 광선). Anything
 * else — 마녀 화살's bonus-action 1d12, a spell with no repeat — is written as `sustain` on the spell's mechanics or in
 * content/indexes/dnd-srd-5.2.1.spell-sustain.json.
 */
export function sustainOf(exec: SpellExec): SpellSustain | null {
  const authored = exec.sustain ?? BUILTIN_SUSTAIN[exec.spellId];
  if (authored === false) return null;
  if (!authored && !(exec.concentration && DAMAGE_KINDS.has(exec.primary.kind))) return null;
  const economy = authored?.economy ?? (exec.targeting.maxTargets > 1 ? "none" : exec.castingEconomy === "bonus-action" ? "bonus-action" : "action");
  return { economy, ...(authored?.primary ? { primary: authored.primary } : {}), ...(authored?.note ? { note: authored.note } : {}), ...(authored?.move ? { move: authored.move } : {}) };
}

/** R77 (D212): the execution of one repeat — the sustain's effect, no new lasting effect, marked as a repeat. */
export function sustainedExec(exec: SpellExec): SpellExec | null {
  const sustain = sustainOf(exec);
  if (!sustain) return null;
  const { trackedEffects: _tracked, ...rest } = exec;
  return { ...rest, primary: sustain.primary ?? exec.primary, castingEconomy: sustain.economy === "bonus-action" ? "bonus-action" : "action", repeat: { economy: sustain.economy } };
}

/** R76 (D211): spells the generated catalog does not know — an installed module's, and any spell with no mechanics at all. */
const installed = new Map<string, SpellExec>();
export const spellExec = (spellId: string): SpellExec | undefined => byId.get(spellId) ?? installed.get(spellId);

/** What the catalog knows about a spell: its text, and the `spell-mechanic` config its module may carry. */
export interface CatalogSpell { id: string; level: number; castingTime: string; range: string; duration: string; ritual: boolean; summary?: string; mechanic?: Record<string, unknown> }

const PRIMARY_KINDS = new Set(["attack-damage", "save-damage", "save-compound-damage", "save-effect", "healing", "temporary-hp", "automatic-projectiles", "multi-attack-damage", "tracked-effect", "maximum-hp", "dispel", "full-healing", "power-word-kill", "revive"]);
const economyOf = (castingTime: string): SpellExec["castingEconomy"] => (/추가 행동|bonus/i.test(castingTime) ? "bonus-action" : /반응|reaction/i.test(castingTime) ? "reaction" : "action");
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * R76 (D211): the execution a catalog spell gets at the table. A module's `spell-mechanic` is used as written (the
 * same shape as the generated catalog); a spell without one is still cast — targets from the board, the slot paid,
 * the effect and its concentration recorded — so every spell on a sheet goes through one flow.
 */
export function execForCatalogSpell(spell: CatalogSpell): SpellExec {
  const concentration = /집중|concentration/i.test(spell.duration);
  const mechanic = spell.mechanic;
  if (mechanic && isObject(mechanic.primary) && PRIMARY_KINDS.has(String(mechanic.primary.kind)) && isObject(mechanic.targeting)) {
    const targeting = mechanic.targeting as Partial<SpellExec["targeting"]>;
    return {
      ...(mechanic as unknown as SpellExec), spellId: spell.id, baseLevel: typeof mechanic.baseLevel === "number" ? mechanic.baseLevel : spell.level,
      castingEconomy: (mechanic.castingEconomy as SpellExec["castingEconomy"]) ?? economyOf(spell.castingTime),
      targeting: { kind: "creature", minTargets: 1, maxTargets: 1, ...targeting },
      concentration: typeof mechanic.concentration === "boolean" ? mechanic.concentration : concentration,
    };
  }
  const self = /^자신|^self/i.test(spell.range.trim());
  const feet = Number(/(\d+)\s*(피트|ft|feet)/i.exec(spell.range)?.[1] ?? 0);
  return {
    spellId: spell.id, baseLevel: spell.level, castingEconomy: economyOf(spell.castingTime),
    targeting: self ? { kind: "self", minTargets: 1, maxTargets: 1, allowedRelations: ["self"] } : { kind: "creature", minTargets: 1, maxTargets: 8, ...(feet ? { rangeFeet: feet } : {}), allowedRelations: ["self", "ally", "enemy", "neutral"] },
    primary: { kind: "tracked-effect", ...(spell.summary ? { summary: spell.summary } : {}), ...(concentration ? { duration: { kind: "concentration" } } : {}) },
    concentration, ritual: spell.ritual,
    // R82 (D218): a patch may give a spell only its on-hit rule or its repeat, without the rest of the mechanics.
    ...(mechanic && isObject(mechanic.onHit) ? { onHit: mechanic.onHit as unknown as SpellOnHit } : {}),
    ...(mechanic && mechanic.sustain !== undefined ? { sustain: mechanic.sustain as SpellExec["sustain"] } : {}),
    ...(mechanic && isObject(mechanic.summon) && Array.isArray(mechanic.summon.forms) ? { summon: mechanic.summon as unknown as SpellSummon } : {}),
  };
}

/** R76 (D211): called when the catalog is built, so the table (and the host in the same app) can cast every spell it lists. */
export function registerCatalogSpells(spells: readonly CatalogSpell[]) {
  installed.clear();
  for (const spell of spells) if (!byId.has(spell.id)) installed.set(spell.id, execForCatalogSpell(spell));
}
export const spellExecs = () => list;

/** SRD condition ids → the sheet's Korean condition names. */
export const CONDITION_KO: Record<string, string> = {
  blinded: "장님", charmed: "매혹", deafened: "귀머거리", frightened: "공포", grappled: "붙잡힘", incapacitated: "행동불능", invisible: "투명", paralyzed: "마비",
  petrified: "석화", poisoned: "중독", prone: "넘어짐", restrained: "포박", stunned: "충격", unconscious: "무의식",
};

/** One line for a menu: what kind of spell and whom it reaches. */
export function describeSpellExec(exec: SpellExec) {
  const kind = exec.primary.kind;
  const what = kind === "attack-damage" ? "주문 공격" : kind === "save-damage" || kind === "save-compound-damage" ? `${abilityKo((exec.primary as { saveAbility: string }).saveAbility)} 내성` : kind === "save-effect" ? `${abilityKo((exec.primary as { saveAbility: string }).saveAbility)} 내성 · 상태` : kind === "healing" ? "회복" : kind === "temporary-hp" ? "임시 HP" : kind === "automatic-projectiles" ? "자동 명중" : kind === "multi-attack-damage" ? "주문 공격 여러 번" : kind === "tracked-effect" ? "효과" : "기록";
  const targets = exec.targeting.maxTargets > 1 ? `최대 ${exec.targeting.maxTargets >= 64 ? "범위 안 전부" : `${exec.targeting.maxTargets}명`}` : "대상 1";
  return `${what} · ${targets}${exec.targeting.rangeFeet ? ` · ${exec.targeting.rangeFeet} ft` : ""}${exec.concentration ? " · 집중" : ""}${exec.castingEconomy === "bonus-action" ? " · 추가 행동" : exec.castingEconomy === "reaction" ? " · 반응" : ""}`;
}

const abilityKo = (key: string) => ({ str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" } as Record<string, string>)[key] ?? key;
