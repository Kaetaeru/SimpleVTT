/**
 * The generated spell execution catalog (SRD 5.2, `spellExecutionCatalog.generated.json`): what each spell does when
 * cast at the table — targeting, the primary effect (attack, save, healing, projectiles, tracked effect …),
 * concentration and conditions. Read-only views for the resolver and the command bar.
 */
import catalogJson from "../../src/generated/spellExecutionCatalog.generated.json";

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
  | { kind: "maximum-hp" | "dispel" | "full-healing" | "power-word-kill" | "revive"; summary?: string; [key: string]: unknown };

export interface SpellExec {
  spellId: string;
  baseLevel: number;
  castingEconomy: "action" | "bonus-action" | "reaction";
  targeting: { kind: string; rangeFeet?: number; minTargets: number; maxTargets: number; allowedRelations?: string[]; directTarget?: boolean; requiresSight?: boolean };
  primary: SpellPrimary;
  concentration?: boolean;
  effects?: Array<{ conditionId: string; trigger: "failed-save" | "hit" | "always"; duration?: SpellDuration }>;
  trackedEffects?: Array<{ summary: string; trigger: "failed-save" | "hit" | "always"; duration?: SpellDuration }>;
  ritual?: boolean;
}

const raw = catalogJson as unknown as { definitions: Record<string, SpellExec> | SpellExec[] };
const list: SpellExec[] = Array.isArray(raw.definitions) ? raw.definitions : Object.values(raw.definitions);
const byId = new Map(list.map((entry) => [entry.spellId, entry]));

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
