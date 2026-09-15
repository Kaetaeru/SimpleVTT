/**
 * "사용" on a feature, shared by the sheet and the turn panel: ask for points when the pool is spent by amount,
 * roll heal/temp HP/logged dice through the dice overlay, then apply against the stored runtime (the dice take a
 * while and the sheet may have changed meanwhile). Effects that change the sheet at once (Aid) apply on start.
 */
import type { ContentCatalog } from "../catalog/catalog";
import { deriveCharacter } from "./derive";
import { describeRoll, parseFormula, type RollResult, type RollSpec } from "./dice";
import { applyHealing, noteLog, useFeature, type FeatureUseExtras } from "./play";
import type { CharacterRuntime } from "./runtime";
import type { CharacterSource, DerivedCharacter, DerivedFeature } from "./types";
import { featureActivation } from "../rules/activation";
import { effectApplication } from "../rules/effects";

export interface ActivateDeps {
  source: CharacterSource;
  catalog: ContentCatalog;
  derived: DerivedCharacter;
  runtime: CharacterRuntime;
  rollDice: (spec: RollSpec) => Promise<RollResult>;
  save: (updater: (current: CharacterRuntime) => CharacterRuntime) => Promise<unknown> | void;
  /** How many points to spend (Lay on Hands); null cancels. Defaults to a prompt. */
  askPoints?: (name: string, left: number) => Promise<number | null> | number | null;
  /** Spend those points on oneself? Defaults to a confirm. */
  confirmSelfHeal?: (points: number) => Promise<boolean> | boolean;
}

/** A formula with dice goes through the overlay; a plain number (temp HP = level) is applied at once. */
export async function rollTotal(rollDice: ActivateDeps["rollDice"], spec: RollSpec, lines?: string[]) {
  const parsed = parseFormula(spec.formula);
  if (parsed && parsed.dice.length === 0) return parsed.modifier;
  const result = await rollDice(spec);
  lines?.push(describeRoll(result));
  return result.total;
}

/** An effect that just started may change the sheet at once (Aid: +5 max HP and +5 current HP). */
export function withEffectStart(source: CharacterSource, catalog: ContentCatalog, derived: DerivedCharacter, previous: CharacterRuntime, next: CharacterRuntime) {
  const started = (next.effects ?? []).filter((effect) => !(previous.effects ?? []).some((item) => item.key === effect.key));
  let out = next;
  for (const effect of started) {
    const application = effectApplication(effect, derived, catalog);
    if (application?.onStart?.heal) {
      const live = deriveCharacter(source, catalog, { equipped: out.equipped, inventory: out.inventory, effects: out.effects });
      out = applyHealing(out, live, application.onStart.heal);
    }
  }
  return out;
}

export type ActivateOutcome = "done" | "refused" | "cancelled" | "none";

export async function activateFeature(feature: DerivedFeature, deps: ActivateDeps): Promise<ActivateOutcome> {
  const { derived, runtime, rollDice } = deps;
  const activation = featureActivation(feature, derived);
  if (!activation) return "none";
  const extras: FeatureUseExtras = {};
  if (activation.points && activation.resourceId) {
    const pool = derived.resources.find((resource) => resource.id === activation.resourceId);
    const left = pool ? pool.max - (runtime.resourcesUsed[pool.id] ?? 0) : 0;
    const ask = deps.askPoints ?? ((name, max) => { const answer = prompt(`${name}: 몇 점을 쓸까요? (남은 ${max})`, String(Math.min(max, 5))); if (answer === null) return null; const points = Number(answer); if (!Number.isInteger(points) || points < 1 || points > max) { alert("1 이상, 남은 점수 이하의 정수를 넣어 주세요."); return null; } return points; });
    const points = await ask(feature.name, left);
    if (points === null) return "cancelled";
    extras.points = points;
    const self = await (deps.confirmSelfHeal ?? ((count: number) => confirm(`${count}점을 자신에게 써서 HP를 ${count} 회복할까요? (취소: 다른 대상)`)))(points);
    if (self) extras.healRoll = points;
  }
  const lines: string[] = [];
  if (activation.heal) extras.healRoll = await rollTotal(rollDice, { label: feature.name, formula: activation.heal(derived), note: "회복", kind: "custom" }, lines);
  if (activation.tempHp) extras.tempRoll = await rollTotal(rollDice, { label: feature.name, formula: activation.tempHp(derived), note: "임시 HP", kind: "custom" }, lines);
  if (activation.roll) { const roll = activation.roll(derived); extras.rolled = { label: roll.label, total: await rollTotal(rollDice, { label: roll.label, formula: roll.formula, kind: "custom" }, lines) }; }
  let refused = false;
  await deps.save((current) => {
    const next = useFeature(lines.reduce((acc, line) => noteLog(acc, line), current), derived, feature, activation, extras);
    if (!next) { refused = true; return current; }
    return withEffectStart(deps.source, deps.catalog, derived, current, next);
  });
  return refused ? "refused" : "done";
}

/** Features the turn panel offers: those with a rule to activate, with their remaining uses. */
export function usableFeatures(derived: DerivedCharacter, runtime: CharacterRuntime) {
  return derived.features.flatMap((feature) => {
    const activation = featureActivation(feature, derived);
    if (!activation) return [];
    const pool = activation.resourceId ? derived.resources.find((resource) => resource.id === activation.resourceId) : undefined;
    const left = pool ? pool.max - (runtime.resourcesUsed[pool.id] ?? 0) : undefined;
    return [{ feature, activation, pool, left, bonus: Boolean(activation.note && /추가 행동|Bonus/i.test(activation.note)) }];
  });
}
