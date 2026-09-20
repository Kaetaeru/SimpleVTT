/**
 * The generated spell execution catalog (SRD 5.2, `spellExecutionCatalog.generated.json`): what each spell does when
 * cast at the table — targeting, the primary effect (attack, save, healing, projectiles, tracked effect …),
 * concentration and conditions. Read-only views for the resolver and the command bar.
 */
import srdSpellsJson from "../../content/modules/srd-5.2.1/spells.module.json";
import type { SpellSummon } from "./summonTemplate";

export interface SpellDice { count: number; sides: number; flat?: number; dicePerSlotAboveBase?: number; flatPerSlotAboveBase?: number; cantripScaling?: boolean; addSpellcastingModifier?: boolean;
  /** D322: one more die for every round the spell has been waiting (지연 폭발 화염구). */ dicePerRoundElapsed?: number }
export interface SpellDuration { kind: "concentration" | "rounds" | "minutes" | "hours" | "instant" | "special" | "permanent"; amount?: number; anchorActorId?: string; boundary?: "start" | "end" }
export type SpellPrimary =
  | { kind: "attack-damage"; damageType: string; dice: SpellDice }
  | { kind: "save-damage"; saveAbility: string; damageType: string; dice: SpellDice; successDamage: "none" | "half"; ignoresCoverForSave?: boolean }
  | { kind: "save-compound-damage"; saveAbility: string; components: Array<{ damageType: string; dice: SpellDice }>; successDamage: "none" | "half" }
  | { kind: "save-effect"; saveAbility: string; summary?: string; duration?: SpellDuration }
  | { kind: "healing"; dice: SpellDice;
      /** D322: one pool shared out among the targets, the most hurt first (대량 치유: 700). */
      pool?: { flat?: number; dice?: SpellDice; cap?: "half-max" } }
  | { kind: "temporary-hp"; dice: SpellDice;
      /** D322: one pool of temporary hit points shared out evenly among the targets. */
      pool?: { flat?: number; dice?: SpellDice } }
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
  targeting: { kind: string; rangeFeet?: number; minTargets: number; maxTargets: number; /** V4v (D284): one more creature per slot above the spell's own level (축복). */ targetsPerSlotAboveBase?: number; allowedRelations?: string[]; directTarget?: boolean; requiresSight?: boolean };
  primary: SpellPrimary;
  concentration?: boolean;
  /** V4u (D283): the caster heals by this share of the damage the spell dealt (흡혈의 손길: half). */
  casterHealing?: { mode: "half-damage" };
  effects?: Array<{ conditionId: string; trigger: "failed-save" | "hit" | "always"; duration?: SpellDuration; /** V4s (D281): the effect ends when its bearer attacks or casts (투명화). */ termination?: { targetTakesDamage?: boolean; bearerAttacksOrCasts?: boolean };
    /** D322: the condition lands only on a target at or below this many hit points (권능어: 충격 — 150). */ requiresHpAtMost?: number;
    /** D322: what happens to a target over that many hit points instead, as a line on its row. */ elseNote?: string }>;
  /**
   * D322: a second thing the spell does after its primary, whatever the first did — 얼음 칼's shard bursting on a
   * Dexterity save whether the attack hit or missed, 금속 가열's Constitution save after its damage lands.
   */
  secondary?: SpellPrimary & { appliesTo?: "all" | "damaged"; note?: string; conditions?: string[] };
  trackedEffects?: Array<{ summary: string; trigger: "failed-save" | "hit" | "always"; duration?: SpellDuration;
    /** D321: conditions the bearer takes when the effect ends, and for how long (가속's lethargy). */
    endConditions?: string[]; endDuration?: string } & SpellBearerPart>;
  ritual?: boolean;
  /** R77 (D212): how the spell is used again while it lasts, when that differs from the default (see `sustainOf`). */
  sustain?: Partial<SpellSustain> | false;
  /** R82 (D218): cast right after a weapon hit (the smites) — offered in the on-hit window. */
  onHit?: SpellOnHit;
  /** H2 (D239): cast through a weapon attack (진실의 일격). */
  weaponSpell?: WeaponSpell;
  /** R84 (D219): the creature a summon spell brings, as a template filled in at the cast (compendium/summonTemplate.ts). */
  summon?: SpellSummon;
  /** H6a (D248): the compendium creatures a spell places, or that it places none (see `creaturesOf`). */
  creatures?: SpellCreatures;
  /** H6b (D249): the window this reaction spell answers (see `reactionSpellIds`). */
  reaction?: SpellReaction;
  /** H6c (D250): the target repeats the save at the end of each of its turns (see `repeatSaveOf`). */
  repeatSave?: "turn-end";
  /** V4g (D269): the conditions the spell ends on its targets (하급 회복). */
  removesConditions?: string[];
  /** V4f (D268): what the caster chooses when casting (a module spell's own list). */
  variants?: SpellVariant[];
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
  /** V5b (D290): a mark the hit leaves on the target (빛나는 강타: 그 대상을 노리는 명중에 유리). */
  mark?: { name: string; nextAttack?: { advantage?: boolean; bonus?: number; by: "any" | "others" } };
  note?: string;
}

/** H6a (D248): which compendium creatures a spell places — named ones, or every monster of a type and challenge rating — or why it places none. */
export interface SpellCreatures {
  choices?: string[];
  filter?: { creatureType?: string; cr?: string };
  count?: number;
  note?: string;
  needsOwnBlock?: boolean;
  none?: string;
}
/** V4f (D268): a choice made when casting — its patch over the execution (objects merge, arrays and values replace). */
export interface SpellVariant { id: string; label: string; patch: Record<string, unknown> }
/** V4f (D268): the choices this spell asks for when cast, SRD index or installed module alike. */
/** V4v (D284): how many creatures a cast of this spell may take at this slot level (축복: 슬롯마다 한 명 더). */
export const targetCountOf = (exec: SpellExec, level: number) =>
  exec.targeting.maxTargets + Math.max(0, (level ?? exec.baseLevel) - exec.baseLevel) * (exec.targeting.targetsPerSlotAboveBase ?? 0);

export const variantsOf = (spellId: string): SpellVariant[] => spellExec(spellId)?.variants ?? [];
const mergePatch = (base: unknown, patch: unknown): unknown => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch) || !base || typeof base !== "object" || Array.isArray(base)) return patch;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) out[key] = mergePatch(out[key], value);
  return out;
};
/** V4f (D268): the execution with a chosen variant applied, and the variant's label; an unknown id leaves it as it is. */
export function withVariant(exec: SpellExec, variantId: string | undefined): { exec: SpellExec; label?: string } {
  const variant = variantId ? variantsOf(exec.spellId).find((item) => item.id === variantId) : undefined;
  return variant ? { exec: mergePatch(exec, variant.patch) as SpellExec, label: variant.label } : { exec };
}

/** H6b (D249): a reaction spell and the moment it answers — an attack hitting its caster, or a spell being cast in sight. */
export interface SpellReaction { trigger: "attack.hit-self" | "spell.cast-seen"; /** D314: which one the table offers first when a creature could answer with several (lower first). */ priority?: number }
/** H6b (D249): every spell, SRD or installed, that answers this trigger — the table offers the first one the reactor can cast. */
export const reactionSpellIds = (trigger: SpellReaction["trigger"]): string[] => spellExecs().filter((exec) => exec.reaction?.trigger === trigger).sort((a, b) => (a.reaction?.priority ?? 100) - (b.reaction?.priority ?? 100)).map((exec) => exec.spellId);

/** H6c (D250): when the target of this spell repeats its save, from the spell's mechanics. */
export const repeatSaveOf = (exec: SpellExec): "turn-end" | undefined => exec.repeatSave;

/** H6a (D248): the spell's creature rule, from its mechanics. */
export const creaturesOf = (spellId: string): SpellCreatures | undefined => spellExec(spellId)?.creatures;
/** R82 (D218): the spell's on-hit rule, from its mechanics. */
export const onHitOf = (exec: SpellExec | undefined): SpellOnHit | undefined => exec?.onHit;

/**
 * R90 (D225): what a spell's lasting effect does to the dice of the creature under it (`scope: "actor"`) or of whoever
 * attacks it (`scope: "target"`), and the damage its caster adds against it (`againstTargetOnly`).
 */
export interface SpellBearerPart {
  modifier?: { family: string; scope?: "actor" | "target"; rollState?: "advantage" | "disadvantage"; bonus?: { dice?: { count: number; sides: number }; flat?: number; sign?: number }; consumeOnUse?: boolean; ability?: string };
  attackDamage?: { damageType: string; dice?: { count: number; sides: number }; flat?: number; againstTargetOnly?: boolean; sourceKinds?: string[];
    /** D321: dice added per slot level above the spell's own level (하급 원소 소환). */ dicePerSlotAboveBase?: number };
  /** V4f (D268): resistances, immunities and vulnerabilities the effect gives its bearer. */
  damageDefenses?: Array<{ kind: "resistance" | "immunity" | "vulnerability"; damageType: string }>;
  /** D315: conditions the bearer cannot be given while the effect lasts (영웅심: 공포). English condition ids. */
  conditionImmunities?: string[];
  /** D321: the bearer regains no hit points while the effect lasts (서리 손길). */
  noHealing?: boolean;
}
/** R90 (D225): the lasting-effect parts of a spell (유도 화살's advantage), with the variant it was cast with. */
export const bearerPartsOf = (spellId: string, /** V4f (D268): the variant the effect was cast with. */ variant?: string): SpellBearerPart[] => { const exec = spellExec(spellId); return (exec ? withVariant(exec, variant).exec : undefined)?.trackedEffects ?? []; };

/**
 * H2 (D239): a spell cast through a weapon attack — the attack and damage use the spellcasting ability of the list
 * that knows it, and from each character `level` on its extra dice are the step's.
 */
export interface WeaponSpell { ability: "spellcasting"; damageType?: string; extraDice?: Array<{ level: number; dice: string }> }
export const weaponSpellOf = (spellId: string): WeaponSpell | undefined => spellExec(spellId)?.weaponSpell;

/** R77 (D212): a concentration spell used again without a slot — its economy, and a different effect when it has one. */
export interface SpellSustain {
  economy: "action" | "bonus-action" | "none";
  primary?: SpellPrimary;
  note?: string;
  /** R89 (D224): the repeat happens per this many feet moved inside the area (가시 성장), not on entering. */
  move?: number;
  /** D302: the repeat belongs to the creature the spell first caught — no new target is asked for (마녀 화살). */
  target?: "bound";
  /** D302: what ends the spell that the app cannot see (out of range, total cover); shown as a button that ends it. */
  endWhen?: string;
}


const DAMAGE_KINDS = new Set(["attack-damage", "save-damage", "save-compound-damage", "automatic-projectiles", "multi-attack-damage"]);

/**
 * R77 (D212): whether a spell in effect can be used again without a slot, and how. A concentration spell that deals
 * damage repeats its first effect: a single-target one with the economy it was cast with (영적 무기's bonus action,
 * 흡혈의 손길's action), an area one as a roll that costs the caster nothing (a creature entered 달빛 광선). Anything
 * else — 마녀 화살's bonus-action 1d12, a spell with no repeat — is written as `sustain` on the spell's mechanics or in
 * content/indexes/dnd-srd-5.2.1.spell-sustain.json.
 */
export function sustainOf(exec: SpellExec): SpellSustain | null {
  const authored = exec.sustain;
  if (authored === false) return null;
  if (!authored && !(exec.concentration && DAMAGE_KINDS.has(exec.primary.kind))) return null;
  const economy = authored?.economy ?? (exec.targeting.maxTargets > 1 ? "none" : exec.castingEconomy === "bonus-action" ? "bonus-action" : "action");
  return { economy, ...(authored?.primary ? { primary: authored.primary } : {}), ...(authored?.note ? { note: authored.note } : {}), ...(authored?.move ? { move: authored.move } : {}),
    // D302: whose creature the repeat belongs to, and what ends the spell that this engine cannot see.
    ...(authored?.target === "bound" ? { target: "bound" as const } : {}), ...(authored?.endWhen ? { endWhen: authored.endWhen } : {}) };
}

/** R77 (D212): the execution of one repeat — the sustain's effect, no new lasting effect, marked as a repeat. */
export function sustainedExec(exec: SpellExec): SpellExec | null {
  const sustain = sustainOf(exec);
  if (!sustain) return null;
  const { trackedEffects: _tracked, ...rest } = exec;
  // D308: the repeat of an area spell (가시 성장: whoever moved through it) lands on a creature even though the cast
  // itself named none — the cast picks a point, the repeat picks who is hurt.
  const needsCreature = sustain.primary && sustain.primary.kind !== "tracked-effect" && exec.targeting.maxTargets < 1;
  return { ...rest, ...(needsCreature ? { targeting: { ...exec.targeting, kind: "creature" as const, minTargets: 1, maxTargets: 1 } } : {}), primary: sustain.primary ?? exec.primary, castingEconomy: sustain.economy === "bonus-action" ? "bonus-action" : "action", repeat: { economy: sustain.economy } };
}

/**
 * R76 (D211): spells the generated catalog does not know — an installed module's, and any spell with no mechanics at
 * all. D312: also an SRD spell a module writes a `spell-mechanic` for — the module's execution wins.
 */
const installed = new Map<string, SpellExec>();
export const spellExec = (spellId: string): SpellExec | undefined => installed.get(spellId) ?? srdExecs().get(spellId);

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
    ...(mechanic ? patchParts(mechanic) : {}),
  };
}

/**
 * R82 (D218): a patch may give a spell only some parts — its on-hit rule, its repeat — without the rest of the
 * mechanics. D312: every part a full mechanic has may come this way, including the lasting effect's dice
 * (`trackedEffects`), the weapon it is cast through, its conditions and its cast-time choices.
 */
function patchParts(mechanic: Record<string, unknown>): Partial<SpellExec> {
  return {
    ...(isObject(mechanic.onHit) ? { onHit: mechanic.onHit as unknown as SpellOnHit } : {}),
    ...(mechanic.sustain !== undefined ? { sustain: mechanic.sustain as SpellExec["sustain"] } : {}),
    ...(isObject(mechanic.summon) && Array.isArray(mechanic.summon.forms) ? { summon: mechanic.summon as unknown as SpellSummon } : {}),
    ...(isObject(mechanic.creatures) ? { creatures: mechanic.creatures as unknown as SpellCreatures } : {}),
    ...(isObject(mechanic.reaction) ? { reaction: mechanic.reaction as unknown as SpellReaction } : {}),
    ...(mechanic.repeatSave === "turn-end" ? { repeatSave: "turn-end" as const } : {}),
    ...(Array.isArray(mechanic.trackedEffects) ? { trackedEffects: mechanic.trackedEffects as SpellExec["trackedEffects"] } : {}),
    ...(isObject(mechanic.weaponSpell) ? { weaponSpell: mechanic.weaponSpell as unknown as WeaponSpell } : {}),
    ...(Array.isArray(mechanic.variants) ? { variants: mechanic.variants as SpellVariant[] } : {}),
    ...(Array.isArray(mechanic.effects) ? { effects: mechanic.effects as SpellExec["effects"] } : {}),
    ...(Array.isArray(mechanic.removesConditions) ? { removesConditions: mechanic.removesConditions as string[] } : {}),
    ...(isObject(mechanic.casterHealing) ? { casterHealing: mechanic.casterHealing as SpellExec["casterHealing"] } : {}),
  };
}

/** R76 (D211): called when the catalog is built, so the table (and the host in the same app) can cast every spell it lists. */
export function registerCatalogSpells(spells: readonly CatalogSpell[]) {
  installed.clear();
  for (const spell of spells) {
    const builtin = srdExecs().get(spell.id);
    if (!builtin) { installed.set(spell.id, execForCatalogSpell(spell)); continue; }
    // D312: a module's mechanic for an SRD spell — a whole one replaces the SRD's, a patch lays its parts over it.
    if (!spell.mechanic) continue;
    const whole = isObject(spell.mechanic.primary) && isObject(spell.mechanic.targeting);
    installed.set(spell.id, whole ? execForCatalogSpell(spell) : { ...builtin, ...patchParts(spell.mechanic) });
  }
}
export const spellExecs = () => [...new Map([...srdExecs(), ...installed]).values()];

/**
 * D314: the SRD's spells, executed from the SRD spells module (content/modules/srd-5.2.1) the same way as any
 * module's — so a spell can be cast before any catalog is built. Read once, on first use.
 */
let srdCache: Map<string, SpellExec> | undefined;
function srdExecs(): Map<string, SpellExec> {
  if (srdCache) return srdCache;
  const module = srdSpellsJson as unknown as { content: Array<{ id: string; mechanics: Array<{ kind: string; config: Record<string, unknown> }> }> };
  srdCache = new Map();
  for (const entry of module.content) {
    const def = entry.mechanics.find((item) => item.kind === "spell-definition")?.config ?? {};
    const mechanic = entry.mechanics.find((item) => item.kind === "spell-mechanic")?.config;
    srdCache.set(entry.id, execForCatalogSpell({ id: entry.id, level: Number(def.level ?? 0), castingTime: String(def.castingTimeText ?? ""), range: String(def.rangeText ?? ""), duration: String(def.durationText ?? ""), ritual: def.ritual === true, mechanic }));
  }
  return srdCache;
}

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
