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
  (ruleKey: string, label = ruleKey) => { const contract = featureContract(catalog, ruleKey); return contract ? { duration: contractDuration(contract, scope), use: contractUse(contract, scope, label) } : undefined; };

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
  return found ? use : undefined;
}
