/**
 * "사용" on a feature, shared by the sheet and the turn panel: ask for points when the pool is spent by amount,
 * roll heal/temp HP/logged dice through the dice overlay, then apply against the stored runtime (the dice take a
 * while and the sheet may have changed meanwhile). Effects that change the sheet at once (Aid) apply on start.
 */
import type { ContentCatalog } from "../catalog/catalog";
import { deriveCharacter } from "./derive";
import { describeRoll, parseFormula, type RollResult, type RollSpec } from "./dice";
import { applyHealing, endEffect, noteLog, useFeature, type FeatureUseExtras } from "./play";
import type { CharacterRuntime } from "./runtime";
import type { CharacterSource, DerivedCharacter, DerivedFeature } from "./types";
import { featureActivation, featureRuleKey } from "../rules/activation";
import { characterScope } from "../rules/contract";
import { contractDurations, contractOutcome, contractRemovals, featureContract } from "../rules/contractActivation";
import { applyContractOutcome } from "./contractOutcome";
import { effectApplication, formOptions } from "../rules/effects";
import { contractEffect } from "../rules/contractEffects";

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
  /** V4c (D265): the points chosen and whether they went to the user — the table heals somebody else with them. */
  onChosenPoints?: (points: number, self: boolean) => void;
  /** V4k (D273): which form to take (야생 변신); null cancels. Defaults to a prompt over the list. */
  askForm?: (name: string, options: Array<{ id: string; name: string; crText: string }>) => Promise<string | null> | string | null;
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
  const activation = featureActivation(feature, derived, contractDurations(deps.catalog, characterScope(derived)));
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
    deps.onChosenPoints?.(points, self);
  }
  // V4k (D273): a use that turns its user into something asks which form before anything is spent (야생 변신).
  const formContract = featureContract(deps.catalog, featureRuleKey(feature.id));
  const formSpec = formContract ? contractEffect(formContract, characterScope(derived)).application.form : undefined;
  if (formSpec) {
    const options = formOptions(formSpec).map((monster) => ({ id: monster.id, name: monster.name, crText: monster.crText }));
    const ask = deps.askForm ?? ((name: string, list: typeof options) => {
      const answer = prompt(`${name}: 어떤 형태로? (${list.map((item) => item.name).slice(0, 12).join(", ")} …)`, list[0]?.name ?? "");
      if (answer === null) return null;
      return list.find((item) => item.name === answer.trim())?.id ?? null;
    });
    const picked = await ask(feature.name, options);
    if (!picked) return "cancelled";
    extras.form = picked;
  }
  const lines: string[] = [];
  if (activation.heal) {
    const formula = activation.heal(derived);
    // V4p (D278): 최상급 치유 — the dice of a healing this sheet rolls come up at their maximum, contract or spell.
    const parsed = derived.healingMaximized ? parseFormula(formula) : null;
    if (parsed) {
      extras.healRoll = parsed.dice.reduce((sum, group) => sum + group.count * group.sides, 0) + parsed.modifier;
      lines.push(`${feature.name}: ${formula} 최대값 = ${extras.healRoll}`);
    } else extras.healRoll = await rollTotal(rollDice, { label: feature.name, formula, note: "회복", kind: "custom" }, lines);
  }
  if (activation.tempHp) extras.tempRoll = await rollTotal(rollDice, { label: feature.name, formula: activation.tempHp(derived), note: "임시 HP", kind: "custom" }, lines);
  // V4a (D263): the long rests a pool stays spent for, rolled now.
  const lockRests = activation.lockout ? await rollTotal(rollDice, { label: `${feature.name} — 잠기는 긴 휴식 수`, formula: activation.lockout.dice, kind: "custom" }, lines) : undefined;
  if (activation.roll) { const roll = activation.roll(derived); extras.rolled = { label: roll.label, total: await rollTotal(rollDice, { label: roll.label, formula: roll.formula, kind: "custom" }, lines) }; }
  let refused = false;
  await deps.save((current) => {
    // R39 (D179): a contract may end other effects as part of the use (a new Wild Shape replacing the last one).
    // V4k (D273): the old one goes before the new one starts, or the removal takes the fresh effect off again.
    const contractFirst = featureContract(deps.catalog, featureRuleKey(feature.id));
    const cleared = contractFirst ? contractRemovals(contractFirst, characterScope(derived)).reduce((acc, key) => endEffect(acc, key, feature.name), current) : current;
    const used = useFeature(lines.reduce((acc, line) => noteLog(acc, line), cleared), derived, feature, activation, extras);
    const lock = activation.lockout;
    const next = used && lock && lockRests ? noteLog({ ...used, resourcesUsed: { ...used.resourcesUsed, [lock.resourceId]: derived.resources.find((resource) => resource.id === lock.resourceId)?.max ?? 1 }, resourceLockouts: { ...(used.resourceLockouts ?? {}), [lock.resourceId]: lockRests } }, `${feature.name}: 긴 휴식 ${lockRests}번 동안 다시 못 씀`) : used;
    if (!next) { refused = true; return current; }
    const contract = contractFirst;
    const ended = next;
    // R41 (D181): the rest of the vocabulary that lands on a sheet — conditions taken off, a hit-point maximum moved,
    // stabilising, standing up, an item granted. Everything the contract says happens; what it does not say is untouched.
    const settled = contract ? applyContractOutcome(ended, derived, deps.catalog, contractOutcome(contract, characterScope(derived)), feature.name) : ended;
    return withEffectStart(deps.source, deps.catalog, derived, current, settled);
  });
  return refused ? "refused" : "done";
}

/**
 * R65 (D200): which part of the turn a use belongs to. V1a (D253): the contract says so with an `economy` payment
 * (`bonus-action`, `reaction`, `action`); it used to be read out of the reminder text, which also took "행동 폭증"
 * and "질주 행동 동안" for the action itself. Anything without one costs nothing of the turn and sits with the actions.
 */
export type FeatureEconomy = "action" | "bonus" | "reaction" | "free";
export function featureEconomy(bucket: string | undefined): FeatureEconomy {
  return bucket === "bonus-action" ? "bonus" : bucket === "reaction" ? "reaction" : bucket === "action" ? "action" : "free";
}

/** Features the turn panel offers: those with a rule to activate, with their remaining uses. */
export function usableFeatures(derived: DerivedCharacter, runtime: CharacterRuntime, catalog?: ContentCatalog) {
  const durations = catalog ? contractDurations(catalog, characterScope(derived)) : undefined;
  return derived.features.flatMap((feature) => {
    const activation = featureActivation(feature, derived, durations);
    if (!activation) return [];
    const pool = activation.resourceId ? derived.resources.find((resource) => resource.id === activation.resourceId) : undefined;
    const left = pool ? pool.max - (runtime.resourcesUsed[pool.id] ?? 0) : undefined;
    // R65 (D200): whether pressing it does anything — a pool, dice, an effect, healing, or a contract operation that is
    // not just a sentence. The rest ("서브클래스: 챔피언", a passive's reminder) belongs on the sheet, not on a button.
    const contract = catalog ? featureContract(catalog, featureRuleKey(feature.id)) : undefined;
    const pressable = Boolean(activation.resourceId || activation.points || activation.roll || activation.duration || activation.heal || activation.tempHp || activation.hitDie
      // D307: a passive (`property.modify` on a manual entry) is already on the sheet; a button for it did nothing.
      || contract?.entryPoints.some((entry) => entry.invocation === "manual" && entry.operations.some((operation) => operation.kind !== "adjudication.request" && operation.kind !== "property.modify")));
    const economy = featureEconomy(activation.economy);
    // V4w (D285): a slot level this sheet has no slots of cannot be spent or handed back, so it is not offered.
    const slotLevel = activation.slotLevel ?? activation.slotGain;
    const hasSlot = slotLevel === undefined || (derived.spellSlots[slotLevel] ?? 0) > 0;
    return [{ feature, activation, pool, left, bonus: economy === "bonus", economy, pressable: pressable && hasSlot }];
  });
}
