/**
 * R34 (D171): the common-play contract executor.
 *
 * `content/**` ships a declarative contract next to some features (`mechanics.kind === "common-play"`): what a use
 * costs (`payments`), what pressing its button does (`entryPoints`), and what it may do to somebody else's roll
 * (`interceptors`). Until now the new client imported those modules and never read the contracts — the features were
 * hand-written in `activation.ts` and `effects.ts` instead, and the two could disagree without anyone noticing.
 *
 * This module is the reader. It is deliberately strict: anything in a contract this executor cannot run is collected
 * in `unsupported` rather than skipped quietly, so "the module works" is a measured claim and the gap has a name.
 * Nothing here touches a session or a character — it takes a scope of named values and returns what should happen.
 */

/** A value expression: a literal, a named reference, or an operator over more expressions. */
export type Expr = { value: unknown } | { ref: string } | { op: string; args?: Expr[]; left?: Expr; right?: Expr };

export type ExprValue = number | string | boolean | undefined;
/** Where `{ ref: "proficiency.bonus" }` and the like get their values. */
export type Scope = (ref: string) => ExprValue;

const isExpr = (value: unknown): value is Expr => typeof value === "object" && value !== null && ("value" in value || "ref" in value || "op" in value);
const numeric = (value: ExprValue) => (typeof value === "number" ? value : typeof value === "boolean" ? Number(value) : Number.NaN);

/** Operators the contracts use, plus the obvious completions of each family. An unknown operator evaluates to undefined. */
export function evaluate(expr: Expr | undefined, scope: Scope): ExprValue {
  if (!expr) return undefined;
  if ("value" in expr) return expr.value as ExprValue;
  if ("ref" in expr) return scope(expr.ref);
  const args = (expr.args ?? []).map((item) => evaluate(item, scope));
  const left = "left" in expr ? evaluate(expr.left, scope) : args[0];
  const right = "right" in expr ? evaluate(expr.right, scope) : args[1];
  switch (expr.op) {
    case "add": return args.reduce<number>((sum, value) => sum + numeric(value), 0);
    case "sub": return numeric(left) - numeric(right);
    case "mul": return args.reduce<number>((product, value) => product * numeric(value), 1);
    case "min": return Math.min(...args.map(numeric));
    case "max": return Math.max(...args.map(numeric));
    case "eq": return left === right;
    case "ne": return left !== right;
    case "lt": return numeric(left) < numeric(right);
    case "lte": return numeric(left) <= numeric(right);
    case "gt": return numeric(left) > numeric(right);
    case "gte": return numeric(left) >= numeric(right);
    case "all": return args.every((value) => value === true);
    case "any": return args.some((value) => value === true);
    case "not": return left !== true;
    default: return undefined;
  }
}

/** A pool or an action-economy bucket a use costs. `onlyOn` is a payment that is kept only when the roll went that way. */
export interface ContractPayment {
  kind: "resource" | "economy";
  /** `resource:fighter.second-wind` becomes the client's `resource.fighter.second-wind`. */
  resourceId?: string;
  bucket?: string;
  amount: number;
  consumeAt: string;
  onlyOn?: "success" | "failure";
  refundOnCancel: boolean;
  actionKind?: string;
}

export type ContractOperation =
  | { kind: "economy.modify"; bucket: string; amount: Expr }
  | { kind: "condition.apply"; condition: string; target: string; when?: Expr }
  | { kind: "healing.apply"; amount: Expr; target: string; when?: Expr }
  | { kind: "roll.modify"; mode: string; dice?: string; value?: Expr; diceResourceId?: string; when?: Expr };

/** The saving throw an entry point forces before its operations run. */
export interface ContractTest {
  kind: "saving-throw";
  roller: string;
  /** The properties the roller may pick between (`save.str.modifier`, `save.dex.modifier`) and how. */
  properties: string[];
  choose: "highest" | "lowest";
  dc: Expr;
  perTarget: boolean;
}

export interface ContractEntryPoint {
  id: string;
  invocation: string;
  targeting?: { from: string; min: number; max: number };
  test?: ContractTest;
  operations: ContractOperation[];
}

export interface ContractInterceptor {
  id: string;
  timing: string;
  slot: string;
  /** Which kinds of d20 roll this may touch; empty means every kind at that timing. */
  families: string[];
  /** Which outcomes it may touch (`failure` for a rescue, `success` for Cutting Words); empty means either. */
  outcomes: string[];
  /** The owner is asked before it fires. */
  asks: boolean;
  /** Facts about the table this executor cannot answer (distance, line of sight); named, never guessed. */
  factQueries: Array<{ id: string; fact: string; unknownPolicy: string }>;
  when?: Expr;
  operations: ContractOperation[];
}

export interface CommonPlayContract {
  /** The contract's own id (`fighter.indomitable`, `feature.fighter.action-surge`). */
  id: string;
  /** That id as a feature rule key, so `featureRuleKey(feature.id)` finds it. */
  ruleKey: string;
  /** The catalog entry the contract was attached to. */
  entryId: string;
  payments: ContractPayment[];
  entryPoints: ContractEntryPoint[];
  interceptors: ContractInterceptor[];
  /** Everything in the source this executor does not run, by path. Empty means the contract runs whole. */
  unsupported: string[];
}

/** `resource:fighter.second-wind` → `resource.fighter.second-wind`; anything else is passed through. */
export const resourceIdOf = (reference: string) => (reference.startsWith("resource:") ? `resource.${reference.slice("resource:".length)}` : reference);

/** A contract id as a feature rule key: `feature.` and `dnd.<x>.feature.` prefixes come off, everything else stands. */
export function contractRuleKey(id: string) {
  const namespaced = /^dnd\.[a-z0-9]+\.feature\.(.+)$/.exec(id);
  if (namespaced) return namespaced[1];
  if (id.startsWith("feature.")) return id.slice("feature.".length);
  return id;
}

/** Facts this engine can answer about a roll it is intercepting; anything else the table has to decide. */
export const KNOWN_FACTS = new Set(["attack.weapon.ranged", "attack.weapon.melee"]);

/**
 * R36 (D176): the two numbers the plan (§14.1) is scored on. `COMPUTED` are the operation kinds this executor turns
 * into a value; `APPLIED` are the ones a call site actually carries to the table. They are deliberately separate —
 * an operation the executor understands but nobody applies changes nothing, and saying otherwise would be a lie.
 */
export const COMPUTED_OPERATIONS = ["economy.modify", "condition.apply", "healing.apply", "roll.modify"] as const;
export const APPLIED_OPERATIONS = ["economy.modify", "roll.modify"] as const;

const OPERATION_KINDS = new Set<string>(COMPUTED_OPERATIONS);
const ROLL_MODES = new Set(["add-die", "add-flat", "reroll", "subtract-die"]);

function parseOperations(raw: unknown, path: string, unsupported: string[]): ContractOperation[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: ContractOperation[] = [];
  list.forEach((item, index) => {
    const operation = item as Record<string, unknown>;
    const kind = String(operation.kind ?? "");
    const at = `${path}[${index}]`;
    if (!OPERATION_KINDS.has(kind)) { unsupported.push(`${at}: ${kind || "이름 없는 연산"}`); return; }
    if (kind === "economy.modify") { out.push({ kind, bucket: String(operation.bucket ?? ""), amount: (operation.amount as Expr) ?? { value: 0 } }); return; }
    if (kind === "condition.apply") { out.push({ kind, condition: String(operation.condition ?? ""), target: String(operation.target ?? "target"), when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "healing.apply") { out.push({ kind, amount: (operation.amount as Expr) ?? { value: 0 }, target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined }); return; }
    const mode = String(operation.mode ?? "");
    if (!ROLL_MODES.has(mode)) { unsupported.push(`${at}: roll.modify ${mode || "모드 없음"}`); return; }
    out.push({ kind: "roll.modify", mode, dice: operation.dice ? String(operation.dice) : undefined, value: isExpr(operation.value) ? operation.value : undefined, diceResourceId: operation.diceResource ? resourceIdOf(String(operation.diceResource)) : undefined, when: isExpr(operation.when) ? operation.when : undefined });
  });
  return out;
}

/** Read a `common-play` mechanic config into a contract, naming every part this executor cannot run. */
export function parseContract(config: Record<string, unknown>, entryId: string): CommonPlayContract {
  const unsupported: string[] = [];
  const id = String(config.id ?? entryId);
  const payments: ContractPayment[] = [];
  for (const [index, item] of (Array.isArray(config.payments) ? config.payments : []).entries()) {
    const payment = item as Record<string, unknown>;
    const kind = payment.kind === "economy" ? "economy" : payment.kind === "resource" ? "resource" : null;
    if (!kind) { unsupported.push(`payments[${index}]: ${String(payment.kind)}`); continue; }
    const condition = payment.condition as { kind?: string; outcome?: string } | undefined;
    if (condition && condition.kind !== "d20-result") unsupported.push(`payments[${index}].condition: ${String(condition.kind)}`);
    const amount = (payment.amount as { value?: number } | undefined)?.value;
    if (typeof amount !== "number") { unsupported.push(`payments[${index}].amount: 고정 숫자가 아닙니다`); continue; }
    payments.push({
      kind, amount, consumeAt: String(payment.consumeAt ?? "commit"),
      ...(kind === "resource" ? { resourceId: resourceIdOf(String(payment.resource ?? "")) } : { bucket: String(payment.bucket ?? "") }),
      ...(condition?.kind === "d20-result" && (condition.outcome === "success" || condition.outcome === "failure") ? { onlyOn: condition.outcome } : {}),
      refundOnCancel: payment.refundOnCancel === true,
      ...(payment.actionKind ? { actionKind: String(payment.actionKind) } : {}),
    });
  }
  const entryPoints: ContractEntryPoint[] = [];
  for (const [index, item] of (Array.isArray(config.entryPoints) ? config.entryPoints : []).entries()) {
    const entry = item as Record<string, unknown>;
    const invocation = String(entry.invocation ?? "manual");
    if (invocation !== "manual") unsupported.push(`entryPoints[${index}].invocation: ${invocation}`);
    let test: ContractTest | undefined;
    const rawTest = entry.test as Record<string, unknown> | undefined;
    if (rawTest) {
      if (rawTest.kind !== "saving-throw") unsupported.push(`entryPoints[${index}].test: ${String(rawTest.kind)}`);
      else {
        const property = rawTest.property as { choose?: string; from?: string[] } | string | undefined;
        const properties = typeof property === "string" ? [property] : (property?.from ?? []);
        const choose = typeof property === "object" && property?.choose === "lowest" ? "lowest" : "highest";
        test = { kind: "saving-throw", roller: String(rawTest.roller ?? "target"), properties, choose, dc: (rawTest.dc as Expr) ?? { value: 10 }, perTarget: rawTest.perTarget === true };
      }
    }
    const targeting = entry.targeting as { from?: string; min?: number; max?: number } | undefined;
    entryPoints.push({
      id: String(entry.id ?? `entry${index}`), invocation,
      ...(targeting ? { targeting: { from: String(targeting.from ?? "targets"), min: targeting.min ?? 1, max: targeting.max ?? 1 } } : {}),
      ...(test ? { test } : {}),
      operations: parseOperations(entry.operations, `entryPoints[${index}].operations`, unsupported),
    });
  }
  const interceptors: ContractInterceptor[] = [];
  for (const [index, item] of (Array.isArray(config.interceptors) ? config.interceptors : []).entries()) {
    const raw = item as Record<string, unknown>;
    const factQueries = (Array.isArray(raw.factQueries) ? raw.factQueries : []).map((query) => {
      const fact = query as Record<string, unknown>;
      return { id: String(fact.id ?? ""), fact: String(fact.fact ?? ""), unknownPolicy: String(fact.unknownPolicy ?? "block") };
    });
    // A fact about where everyone is standing cannot be answered on a scene without positions; the table decides it.
    // Facts the app does know (what kind of weapon swung) are not gaps and are not listed as such.
    for (const query of factQueries) if (!KNOWN_FACTS.has(query.fact)) unsupported.push(`interceptors[${index}].factQueries.${query.id}: ${query.fact}`);
    interceptors.push({
      id: String(raw.id ?? `interceptor${index}`), timing: String(raw.timing ?? ""), slot: String(raw.slot ?? ""),
      families: (Array.isArray(raw.families) ? raw.families : []).map(String),
      outcomes: (Array.isArray(raw.outcomes) ? raw.outcomes : []).map(String),
      asks: Boolean(raw.interaction), factQueries,
      when: isExpr(raw.when) ? raw.when : undefined,
      operations: parseOperations(raw.operations, `interceptors[${index}].operations`, unsupported),
    });
  }
  for (const key of Object.keys(config)) {
    if (["$schema", "schemaVersion", "id", "payments", "entryPoints", "interceptors"].includes(key)) continue;
    unsupported.push(`${key}: 이 실행기가 읽지 않는 항목`);
  }
  return { id, ruleKey: contractRuleKey(id), entryId, payments, entryPoints, interceptors, unsupported };
}

/** What a use of a contract does once its scope is known: pools to spend and effects to apply. */
export interface ContractEffectEconomy { kind: "economy"; bucket: string; amount: number }
export interface ContractEffectCondition { kind: "condition"; condition: string; target: string }
export interface ContractEffectHeal { kind: "heal"; amount: number; target: string }
export type ContractEffect = ContractEffectEconomy | ContractEffectCondition | ContractEffectHeal;

/** The operations of one entry point, with `when` evaluated and the numbers worked out. */
export function runEntryPoint(contract: CommonPlayContract, entryId: string, scope: Scope): { effects: ContractEffect[]; test?: ContractTest; testDc?: number } | null {
  const entry = contract.entryPoints.find((item) => item.id === entryId) ?? contract.entryPoints[0];
  if (!entry) return null;
  const effects: ContractEffect[] = [];
  for (const operation of entry.operations) {
    if (operation.kind === "roll.modify") continue;
    if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
    if (operation.kind === "economy.modify") effects.push({ kind: "economy", bucket: operation.bucket, amount: numeric(evaluate(operation.amount, scope)) || 0 });
    else if (operation.kind === "condition.apply") effects.push({ kind: "condition", condition: operation.condition, target: operation.target });
    else effects.push({ kind: "heal", amount: numeric(evaluate(operation.amount, scope)) || 0, target: operation.target });
  }
  return { effects, ...(entry.test ? { test: entry.test, testDc: numeric(evaluate(entry.test.dc, scope)) || 0 } : {}) };
}

/** The interceptors that could fire on a roll of this family and outcome, ignoring facts the table has to supply. */
export function interceptorsFor(contract: CommonPlayContract, timing: string, family: string, outcome: "success" | "failure") {
  return contract.interceptors.filter((item) => item.timing === timing && (!item.families.length || item.families.includes(family)) && (!item.outcomes.length || item.outcomes.includes(outcome)));
}

/** Which turn bucket a contract's economy name refers to, or nothing when this engine does not track it. */
export function economyBucketOf(bucket: string): "action" | "bonus" | "reaction" | null {
  const head = bucket.split(".")[0];
  if (head === "action") return "action";
  if (head === "bonus" || bucket.startsWith("bonus-action")) return "bonus";
  if (head === "reaction") return "reaction";
  return null;
}

/** The shape `characterScope` needs — written structurally so this module stays free of the character engine. */
export interface ScopeCharacter {
  proficiencyBonus: number;
  abilities: Record<string, { modifier: number }>;
  saves: Record<string, { bonus: number }>;
  classes: Array<{ classId: string; level: number }>;
}

/**
 * The named values a contract may read off a character: `proficiency.bonus`, `ability.str.modifier`,
 * `save.dex.modifier`, `actor.class-level:<classId>`. `extra` carries what only the moment knows (`test.outcome`).
 */
export function characterScope(character: ScopeCharacter, extra: Record<string, ExprValue> = {}): Scope {
  return (ref) => {
    if (ref in extra) return extra[ref];
    if (ref === "proficiency.bonus") return character.proficiencyBonus;
    const ability = /^ability\.([a-z]{3})\.modifier$/.exec(ref);
    if (ability) return character.abilities[ability[1]]?.modifier;
    const save = /^save\.([a-z]{3})\.modifier$/.exec(ref);
    if (save) return character.saves[save[1]]?.bonus;
    const level = /^actor\.class-level:(.+)$/.exec(ref);
    if (level) return character.classes.find((entry) => entry.classId === level[1])?.level ?? 0;
    return undefined;
  };
}

/** R35 (D174): what a contract's `roll.modify` operations do to one d20 once the dice have spoken. */
export interface RollModifyPlan {
  /** A fresh d20 replaces the first one (불굴). */
  d20?: number;
  /** Added to the total (extra dice, flat bonuses); negative for `subtract-die`. */
  delta: number;
  /** One phrase per operation, for the card ("1d20 재굴림 → 14", "+1d10 = 7"). */
  parts: string[];
}

/**
 * Work out an interceptor's effect on a roll. `dice.d(sides)` is the host's own roller, so the result is as
 * reproducible as everything else it rolls; `poolDie` answers `subtract-die`'s `diceResource` (the bard's
 * inspiration die), which this engine does not track yet and which therefore contributes nothing rather than a guess.
 */
export function planRollModify(operations: ContractOperation[], scope: Scope, dice: { d: (sides: number) => number }, poolDie?: (resourceId: string) => number | undefined): RollModifyPlan {
  const plan: RollModifyPlan = { delta: 0, parts: [] };
  const rollDice = (formula: string) => {
    const match = /^(\d*)d(\d+)$/.exec(formula.trim());
    if (!match) return null;
    const count = Number(match[1] || 1);
    const sides = Number(match[2]);
    let total = 0;
    for (let index = 0; index < count; index += 1) total += dice.d(sides);
    return { total, sides, count };
  };
  for (const operation of operations) {
    if (operation.kind !== "roll.modify") continue;
    if (operation.when && evaluate(operation.when, scope) !== true) continue;
    switch (operation.mode) {
      case "reroll": {
        const rolled = rollDice(operation.dice ?? "1d20");
        if (!rolled) break;
        plan.d20 = rolled.total;
        plan.parts.push(`${operation.dice ?? "1d20"} 재굴림 → ${rolled.total}`);
        break;
      }
      case "add-die": {
        const rolled = rollDice(operation.dice ?? "");
        if (!rolled) break;
        plan.delta += rolled.total;
        plan.parts.push(`+${operation.dice} = ${rolled.total}`);
        break;
      }
      case "subtract-die": {
        const sides = operation.dice ? rollDice(operation.dice)?.total : operation.diceResourceId ? poolDie?.(operation.diceResourceId) : undefined;
        if (sides === undefined) break;
        plan.delta -= sides;
        plan.parts.push(`−${sides}`);
        break;
      }
      case "add-flat": {
        const value = Number(evaluate(operation.value, scope));
        if (!Number.isFinite(value)) break;
        plan.delta += value;
        plan.parts.push(`${value >= 0 ? "+" : ""}${value}`);
        break;
      }
      default: break;
    }
  }
  return plan;
}
