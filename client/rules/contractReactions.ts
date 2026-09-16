/**
 * R54 (ROLL20_TABLE_SPEC.md D189): the reaction windows the content declares for itself.
 *
 * `ReactionPrompt.kind` was a closed list — opportunity, shield, counterspell, death-save, rescue — so the only
 * reactions a player was ever offered were the ones the host hardcoded. Everything else (몽크의 공격 비껴내기,
 * 방어적 결투가의 받아넘기기, 가로막기, 방패 끼어들기) had to be declared out loud and worked out by hand.
 *
 * An interceptor timed `reaction.window` names the moment it wants (`trigger`) and what it does when taken. Two
 * things are mechanical: raising AC against the attack that just landed (the Shield spell's shape, re-resolved with
 * the same dice) and reducing the damage it deals. Anything else the contract says travels as a line for the table.
 *
 * What a scene cannot see stays out: a reaction that depends on standing within 5 feet of an ally has no trigger
 * here, because the app has no positions to check it against (D109).
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedCharacter } from "../character/types";
import { characterScope, evaluate, type ContractPayment, type Scope } from "./contract";
import { featureRuleKey } from "./activation";
import { featureContract } from "./contractActivation";

/**
 * The moments this engine can actually open a window at. `attack.hit-ally` is R57's (D192) addition: the swing landed
 * on somebody else, and a bystander's contract wants to answer it. Whether they are close enough is a fact the
 * bystander confirms, because the scene has no positions to check it against (D109).
 */
export const REACTION_TRIGGERS = ["attack.hit-self", "attack.hit-ally"] as const;
export type ReactionTrigger = (typeof REACTION_TRIGGERS)[number];

export interface GuardOffer {
  /** The feature's name, which is what the player clicks and what the card says. */
  feature: string;
  ruleKey: string;
  /** AC this reaction adds against the attack that just landed; the attack is resolved again with the same dice. */
  acBonus?: number;
  /** Damage it takes off, as a formula the host rolls ("1d10+8"). */
  reduce?: string;
  /** R57 (D192): facts those two numbers wait on — unticked, the reaction does nothing but say its line. */
  acBonusFact?: string;
  reduceFact?: string;
  /** What the contract says that is not a number. */
  notes: string[];
  /** R57 (D192): facts the reactor confirms as they take it; anything gated on one waits for the tick. */
  facts: Array<{ id: string; question: string }>;
  payments: ContractPayment[];
  scope: Scope;
}

const poolLeft = (derived: DerivedCharacter, runtime: CharacterRuntime, resourceId: string) => {
  const resource = derived.resources.find((item) => item.id === resourceId);
  return resource ? resource.max - (runtime.resourcesUsed[resourceId] ?? 0) : 0;
};

/** Every reaction this character's contracts offer at this moment, that they can still pay for. */
export function pcGuards(entry: { runtime: CharacterRuntime }, derived: DerivedCharacter, catalog: ContentCatalog, trigger: ReactionTrigger): GuardOffer[] {
  const scope = characterScope(derived);
  const offers: GuardOffer[] = [];
  const seen = new Set<string>();
  for (const feature of derived.features) {
    const ruleKey = featureRuleKey(feature.id);
    if (seen.has(ruleKey)) continue;
    seen.add(ruleKey);
    const contract = featureContract(catalog, ruleKey);
    if (!contract || contract.unsupported.length) continue;
    for (const item of contract.interceptors) {
      if (item.timing !== "reaction.window" || item.trigger !== trigger) continue;
      if (item.when && evaluate(item.when, scope) !== true) continue;
      const offer: GuardOffer = { feature: feature.name, ruleKey, notes: [], facts: [], payments: contract.payments, scope };
      // R57 (D192): a fact this window declares is a checkbox on the prompt; what depends on it waits for the answer.
      const declared = new Set(item.operations.flatMap((operation) => (operation.kind === "adjudication.request" && operation.fact?.at === "reaction" ? [`fact:${operation.fact.id}`] : [])));
      const gatedBy = (operation: { when?: unknown }) => { const ref = operation.when && typeof operation.when === "object" && "ref" in operation.when ? String((operation.when as { ref: string }).ref) : ""; return declared.has(ref) ? ref.slice(5) : undefined; };
      for (const operation of item.operations) {
        const factId = gatedBy(operation as { when?: unknown });
        if (!factId && "when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
        if (operation.kind === "property.modify" && operation.property === "ac.bonus") {
          const value = Number(evaluate(operation.value, scope));
          if (Number.isFinite(value)) { offer.acBonus = (offer.acBonus ?? 0) + value; if (factId) offer.acBonusFact = factId; }
        } else if (operation.kind === "property.modify" && operation.property === "damage-taken.reduce") {
          const flat = Number(evaluate(operation.value, scope));
          const parts = [operation.dice, Number.isFinite(flat) && flat ? `${flat > 0 ? "+" : ""}${flat}` : ""].filter(Boolean);
          if (parts.length) { offer.reduce = parts.join(""); if (factId) offer.reduceFact = factId; }
        } else if (operation.kind === "adjudication.request") {
          if (operation.fact?.at === "reaction") offer.facts.push({ id: operation.fact.id, question: operation.question });
          else offer.notes.push(operation.question);
        }
      }
      if (offer.acBonus === undefined && !offer.reduce && !offer.notes.length && !offer.facts.length) continue;
      const payable = offer.payments.every((payment) => payment.kind !== "resource" || !payment.resourceId || poolLeft(derived, entry.runtime, payment.resourceId) > 0);
      if (payable) offers.push(offer);
    }
  }
  return offers;
}

/** One line for the prompt, so the player can choose without opening their sheet. */
export const guardHint = (offer: GuardOffer) =>
  [offer.acBonus ? `AC +${offer.acBonus}` : "", offer.reduce ? `피해 −${offer.reduce}` : "", ...offer.notes, ...offer.facts.map((fact) => fact.question)].filter(Boolean).join(" · ");

/** Roll a plain `NdX+M` formula with the host's own roller, so a reaction's number is as reproducible as any other. */
export function rollGuard(formula: string, random: () => number): number {
  let total = 0;
  for (const term of formula.replace(/\s+/g, "").match(/[+-]?[^+-]+/g) ?? []) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const die = /^(\d*)d(\d+)$/.exec(body);
    if (die) { const count = Number(die[1] || 1); for (let at = 0; at < count; at += 1) total += sign * (1 + Math.floor(random() * Number(die[2]))); }
    else if (/^\d+$/.test(body)) total += sign * Number(body);
  }
  return Math.max(0, total);
}
