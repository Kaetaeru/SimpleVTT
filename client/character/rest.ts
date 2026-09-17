/**
 * R78 (ROLL20_TABLE_SPEC.md D213): features used when a short rest ends — 비전 회복, 마력 회복.
 *
 * They were buttons on the turn panel beside 행동 폭증, and pressing one spent the once-a-day pool and gave nothing
 * back. The content now says when they happen (`invocation: "short-rest"`) and what they return (a pool, or spell
 * slots through the reserved `resource.spell-slot-levels`), and the rest window offers them.
 */
import type { ContentCatalog } from "../catalog/catalog";
import { characterScope, evaluate, PACT_SLOT_RESOURCE, REST_INVOCATION, SLOT_LEVELS_RESOURCE, type TriggerEvent } from "../rules/contract";
import { featureContract } from "../rules/contractActivation";
import { featureRuleKey } from "../rules/activation";
import { applyHealing, grantTempHp, noteLog } from "./play";
import type { CharacterRuntime } from "./runtime";
import type { DerivedCharacter } from "./types";

/** R79 (D216): the sheet setting for a trigger feature, by rule key so it survives a level up. */
export const triggerPolicyKey = (featureId: string) => `trigger:${featureRuleKey(featureId)}`;

/** The highest slot level the 2024 recoveries give back. */
const SLOT_CAP = 5;

export interface RestFeature {
  featureId: string;
  name: string;
  /** R81 (D215): the moment it belongs to — a short rest's end or an initiative roll. */
  event: TriggerEvent;
  /** R81 (D215): hit points it restores, as a formula ("1d8+5"). */
  heal?: string;
  /** R99 (D234): temporary hit points it grants (어둠의 존재의 축복). */
  tempHp?: number;
  note?: string;
  /** Pools the use spends (negative) or gives back (positive), by `derived.resources` id. */
  pools: Array<{ resourceId: string; amount: number }>;
  /** Spell slots whose levels may add up to this much. */
  slotLevels?: number;
  /** Pact Magic slots given back. */
  pactSlots?: number;
  /** Why it cannot be used now (its pool is spent, nothing to give back). */
  unavailable?: string;
}

export function restFeatures(derived: DerivedCharacter, runtime: CharacterRuntime, catalog: ContentCatalog, event: TriggerEvent = REST_INVOCATION, options: { nearby?: boolean } = {}): RestFeature[] {
  const scope = characterScope(derived);
  return derived.features.flatMap((feature) => {
    const contract = featureContract(catalog, featureRuleKey(feature.id));
    // V4a (D263): somebody else's kill is answered only by entries that say a nearby kill counts.
    const entries = contract?.entryPoints.filter((entry) => entry.invocation === event && (!options.nearby || entry.killer === "nearby")) ?? [];
    if (!entries.length) return [];
    const out: RestFeature = { featureId: feature.id, name: feature.name, event, pools: [] };
    for (const operation of entries.flatMap((entry) => entry.operations)) {
      if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
      if (operation.kind === "adjudication.request") { out.note = out.note ? `${out.note} · ${operation.question}` : operation.question; continue; }
      if (operation.kind === "healing.apply") { const flat = Number(evaluate(operation.amount, scope)) || 0; out.heal = `${operation.dice ?? ""}${operation.dice && flat ? "+" : ""}${flat || !operation.dice ? flat : ""}`; continue; }
      if (operation.kind === "temp-hp.grant") { out.tempHp = (out.tempHp ?? 0) + Math.max(0, Number(evaluate(operation.amount, scope)) || 0); continue; }
      if (operation.kind !== "resource.change") continue;
      const amount = Number(evaluate(operation.amount, scope)) || 0;
      if (operation.resourceId === SLOT_LEVELS_RESOURCE) out.slotLevels = (out.slotLevels ?? 0) + amount;
      else if (operation.resourceId === PACT_SLOT_RESOURCE) out.pactSlots = (out.pactSlots ?? 0) + amount;
      else out.pools.push({ resourceId: operation.resourceId, amount });
    }
    for (const pool of out.pools.filter((item) => item.amount < 0)) {
      const resource = derived.resources.find((item) => item.id === pool.resourceId);
      if (!resource || resource.max - (runtime.resourcesUsed[resource.id] ?? 0) < -pool.amount) out.unavailable = `${resource?.label ?? pool.resourceId}을(를) 이미 썼습니다`;
    }
    const gives = Boolean(out.tempHp) || out.pools.some((item) => item.amount > 0 && (runtime.resourcesUsed[item.resourceId] ?? 0) > 0) || Boolean(out.slotLevels && spentSlots(derived, runtime).length) || Boolean(out.pactSlots && runtime.pactSlotsUsed > 0) || Boolean(out.heal && runtime.hp.current < derived.hp.max);
    if (!out.unavailable && !gives) out.unavailable = "되찾을 것이 없습니다";
    return [out];
  });
}

/** Spent slots a recovery may give back, one entry per slot, highest first. */
export function spentSlots(derived: DerivedCharacter, runtime: CharacterRuntime): number[] {
  return Object.entries(runtime.slotsUsed).map(([level, used]) => [Number(level), Math.min(used, derived.spellSlots[Number(level)] ?? 0)] as const)
    .filter(([level, used]) => level <= SLOT_CAP && used > 0).sort((a, b) => b[0] - a[0]).flatMap(([level, used]) => Array<number>(used).fill(level));
}

/** The slots a recovery gives back when nobody chose: highest first, while the budget lasts. */
export function pickSlots(derived: DerivedCharacter, runtime: CharacterRuntime, budget: number): number[] {
  const picked: number[] = [];
  let left = budget;
  for (const level of spentSlots(derived, runtime)) if (level <= left) { picked.push(level); left -= level; }
  return picked;
}

/**
 * Spell slots and Pact Magic slots given back. `chosen` slot levels must be spent, 5th or lower, and add up to no more
 * than `levels`; anything over is refused rather than trimmed, so the sheet never gives back what the rule does not.
 */
export function restoreSlots(runtime: CharacterRuntime, derived: DerivedCharacter, give: { levels?: number; pact?: number; chosen?: number[] }, label: string): CharacterRuntime | null {
  let next = runtime;
  const lines: string[] = [];
  if (give.levels) {
    const chosen = give.chosen ?? pickSlots(derived, runtime, give.levels);
    if (chosen.reduce((sum, level) => sum + level, 0) > give.levels || chosen.some((level) => level > SLOT_CAP)) return null;
    const slotsUsed = { ...next.slotsUsed };
    for (const level of chosen) { if (!slotsUsed[level]) return null; slotsUsed[level] -= 1; if (!slotsUsed[level]) delete slotsUsed[level]; }
    next = { ...next, slotsUsed };
    if (chosen.length) lines.push(`슬롯 ${chosen.map((level) => `${level}레벨`).join("·")} 회복`);
  }
  if (give.pact && next.pactSlotsUsed > 0) {
    const back = Math.min(give.pact, next.pactSlotsUsed);
    next = { ...next, pactSlotsUsed: next.pactSlotsUsed - back };
    lines.push(`계약 슬롯 ${back}개 회복`);
  }
  return lines.length ? noteLog(next, `${label}: ${lines.join(", ")}`) : next;
}

/** Use a rest feature: pay its pool, give back what it gives. Null when it cannot be used or the slots chosen do not fit. */
export function useRestFeature(runtime: CharacterRuntime, derived: DerivedCharacter, feature: RestFeature, chosen?: number[], /** R81 (D215): what `feature.heal` rolled. */ healRoll?: number): CharacterRuntime | null {
  if (feature.unavailable) return null;
  const resourcesUsed = { ...runtime.resourcesUsed };
  const lines: string[] = [];
  for (const pool of feature.pools) {
    const resource = derived.resources.find((item) => item.id === pool.resourceId);
    const used = resourcesUsed[pool.resourceId] ?? 0;
    if (pool.amount < 0) { resourcesUsed[pool.resourceId] = used - pool.amount; continue; }
    const back = Math.min(used, pool.amount);
    if (back) { resourcesUsed[pool.resourceId] = used - back; lines.push(`${resource?.label ?? pool.resourceId} ${back} 회복`); }
  }
  let next: CharacterRuntime = { ...runtime, resourcesUsed };
  if (feature.tempHp) { lines.push(`임시 HP ${feature.tempHp}`); next = grantTempHp(next, feature.tempHp); }
  if (feature.heal && healRoll) { lines.push(`HP ${healRoll} 회복 (${feature.heal})`); next = applyHealing(next, derived, healRoll); }
  if (lines.length) next = noteLog(next, `${feature.name}: ${lines.join(", ")}`);
  return restoreSlots(next, derived, { levels: feature.slotLevels, pact: feature.pactSlots, chosen }, feature.name);
}
