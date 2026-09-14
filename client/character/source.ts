/**
 * CharacterSource helpers: a fresh source, immutable updates for the wizard (set a choice, add or remove a level,
 * change abilities) and the validation of the ability-score method.
 */
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS } from "../catalog/types";
import { POINT_BUY_BUDGET, pointBuyCost, STANDARD_ARRAY } from "../rules/tables";
import type { AbilityScores, CharacterSource, HitPointChoiceValue } from "./types";

export const DEFAULT_RULES_PROFILE = "dnd-srd-5.2.1";

export function newCharacterId() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `char_${random}`;
}

export const DEFAULT_ABILITIES: AbilityScores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

export function emptySource(overrides: Partial<CharacterSource> = {}): CharacterSource {
  const now = new Date().toISOString();
  return {
    schema: 2,
    id: newCharacterId(),
    name: "",
    rules: { profile: DEFAULT_RULES_PROFILE, modules: [] },
    origin: { speciesId: "", backgroundId: "" },
    abilities: { method: "point-buy", base: { ...DEFAULT_ABILITIES } },
    tracks: [],
    choices: {},
    equipment: { mode: "loadout" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const touch = (source: CharacterSource): CharacterSource => ({ ...source, updatedAt: new Date().toISOString() });

export function setChoice(source: CharacterSource, id: string, values: string[]): CharacterSource {
  const choices = { ...source.choices };
  if (values.length === 0) delete choices[id]; else choices[id] = [...values];
  return touch({ ...source, choices });
}

export function toggleChoiceValue(source: CharacterSource, id: string, value: string, count: number): CharacterSource {
  const current = source.choices[id] ?? [];
  if (current.includes(value)) return setChoice(source, id, current.filter((item) => item !== value));
  if (count === 1) return setChoice(source, id, [value]);
  if (current.length >= count) return source;
  return setChoice(source, id, [...current, value]);
}

export function addLevel(source: CharacterSource, classId: string, hp: HitPointChoiceValue = { kind: "fixed" }): CharacterSource {
  if (source.tracks.length >= 20) return source;
  return touch({ ...source, tracks: [...source.tracks, { classId, hp }] });
}

export function removeLastLevel(source: CharacterSource): CharacterSource {
  if (source.tracks.length === 0) return source;
  const removedIndex = source.tracks.length - 1;
  const choices: Record<string, string[]> = {};
  const prefix = `class.${removedIndex}.`;
  for (const [id, values] of Object.entries(source.choices)) if (!id.startsWith(prefix) && !id.includes(`.class.${removedIndex}.`)) choices[id] = values;
  return touch({ ...source, tracks: source.tracks.slice(0, -1), choices });
}

export function setTrackHp(source: CharacterSource, index: number, hp: HitPointChoiceValue): CharacterSource {
  const tracks = source.tracks.map((track, position) => (position === index ? { ...track, hp } : track));
  return touch({ ...source, tracks });
}

export function setAbility(source: CharacterSource, key: AbilityKey, value: number): CharacterSource {
  return touch({ ...source, abilities: { ...source.abilities, base: { ...source.abilities.base, [key]: value } } });
}

export function setAbilityMethod(source: CharacterSource, method: CharacterSource["abilities"]["method"]): CharacterSource {
  const base = method === "point-buy" ? { ...DEFAULT_ABILITIES } : method === "standard-array" ? { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } : { ...source.abilities.base };
  return touch({ ...source, abilities: { method, base } });
}

export function setOrigin(source: CharacterSource, origin: Partial<CharacterSource["origin"]>): CharacterSource {
  const next = { ...source.origin, ...origin };
  const choices = { ...source.choices };
  if (origin.speciesId !== undefined && origin.speciesId !== source.origin.speciesId) for (const id of Object.keys(choices)) if (id.startsWith("origin.species.") || id.startsWith("feat.species.")) delete choices[id];
  if (origin.backgroundId !== undefined && origin.backgroundId !== source.origin.backgroundId) for (const id of Object.keys(choices)) if (id.startsWith("origin.background.") || id.startsWith("feat.background.") || id.startsWith("equipment.background")) delete choices[id];
  return touch({ ...source, origin: next, choices });
}

export function pointBuyTotal(base: AbilityScores) {
  let total = 0;
  for (const key of ABILITY_KEYS) total += pointBuyCost(base[key]) ?? Number.NaN;
  return total;
}

/** Validation of the ability-score method; returns blocking messages. */
export function validateAbilities(abilities: CharacterSource["abilities"]): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const base = abilities.base;
  if (abilities.method === "point-buy") {
    for (const key of ABILITY_KEYS) if (pointBuyCost(base[key]) === null) blocking.push(`포인트 구매에서는 능력치가 8~15여야 합니다 (${key.toUpperCase()} ${base[key]}).`);
    const total = pointBuyTotal(base);
    if (Number.isFinite(total) && total > POINT_BUY_BUDGET) blocking.push(`포인트 구매 합계가 ${POINT_BUY_BUDGET}점을 넘습니다 (${total}점).`);
    if (Number.isFinite(total) && total < POINT_BUY_BUDGET) warnings.push(`포인트 구매에서 ${POINT_BUY_BUDGET - total}점이 남았습니다.`);
  } else if (abilities.method === "standard-array") {
    const sorted = ABILITY_KEYS.map((key) => base[key]).sort((a, b) => b - a);
    if (sorted.join(",") !== [...STANDARD_ARRAY].join(",")) blocking.push("표준 배열은 15, 14, 13, 12, 10, 8을 각 능력치에 한 번씩 배정합니다.");
  } else {
    for (const key of ABILITY_KEYS) if (!Number.isInteger(base[key]) || base[key] < 1 || base[key] > 20) blocking.push(`능력치는 1~20 사이여야 합니다 (${key.toUpperCase()} ${base[key]}).`);
    warnings.push("능력치를 수동으로 정했습니다 (주사위 굴림 등).");
  }
  return { blocking, warnings };
}
