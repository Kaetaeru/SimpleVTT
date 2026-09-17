/**
 * R16 (ROLL20_TABLE_SPEC.md D112): the spells that actually put a creature on the board.
 *
 * Most 2024 "conjure" spells no longer summon anything — they are auras and areas whose text the spell card already
 * carries, so they say they place no creature. What remains creates a real creature, and the SRD names what it may be.
 *
 * H6a (D248): which spell does which is data — `content/indexes/dnd-srd-5.2.1.spell-creatures.json` for the SRD, a
 * module spell's `creatures` mechanic otherwise. This file only resolves a filter against the compendium.
 */
import { MONSTERS, monsterById } from "../compendium/monsters";
import { creaturesOf } from "../compendium/spells";

export interface SummonRule {
  spellId: string;
  /** Monster ids the caster may pick, in the data's own order. Empty means "any creature the DM names". */
  choices: string[];
  /** How many creatures one cast puts on the board. */
  count: number;
  /** Shown on the card next to the buttons. */
  note: string;
  /** True when the spell's own stat block is not in the compendium, so the DM supplies one. */
  needsOwnBlock?: boolean;
}

export function summonRule(spellId: string): SummonRule | undefined {
  const rule = creaturesOf(spellId);
  if (!rule || rule.none) return undefined;
  const filter = rule.filter;
  const choices = filter
    ? MONSTERS.filter((monster) => (!filter.creatureType || monster.creatureType === filter.creatureType) && (!filter.cr || monster.crText === filter.cr)).map((monster) => monster.id)
    : (rule.choices ?? []).filter((id) => monsterById(id));
  return { spellId, choices, count: rule.count ?? 1, note: rule.note ?? "", ...(rule.needsOwnBlock ? { needsOwnBlock: true } : {}) };
}

export const summonsNothing = (spellId: string) => creaturesOf(spellId)?.none;
