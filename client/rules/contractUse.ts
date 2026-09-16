/**
 * R35 (D174): the bridge between a character sheet and its contracts.
 *
 * The host does not own a catalog — every sheet-shaped question reaches it through an injected function. These are
 * the two the contract rescues need: which contracts this sheet could pay for a d20 that went this way, and what
 * paying one does to its runtime. Both read the catalog, so they live here rather than in the host.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { JournalCharacter } from "../campaign/journal";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedCharacter } from "../character/types";
import { featureRuleKey } from "./activation";
import { characterScope, interceptorsFor, type ContractInterceptor, type ContractPayment, type Scope } from "./contract";

export type RollFamily = "ability-check" | "saving-throw" | "attack-roll";

/** One offer: the feature's name, the interceptor that would fire, what it costs, and the values its numbers read. */
export interface RescueOffer {
  feature: string;
  ruleKey: string;
  interceptor: ContractInterceptor;
  payments: ContractPayment[];
  scope: Scope;
}

const poolLeft = (derived: DerivedCharacter, runtime: CharacterRuntime, resourceId: string) => {
  const pool = derived.resources.find((resource) => resource.id === resourceId);
  return pool ? pool.max - (runtime.resourcesUsed[pool.id] ?? 0) : 0;
};

/**
 * The rescues this sheet can offer for a d20 of `family` that came out `outcome`. A contract whose pool is empty is
 * not offered at all — the player is never shown a button that would be refused.
 */
export function pcRescues(entry: JournalCharacter, derived: DerivedCharacter, catalog: ContentCatalog, family: RollFamily, outcome: "success" | "failure"): RescueOffer[] {
  const offers: RescueOffer[] = [];
  for (const feature of derived.features) {
    const ruleKey = featureRuleKey(feature.id);
    const contract = catalog.contractFor(ruleKey);
    if (!contract) continue;
    const matching = interceptorsFor(contract, "d20.outcome-determined", family, outcome).filter((item) => item.slot === "d20.roll" && item.operations.some((operation) => operation.kind === "roll.modify"));
    if (!matching.length) continue;
    // Facts about where everyone is standing cannot be answered here, so those interceptors stay the table's call.
    if (contract.unsupported.length) continue;
    const payable = contract.payments.every((payment) => payment.kind !== "resource" || !payment.resourceId || poolLeft(derived, entry.runtime, payment.resourceId) > 0);
    if (!payable) continue;
    offers.push({ feature: feature.name, ruleKey, interceptor: matching[0], payments: contract.payments, scope: characterScope(derived) });
  }
  return offers;
}

/**
 * Spend a contract's payments on the sheet. `onlyOn` payments are kept only when the roll went that way, which is
 * how 전술적 사고 and 탁월한 기술 charge nothing for a rescue that did not work. Null when a pool cannot pay.
 */
export function payContract(runtime: CharacterRuntime, derived: DerivedCharacter, payments: ContractPayment[], outcome: "success" | "failure"): CharacterRuntime | null {
  let next = runtime;
  for (const payment of payments) {
    if (payment.kind !== "resource" || !payment.resourceId) continue;
    if (payment.onlyOn && payment.onlyOn !== outcome) continue;
    const pool = derived.resources.find((resource) => resource.id === payment.resourceId);
    if (!pool) continue;
    const used = (next.resourcesUsed[pool.id] ?? 0) + payment.amount;
    if (used > pool.max) return null;
    next = { ...next, resourcesUsed: { ...next.resourcesUsed, [pool.id]: used } };
  }
  return next;
}
