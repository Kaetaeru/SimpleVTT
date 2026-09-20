/**
 * R42 (D182): the half of a contract's outcome that belongs to the table rather than a sheet.
 *
 * `applyContractOutcome` (client/character) settles what a character sheet can answer on its own. What is left needs
 * the board: a condition put on somebody else, a creature summoned or sent away, movement, and the questions only the
 * DM can settle. The host owns no catalog, so it asks for this shape and applies it.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { DerivedCharacter } from "../character/types";
import { ATTACK_INVOCATIONS, characterScope, entryOpen, evaluate, type ConditionDuration } from "./contract";
import { atOthers, CHOSEN_POINTS_REF, contractOutcome, featureContract, formula as useFormula } from "./contractActivation";

export interface TableOutcome {
  label: string;
  conditionsApplied: string[];
  conditionsRemoved: string[];
  /** V3d (D258): turn marks the use puts on its user (인내의 방어: 회피·이탈). */
  selfMarks: string[];
  deathSave: boolean;
  notes: string[];
  artifacts: Array<{ kind: string; monsterId?: string; count?: number }>;
  /**
   * R58 (D193): what the use does to the people it was aimed at. 고무적인 지도자 hands out temporary hit points,
   * 치유사 heals, 요리사 and 독 제조자 put an item in somebody's bag. `max` is how many may be chosen, when the rule
   * says so. Everything here needs a target, which is why it could not live on the sheet.
   */
  /** V4u (D283): the creatures it is aimed at stop dying (죽음 방비). */
  stabilizes?: boolean;
  party: { tempHp?: string; /** D329: one pool of temporary hit points shared evenly among the chosen (고무하는 강타). */ tempHpPool?: string; heal?: string; /** V4p (D278): the healing rolls its dice at maximum (최상급 치유). */ healMaximized?: boolean; grants: string[]; max?: number; /** V4a (D263): an amount shared out among the chosen creatures, none past half its maximum. */ healPool?: { amount: number; cap: "half-max" }; /** V4c (D265): the use heals its target by the points chosen on the sheet, at most this many (안수). */ healPoints?: number };
  /** V4d (D266): effects the chosen creatures carry, with the rescue die they may spend (바드의 영감). */
  effects?: Array<{ name: string; duration: string; rounds?: number; rescueDice?: string }>;
  /** V4b (D264): conditions the chosen creatures save against (언데드 퇴치, 적 퇴치). */
  conditionSaves?: Array<{ condition: string; ability: string; dc: number; duration?: ConditionDuration; repeatSave?: "turn-end"; /** D318: more conditions the same save decides. */ also?: string[] }>;
  /** V4a (D263): damage the use deals to the chosen creatures, rolled once, with the save that resists it. */
  strikes?: Array<{ formula: string; damageType: string; save?: { ability: string; dc: number; success: "half" | "none" } }>;
}


/** What this feature's contract asks the table for, or null when it asks for nothing. */
export function tableOutcome(derived: DerivedCharacter, catalog: ContentCatalog, ruleKey: string): TableOutcome | null {
  const contract = featureContract(catalog, ruleKey);
  if (!contract) return null;
  const scope = characterScope(derived);
  // D308: a use this character does not have (another ancestry's breath) does nothing at the table.
  if (!contract.entryPoints.every((entry) => entryOpen(entry, scope))) return null;
  const outcome = contractOutcome(contract, scope);
  const applied: string[] = [];
  const selfMarks: string[] = [];
  const removed: string[] = [];
  const party: TableOutcome["party"] = { grants: [] };
  const strikes: NonNullable<TableOutcome["strikes"]> = [];
  const conditionSaves: NonNullable<TableOutcome["conditionSaves"]> = [];
  const effects: NonNullable<TableOutcome["effects"]> = [];
  // D300: the dice may be named by expressions instead of a literal formula (영감의 외투: 2 × the bard's own die).
  const formula = (operation: { dice?: string; amount?: unknown; diceCount?: unknown; diceSides?: unknown }) =>
    useFormula(operation.dice, operation.amount as never, scope, operation.diceCount as never, operation.diceSides as never);
  let stabilizes = false;
  for (const entry of contract.entryPoints) {
    if (ATTACK_INVOCATIONS.has(entry.invocation)) continue;
    for (const operation of entry.operations) {
      if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
      // V4d (D266): an effect put on the chosen creatures (바드의 영감's die).
      if (operation.kind === "effect.apply" && atOthers(operation.target)) { const sides = operation.template.rescueDie ? Number(evaluate(operation.template.rescueDie, scope)) : undefined; effects.push({ name: operation.template.name ?? contract.id, duration: operation.template.duration ?? "", ...(operation.template.rounds !== undefined ? { rounds: operation.template.rounds } : {}), ...(sides ? { rescueDice: `1d${sides}` } : {}) }); continue; }
      // V4c (D265): points chosen on the sheet may heal somebody else (안수).
      if (operation.kind === "resource.change" && "ref" in operation.amount && operation.amount.ref === CHOSEN_POINTS_REF) { party.healPoints = derived.resources.find((resource) => resource.id === operation.resourceId)?.max ?? 0; continue; }
      if (operation.kind === "condition.apply" && operation.target !== "self" && operation.save) {
        const rule = { condition: operation.condition, ability: operation.save.ability, dc: Number(evaluate(operation.save.dc, scope)) || 10, ...(operation.duration ? { duration: operation.duration } : {}), ...(operation.repeatSave ? { repeatSave: operation.repeatSave } : {}) };
        // D318: one use asking the same save twice is one save — 언데드 퇴치's fear and incapacitation land together.
        const same = conditionSaves.find((item) => item.ability === rule.ability && item.dc === rule.dc && JSON.stringify(item.duration) === JSON.stringify(rule.duration) && item.repeatSave === rule.repeatSave);
        if (same) same.also = [...(same.also ?? []), rule.condition]; else conditionSaves.push(rule);
        continue;
      }
      if (operation.kind === "condition.apply" && operation.target !== "self") { applied.push(operation.condition); continue; }
      if (operation.kind === "condition.apply") { selfMarks.push(operation.condition); continue; }
      // V3f (D260): a condition the use takes off the people it is aimed at.
      if (operation.kind === "condition.remove" && operation.target !== "self") { removed.push(operation.condition); continue; }
      if (operation.kind === "life.stabilize" && operation.target !== "self") { stabilizes = true; continue; }
      // R58 (D193): the half aimed at other people. The sheet cannot answer any of it — it does not know who.
      if (!("target" in operation) || !atOthers(operation.target)) continue;
      if (operation.kind === "damage.apply") { const rolled = useFormula(operation.dice, operation.amount, scope, operation.diceCount, operation.diceSides); if (rolled) strikes.push({ formula: rolled, damageType: operation.damageType, ...(operation.save ? { save: { ability: operation.save.ability, dc: Number(evaluate(operation.save.dc, scope)) || 10, success: operation.save.success } } : {}) }); continue; }
      // D329: one pool shared among the chosen creatures (고무하는 강타: 2d8 + level split as they like).
      if (operation.kind === "temp-hp.grant" && operation.pool === "share") party.tempHpPool = formula(operation);
      else if (operation.kind === "temp-hp.grant") party.tempHp = formula(operation);
      else if (operation.kind === "healing.apply" && operation.pool) party.healPool = { amount: Number(evaluate(operation.amount, scope)) || 0, cap: operation.pool };
      else if (operation.kind === "healing.apply") { party.heal = formula(operation); if (derived.healingMaximized) party.healMaximized = true; }
      else if (operation.kind === "content.grant") party.grants.push(operation.contentId);
    }
  }
  const targets = contract.entryPoints.find((entry) => entry.targeting)?.targeting;
  void stabilizes;
  if (targets?.max) party.max = targets.max;
  const table: TableOutcome = {
    ...(stabilizes ? { stabilizes: true } : {}),
    label: derived.features.find((feature) => feature.id.endsWith(ruleKey))?.name ?? ruleKey,
    conditionsApplied: applied,
    conditionsRemoved: removed,
    selfMarks,
    deathSave: outcome.deathSave,
    notes: outcome.notes,
    artifacts: outcome.artifacts.map((item) => ({ kind: item.kind, monsterId: item.monsterId, count: item.count })),
    party,
    ...(strikes.length ? { strikes } : {}),
    ...(conditionSaves.length ? { conditionSaves } : {}),
    ...(effects.length ? { effects } : {}),
  };
  const asks = table.conditionsApplied.length || table.conditionsRemoved.length || table.selfMarks.length || table.deathSave || table.notes.length || table.artifacts.length
    || party.tempHp || party.tempHpPool || party.heal || party.healPool || party.healPoints || party.grants.length || strikes.length || conditionSaves.length || effects.length;
  return asks ? table : null;
}
