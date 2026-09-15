/**
 * CharacterRuntime: the mutable state of play (current HP, slots and resources used, conditions, equipped items,
 * bag changes, a short activity log), persisted next to the source and reconciled against the derived character
 * whenever the source changes.
 */
import type { DerivedCharacter, InventoryPatch } from "./types";

export interface RuntimeLogEntry { at: string; text: string }

/** A feature or spell in effect (Rage, Bless): ended by its "종료" button, by the round counter, or by a rest. */
export interface ActiveEffect {
  /** `feature:<featureId>` or `spell:<spellId>`. */
  key: string;
  name: string;
  source: "feature" | "spell";
  duration: string;
  concentration: boolean;
  /** Round counter when the duration is short enough to track (10 rounds for one minute). */
  rounds?: number;
  elapsed: number;
  startedAt: string;
}

export interface CharacterRuntime {
  schema: 2;
  characterId: string;
  hp: { current: number; temp: number; maxSeen: number };
  hitDiceSpent: Record<string, number>;
  slotsUsed: Record<number, number>;
  pactSlotsUsed: number;
  resourcesUsed: Record<string, number>;
  conditions: string[];
  exhaustion: number;
  deathSaves: { success: number; failure: number };
  heroicInspiration: boolean;
  equipped: { armor?: string; shield?: string; mainHand?: string; offHand?: string };
  attuned: string[];
  gold: number;
  inventory: InventoryPatch;
  log: RuntimeLogEntry[];
  effects: ActiveEffect[];
  updatedAt: string;
}

export const emptyInventoryPatch = (): InventoryPatch => ({ removed: [], quantities: {}, extra: [] });

export function initialRuntime(derived: DerivedCharacter): CharacterRuntime {
  const armor = derived.inventory.find((item) => item.equipped && item.kind === "armor");
  const shield = derived.inventory.find((item) => item.equipped && item.kind === "shield");
  const weapon = derived.inventory.find((item) => item.equipped && item.kind === "weapon");
  return {
    schema: 2,
    characterId: derived.id,
    hp: { current: derived.hp.max, temp: 0, maxSeen: derived.hp.max },
    hitDiceSpent: {},
    slotsUsed: {},
    pactSlotsUsed: 0,
    resourcesUsed: {},
    conditions: [],
    exhaustion: 0,
    deathSaves: { success: 0, failure: 0 },
    heroicInspiration: false,
    equipped: { armor: armor?.instanceId, shield: shield?.instanceId, mainHand: weapon?.instanceId },
    attuned: [],
    gold: derived.gold,
    inventory: emptyInventoryPatch(),
    log: [],
    effects: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Clamp runtime values to the derived maxima after a source change (level up, new item, module install). A raised
 * HP maximum raises current HP by the same amount, as a level-up does at the table.
 */
export function reconcileRuntime(runtime: CharacterRuntime, derived: DerivedCharacter): CharacterRuntime {
  const delta = derived.hp.max - runtime.hp.maxSeen;
  const current = Math.max(0, Math.min(derived.hp.max, runtime.hp.current + Math.max(0, delta)));
  const slotsUsed: Record<number, number> = {};
  for (const [level, used] of Object.entries(runtime.slotsUsed)) { const max = derived.spellSlots[Number(level)] ?? 0; if (max > 0) slotsUsed[Number(level)] = Math.min(used, max); }
  const resourcesUsed: Record<string, number> = {};
  for (const resource of derived.resources) { const used = runtime.resourcesUsed[resource.id]; if (used) resourcesUsed[resource.id] = Math.min(used, resource.max); }
  const hitDiceSpent: Record<string, number> = {};
  for (const [die, count] of Object.entries(derived.hitDice)) { const spent = runtime.hitDiceSpent[die]; if (spent) hitDiceSpent[die] = Math.min(spent, count); }
  const instances = new Set(derived.inventory.map((item) => item.instanceId));
  const keep = (id?: string) => (id && instances.has(id) ? id : undefined);
  return {
    ...runtime,
    hp: { current, temp: runtime.hp.temp, maxSeen: derived.hp.max },
    slotsUsed,
    pactSlotsUsed: Math.min(runtime.pactSlotsUsed, derived.pactMagic?.count ?? 0),
    resourcesUsed,
    hitDiceSpent,
    inventory: runtime.inventory ?? emptyInventoryPatch(),
    log: runtime.log ?? [],
    effects: runtime.effects ?? [],
    equipped: { armor: keep(runtime.equipped.armor), shield: keep(runtime.equipped.shield), mainHand: keep(runtime.equipped.mainHand), offHand: keep(runtime.equipped.offHand) },
    updatedAt: new Date().toISOString(),
  };
}
