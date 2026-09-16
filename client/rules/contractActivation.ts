/**
 * R39 (D179): what a contract says a use *starts*, *ends* and *pauses*.
 *
 * `activation.ts` decides a feature's timed effect from a hand-written table (`duration: () => timed("10분", 100)`).
 * A contract says the same thing as data — `effect.apply` with a template and a `lifetime` — and this module turns it
 * into the `ParsedDuration` the sheet already counts. `effect.remove` and `effect.suppress` are the other two ends of
 * the same idea: one takes an effect off, the other leaves it on the sheet but stops it counting for anything.
 */
import { COUNTED_LIFETIME, evaluate, LIFETIME_KO, type CommonPlayContract, type ContractOperation, type Scope } from "./contract";
import type { ParsedDuration } from "./activation";

const operationsOf = (contract: CommonPlayContract) => [...contract.entryPoints.flatMap((entry) => entry.operations), ...contract.interceptors.flatMap((item) => item.operations)];
const live = (operation: ContractOperation, scope: Scope) => !("when" in operation && operation.when) || evaluate((operation as { when?: Parameters<typeof evaluate>[0] }).when, scope) === true;

/**
 * The timed effect a contract starts, or nothing. Only `until-duration` gets a round counter — the other eight
 * lifetimes end on something this engine cannot see, so the sheet shows the reason instead of a countdown.
 */
export function contractDuration(contract: CommonPlayContract, scope: Scope): ParsedDuration | undefined {
  for (const operation of operationsOf(contract)) {
    if (operation.kind !== "effect.apply" || !live(operation, scope)) continue;
    const text = operation.template.duration ?? LIFETIME_KO[operation.lifetime] ?? operation.lifetime;
    const counted = operation.lifetime === COUNTED_LIFETIME;
    // The counter is whatever the contract states and nothing else: a duration with no `rounds` is one the table
    // watches (집중, 최대 1시간), and guessing a number from the text would start a countdown nobody asked for.
    const rounds = counted ? operation.template.rounds : undefined;
    return { text, instantaneous: false, concentration: Boolean(operation.template.concentration), ...(rounds === undefined ? {} : { rounds }) };
  }
  return undefined;
}

/** Effect keys a use ends on whoever it names (a new Wild Shape replacing the last one). */
export function contractRemovals(contract: CommonPlayContract, scope: Scope): string[] {
  return operationsOf(contract).filter((operation): operation is Extract<ContractOperation, { kind: "effect.remove" }> => operation.kind === "effect.remove" && live(operation, scope)).map((operation) => operation.selector);
}

/** Effects a use pauses, with the reason the sheet prints next to them. */
export function contractSuppressions(contract: CommonPlayContract, scope: Scope): Array<{ selector: string; suppressed: boolean; reason: string }> {
  return operationsOf(contract).filter((operation): operation is Extract<ContractOperation, { kind: "effect.suppress" }> => operation.kind === "effect.suppress" && live(operation, scope)).map((operation) => ({ selector: operation.selector, suppressed: operation.suppressed, reason: operation.reason }));
}

/** Does this key match a suppression selector? `*` covers everything, `spell:*` every spell. */
export function selectorMatches(selector: string, key: string) {
  if (selector === "*") return true;
  if (selector.endsWith(":*")) return key.startsWith(selector.slice(0, -1));
  return selector === key;
}

/** The duration source `featureActivation` takes: a lookup from feature rule key to the effect its contract starts. */
export const contractDurations = (catalog: { contractFor(key: string): CommonPlayContract | undefined }, scope: Scope) =>
  (ruleKey: string, label = ruleKey) => {
    const contract = featureContract(catalog, ruleKey);
    if (!contract) return undefined;
    // R41 (D181): a contract that only takes conditions off is still a reason for the feature to have a button.
    return { duration: contractDuration(contract, scope), use: contractUse(contract, scope, label), acts: !emptyOutcome(contractOutcome(contract, scope)) };
  };

/**
 * A feature's contract, whether it was written against the feature's rule key (`fighter.action-surge`, the kind
 * `class-feature-common-play` ships) or against its effect key (`feature:barbarian.rage`, the kind that says what the
 * effect it starts does). One feature, two ways of naming it, one lookup.
 */
export const featureContract = (catalog: { contractFor(key: string): CommonPlayContract | undefined }, ruleKey: string) =>
  catalog.contractFor(`feature:${ruleKey}`) ?? catalog.contractFor(ruleKey);

/**
 * R40 (D180): what a use costs and what it does to hit points, read from the contract's own operations. The shape is
 * the `FeatureActivation` the sheet already knows, so a contract can stand in for a row of `FEATURE_ACTIVATIONS`.
 */
export interface ContractUse {
  resourceId?: string;
  cost?: number;
  heal?: string;
  tempHp?: string;
  roll?: { label: string; formula: string };
  /** R49 (D184): the one-line reminder beside the button — what the hand-written row called `note`. */
  note?: string;
}

/** `1d10` + `{ref: actor.class-level:…}` becomes "1d10+5"; a bare number becomes "5"; dice alone stay "1d10". */
function formula(dice: string | undefined, amount: Parameters<typeof evaluate>[0], scope: Scope): string | undefined {
  const value = amount === undefined ? undefined : evaluate(amount, scope);
  const flat = typeof value === "number" ? value : undefined;
  if (!dice) return flat === undefined ? undefined : String(flat);
  if (!flat) return dice;
  return `${dice}${flat > 0 ? "+" : "-"}${Math.abs(flat)}`;
}

export function contractUse(contract: CommonPlayContract, scope: Scope, label: string): ContractUse | undefined {
  const use: ContractUse = {};
  let found = false;
  for (const operation of operationsOf(contract)) {
    if (!live(operation, scope)) continue;
    if (operation.kind === "resource.change") {
      const amount = evaluate(operation.amount, scope);
      const spent = typeof amount === "number" ? -amount : 0;
      // A negative amount spends the pool; a positive one gives it back, which a use never does to its own cost.
      if (spent > 0) { use.resourceId = operation.resourceId; if (spent > 1) use.cost = spent; found = true; }
      continue;
    }
    if (operation.kind === "healing.apply") { use.heal = formula(operation.dice, operation.amount, scope); found = true; continue; }
    if (operation.kind === "temp-hp.grant") { use.tempHp = formula(operation.dice, operation.amount, scope); found = true; continue; }
    if (operation.kind === "damage.apply") {
      const rolled = formula(operation.dice, operation.amount, scope);
      if (rolled) { use.roll = { label: `${label} 피해`, formula: rolled }; found = true; }
      continue;
    }
  }
  // The questions a contract asks the table are the reminder the sheet used to print from `note`; the turn panel
  // reads "추가 행동" out of it to know which features cost a bonus action.
  const questions = operationsOf(contract).filter((operation): operation is Extract<ContractOperation, { kind: "adjudication.request" }> => operation.kind === "adjudication.request" && live(operation, scope)).map((operation) => operation.question);
  if (questions.length) { use.note = questions.join(" · "); found = true; }
  return found ? use : undefined;
}

/**
 * R41 (D181): everything else a use does, worked out but not yet applied anywhere. The four groups are separated by
 * where they would land: a sheet (conditions, hit-point maximum, stabilising, standing up, granted content), the
 * table (movement, a question for the DM, artifacts on the board) and an NPC's own turn (a recharge roll).
 */
export interface ContractOutcome {
  conditionsRemoved: string[];
  hpMaximumDelta: number;
  stabilize: boolean;
  deathSave: boolean;
  stand: boolean;
  grants: string[];
  /** Lines for the card: movement and anything the table has to decide. */
  notes: string[];
  recharges: Array<{ resourceId: string; die: string; succeedsOn: number[] }>;
  artifacts: Array<{ kind: string; monsterId?: string; name?: string; count?: number; artifact?: string; amount?: number }>;
}

export function contractOutcome(contract: CommonPlayContract, scope: Scope): ContractOutcome {
  const out: ContractOutcome = { conditionsRemoved: [], hpMaximumDelta: 0, stabilize: false, deathSave: false, stand: false, grants: [], notes: [], recharges: [], artifacts: [] };
  const number = (expr: Parameters<typeof evaluate>[0], fallback = 0) => { const value = evaluate(expr, scope); return typeof value === "number" ? value : fallback; };
  for (const operation of operationsOf(contract)) {
    if (!live(operation, scope)) continue;
    switch (operation.kind) {
      case "condition.remove": out.conditionsRemoved.push(operation.condition); break;
      case "hp.maximum.change": out.hpMaximumDelta += number(operation.amount); break;
      case "life.stabilize": out.stabilize = true; break;
      case "life.death-save": out.deathSave = true; break;
      case "movement.stand": out.stand = true; break;
      case "content.grant": out.grants.push(operation.contentId); break;
      case "resource.recharge": out.recharges.push({ resourceId: operation.resourceId, die: operation.die, succeedsOn: operation.succeedsOn }); break;
      case "movement.relocate": out.notes.push(operation.note ?? `${operation.mode}${operation.distance ? ` ${number(operation.distance)}피트` : ""}`); break;
      case "movement.grant": out.notes.push(operation.note ?? `이동 ${number(operation.distance)}피트`); break;
      case "adjudication.request": out.notes.push(operation.question); break;
      case "artifact.spawn": out.artifacts.push({ kind: operation.kind, monsterId: operation.template.monsterId, name: operation.template.name, count: operation.template.count ? number(operation.template.count, 1) : 1 }); break;
      case "artifact.damage": case "artifact.repair": case "artifact.relocate": case "artifact.update": case "artifact.remove":
        out.artifacts.push({ kind: operation.kind, artifact: operation.artifact, amount: operation.amount ? number(operation.amount) : undefined }); break;
      default: break;
    }
  }
  return out;
}

/** Nothing to do: the contract asked for none of these. */
export const emptyOutcome = (outcome: ContractOutcome) =>
  !outcome.conditionsRemoved.length && !outcome.hpMaximumDelta && !outcome.stabilize && !outcome.deathSave && !outcome.stand && !outcome.grants.length && !outcome.notes.length && !outcome.recharges.length && !outcome.artifacts.length;
