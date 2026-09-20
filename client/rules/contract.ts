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
import { CONDITION_KO } from "../compendium/spells";

/** A value expression: a literal, a named reference, or an operator over more expressions. */
export type Expr = { value: unknown } | { ref: string } | { op: string; args?: Expr[]; left?: Expr; right?: Expr };

export type ExprValue = number | string | boolean | undefined;
/** Where `{ ref: "proficiency.bonus" }` and the like get their values. */
export type Scope = (ref: string) => ExprValue;

/**
 * D307: a contract may name a condition by its English id (`charmed`, what MODULE_GRAMMAR asks for) or by the name a
 * sheet and a token carry (`매혹`). Every reader downstream compares names, so the id becomes the name once, here.
 */
const conditionName = (raw: unknown) => { const id = String(raw ?? ""); return CONDITION_KO[id] ?? id; };
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
    // R78 (D213): "half your wizard level, rounded up" and "half your sorcerer level, rounded down".
    case "floor-div": return Math.floor(numeric(left) / numeric(right));
    case "ceil-div": return Math.ceil(numeric(left) / numeric(right));
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
    // R49 (D184): the one primitive the SRD's "by level" tables need — 격노's +2/+3/+4 is two of these nested.
    case "if": return args[0] === true ? args[1] : args[2];
    default: return undefined;
  }
}

/** A pool or an action-economy bucket a use costs. `onlyOn` is a payment that is kept only when the roll went that way. */
export interface ContractPayment {
  /** V4d (D266): `effect` — the effect that granted a rescue ends when it is used (바드의 영감); never written in a contract. */
  kind: "resource" | "economy" | "effect";
  effectKey?: string;
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
  | { kind: "economy.modify"; bucket: string; amount: Expr; when?: Expr }
  | { kind: "condition.apply"; condition: string; target: string; when?: Expr; /** R94 (D229): resisted with this save (기절 타격). */ save?: { ability: string; dc: Expr }; /** V4b (D264): how long it lasts (default: until the start of the source's next turn). */ duration?: ConditionDuration; /** V4b (D264): the bearer repeats the save at the end of each of its turns. */ repeatSave?: "turn-end"; /** V4b (D264): what a successful save still leaves on the target (충격의 일격). */ successMark?: TargetMark }
  | { kind: "healing.apply"; dice?: string; /** D300: the dice an expression decides (바드의 영감 주사위로 주는 회복). */ diceCount?: Expr; diceSides?: Expr; amount?: Expr; target: string; when?: Expr; /** V4a (D263): one amount shared out among the chosen creatures, none past half its maximum (생명 보존). */ pool?: "half-max"; /** D324: spend this many of the sheet's Hit Point Dice and heal by what they roll plus Constitution (생명 흡수자). */ hitDice?: number }
  | { kind: "roll.modify"; mode: string; dice?: string; /** V4l (D274): the die size an expression decides (바드의 영감 주사위: 레벨별 d6~d12). */ diceSides?: Expr; value?: Expr; diceResourceId?: string; when?: Expr }
  /**
   * R38 (D178): the general modifier. `property` names what changes in this engine's vocabulary (`ac.bonus`,
   * `attack-roll.bonus`, `speed.walk`…), `operation` how (`add`, `set`, `multiply`, `minimum`), and `value` or `dice`
   * by how much. `scope` narrows it to some attacks, `abilities` to some saves, and `note` carries the part of the
   * rule that is not a number.
   */
  | { kind: "property.modify"; property: string; operation: string; value?: Expr; /** H2 (D239): the spell a property is about (`marked-spell.die`), as a content id in the data. */ spell?: string; /** H2 (D239): the spell school a property is about. */ school?: string; /** H3 (D240): the named parameters of a gain-time property (`choice.skills` and its kin). */ params?: Record<string, unknown>; dice?: string; /** D302: the die size an expression decides, where a property rolls dice (보호장의 사이오닉 주사위). */ diceSides?: Expr; scope?: string; abilities?: string[]; /** R51 (D186): the damage types a `damage-taken.reduce` applies to. */ damageTypes?: string[]; note?: string; when?: Expr }
  /**
   * R39 (D179): the standing effect a use starts. `template` carries what the sheet needs to show and count it;
   * `lifetime` says how it ends — `until-duration` is the only one with a round counter, the rest are conditions the
   * table or another rule decides, and the sheet prints the reason instead of a number.
   */
  | { kind: "effect.apply"; template: { key?: string; name?: string; duration?: string; rounds?: number; concentration?: boolean; /** V3e (D259): the effect ends when its bearer makes this roll (안정된 조준: its next attack). */ consumeOn?: "attack" | "cast" | "attack-or-cast"; /** V4d (D266): the bearer may add this die to one failed d20 test, which ends the effect (바드의 영감). */ rescueDie?: Expr }; lifetime: string; target: string; when?: Expr }
  /** R39 (D179): end an effect by key — a new Wild Shape replacing the last one. */
  | { kind: "effect.remove"; selector: string; target: string; when?: Expr }
  /** R39 (D179): pause an effect without ending it (an antimagic field); the sheet shows it, greyed, with the reason. */
  | { kind: "effect.suppress"; selector: string; suppressed: boolean; reason: string; when?: Expr }
  /**
   * R40 (D180): the pool a use spends or gives back. A negative `amount` spends; `resource` is the client's pool id.
   */
  | { kind: "resource.change"; resourceId: string; amount: Expr; target: string; when?: Expr; /** V4c (D265): give uses back until this many are left (지속되는 격노, 완벽한 집중). */ upTo?: boolean; /** V4j (D272): the spell slot level a reserved slot resource spends or gives back (마법의 샘의 교환). */ level?: number }
  /** R40 (D180): dice rolled and applied as healing or temporary hit points; `dice` and `amount` add up to the formula. */
  | { kind: "temp-hp.grant"; dice?: string; /** D300: the dice an expression decides (영감의 외투: 바드의 영감 주사위 두 배). */ diceCount?: Expr; diceSides?: Expr; amount?: Expr; target: string; when?: Expr }
  /** R40 (D180): dice rolled and logged as damage a feature deals (Breath Weapon), without choosing who takes it. */
  | { kind: "damage.apply"; dice?: string; /** R52 (D187): how many of `dice` to roll, when a level table decides it (광란's 격노 피해 보너스만큼의 d6). */ diceCount?: Expr; /** V4a (D263): the die size, when an expression decides it (a marked spell's die). */ diceSides?: Expr; amount?: Expr; damageType: string; target: string; when?: Expr; /** V4a (D263): the targets save against it; a success halves it or takes it all away. */ save?: { ability: string; dc: Expr; success: "half" | "none" } }
  /** R41 (D181): the last of the vocabulary — the rest of what a contract may ask this engine to do. */
  | { kind: "condition.remove"; condition: string; target: string; when?: Expr }
  | { kind: "hp.maximum.change"; amount: Expr; target: string; when?: Expr }
  | { kind: "life.stabilize"; target: string; when?: Expr }
  | { kind: "life.death-save"; when?: Expr }
  | { kind: "resource.recharge"; resourceId: string; die: string; succeedsOn: number[]; /** D324: the die must come up exactly this (주문 회상의 은총: the slot level it was cast with). */ succeedsOnValue?: Expr; when?: Expr }
  | { kind: "movement.stand"; target: string; when?: Expr }
  | { kind: "movement.relocate"; mode: string; target: string; distance?: Expr; note?: string; when?: Expr }
  | { kind: "movement.grant"; target: string; distance: Expr; note?: string; when?: Expr }
  | { kind: "content.grant"; contentId: string; target: string; when?: Expr }
  /**
   * R57 (D192): a question for the table. With `fact` it stops being prose and becomes a **checkbox**: the app asks
   * it at the moment named (`pre-roll`, `reaction`), and the operations written `when: {ref: "fact:<id>"}` run only
   * if the player ticked it. That is how a rule gated on where people are standing runs in a scene with no
   * positions (D109) — the app does every number, the person answers the one fact it cannot see.
   */
  | { kind: "adjudication.request"; question: string; /** V4a (D263): a number the line shows, worked out for this character (느린 낙하's 몽크 레벨×5). */ amount?: Expr; /** H2 (D239): `auto` names a fact the table computes itself (`target.hp.below-max`), so it is never asked. */ fact?: { id: string; at: string; auto?: string; /** V4h (D270): when the computed fact is false, ask instead of dropping the offer (암습). */ orAsk?: boolean }; when?: Expr }
  | { kind: "artifact.spawn"; template: { monsterId?: string; name?: string; count?: Expr }; when?: Expr }
  | { kind: "artifact.remove" | "artifact.repair" | "artifact.damage" | "artifact.relocate" | "artifact.update"; artifact: string; amount?: Expr; damageType?: string; placementRef?: string; metadataPatch?: Record<string, unknown>; when?: Expr };

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
  /**
   * R52 (D187): an entry point invoked as `pre-roll-attack` is declared in the attack dialog before the dice, not
   * pressed on the sheet. `scope` is the weapon filter it applies to (the same vocabulary `property.modify` uses),
   * `requiresEffects` the effects that must already be running, and `oncePerTurn` the budget the player keeps.
   */
  attack?: { scope?: string; oncePerTurn: boolean; requiresEffects: string[] };
  /** V3d (D258): the name of this use when a feature has several — the sheet gets a line and a button per use. */
  label?: string;
  /** V4a (D263): a kill entry point also answers another creature's kill, when the owner confirms they were close (어둠의 존재의 축복). */
  killer?: "self" | "nearby";
  /** V3d (D258): what this use costs, in place of the contract's own payments. */
  payments?: ContractPayment[];
  /**
   * D308: the use exists only while this holds against the character (`actor.chose:<choice>:<option>` — the dragonborn
   * whose ancestry is green breathes poison, not all five). A use whose `when` fails is not on the sheet, not in the
   * attack dialog, and refused by the table.
   */
  when?: Expr;
}

/** D308: whether an entry point is open to this character (no `when`, or its `when` holds). */
export const entryOpen = (entry: { when?: Expr }, scope: Scope) => !entry.when || evaluate(entry.when, scope) === true;

export interface ContractInterceptor {
  id: string;
  timing: string;
  slot: string;
  /** R53 (D188): the weapon filter an `attack.resolved` interceptor narrows itself to (`piercing`, `heavy` …). */
  scope?: string;
  /** R54 (D189): which moment a `reaction.window` interceptor opens on (`attack.hit-self`). */
  trigger?: string;
  /** Which kinds of d20 roll this may touch; empty means every kind at that timing. */
  families: string[];
  /** Which outcomes it may touch (`failure` for a rescue, `success` for Cutting Words); empty means either. */
  outcomes: string[];
  /** The owner is asked before it fires. */
  asks: boolean;
  /** V4l (D274): facts the window asks the player instead (날카로운 말: 60피트 안에서 보고 있는지). */
  asksFacts?: Array<{ id: string; question: string }>;
  /** Facts about the table this executor cannot answer (distance, line of sight); named, never guessed. */
  factQueries: Array<{ id: string; fact: string; unknownPolicy: string; question?: string }>;
  when?: Expr;
  /** V4d (D266): offered at most once each turn (전투 기량). */
  oncePerTurn?: boolean;
  /** V4d (D266): offered only when the d20 showed this number (행운: a 1). */
  naturalOnly?: number;
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

/** V4b (D264): how long a condition from a rule lasts, counted on the source's or the bearer's turns. */
export interface ConditionDuration { /** `permanent`: until something takes it off (넘어짐). */ kind: "rounds" | "minutes" | "hours" | "permanent"; amount: number; boundary?: "start" | "end"; anchor?: "source" | "bearer" }
/**
 * V4b (D264): a mark a rule leaves on a creature until the start of the marker's next turn — its next save is at
 * disadvantage, or the next attack against it (by anyone, or by somebody other than the marker) has advantage or a bonus.
 */
export interface TargetMark { name: string; nextSave?: "disadvantage"; nextAttack?: { advantage?: boolean; bonus?: number; by: "any" | "others" } }
const parseDuration = (raw: unknown): ConditionDuration | undefined => {
  const value = raw as Record<string, unknown> | undefined;
  if (!value || !["rounds", "minutes", "hours", "permanent"].includes(String(value.kind)) || (value.kind !== "permanent" && typeof value.amount !== "number")) return undefined;
  return { kind: value.kind as ConditionDuration["kind"], amount: typeof value.amount === "number" ? value.amount : 0, ...(value.boundary === "start" || value.boundary === "end" ? { boundary: value.boundary } : {}), ...(value.anchor === "source" || value.anchor === "bearer" ? { anchor: value.anchor } : {}) };
};
export const parseTargetMark = (raw: unknown): TargetMark | undefined => {
  const value = raw as Record<string, unknown> | undefined;
  if (!value || typeof value.name !== "string") return undefined;
  const next = value.nextAttack as Record<string, unknown> | undefined;
  return { name: value.name, ...(value.nextSave === "disadvantage" ? { nextSave: "disadvantage" as const } : {}), ...(next ? { nextAttack: { ...(next.advantage === true ? { advantage: true } : {}), ...(typeof next.bonus === "number" ? { bonus: next.bonus } : {}), by: next.by === "others" ? "others" as const : "any" as const } } : {}) };
};

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
 *
 * R41 (D181): these count *kinds*, not schema definitions — the grammar has 26 definitions and 27 kinds, because
 * `condition.apply` and `condition.remove` share one. Kinds are what a contract actually writes, so kinds are what
 * the scoreboard counts.
 */
export const COMPUTED_OPERATIONS = [
  "economy.modify", "condition.apply", "condition.remove", "healing.apply", "roll.modify", "property.modify",
  "effect.apply", "effect.remove", "effect.suppress", "resource.change", "resource.recharge", "temp-hp.grant",
  "damage.apply", "hp.maximum.change", "life.stabilize", "life.death-save", "movement.stand", "movement.relocate",
  "movement.grant", "content.grant", "adjudication.request", "artifact.spawn", "artifact.damage", "artifact.repair",
  "artifact.relocate", "artifact.update", "artifact.remove",
] as const;
export const APPLIED_OPERATIONS = [
  "economy.modify", "roll.modify", "property.modify", "effect.apply", "effect.remove", "effect.suppress",
  "resource.change", "resource.recharge", "temp-hp.grant", "damage.apply", "healing.apply", "condition.remove",
  "hp.maximum.change", "life.stabilize", "movement.stand", "content.grant",
  // R42 (D182): the table-level entry point (`act.contract`) lands the rest.
  "condition.apply", "life.death-save", "movement.relocate", "movement.grant", "adjudication.request",
  "artifact.spawn", "artifact.remove", "artifact.damage", "artifact.repair", "artifact.relocate", "artifact.update",
] as const;

const OPERATION_KINDS = new Set<string>(COMPUTED_OPERATIONS);
/** R39 (D179): `until-duration` is the only lifetime this engine counts; the rest end on something it cannot see. */
export const COUNTED_LIFETIME = "until-duration";
export const LIFETIME_KO: Record<string, string> = {
  "until-duration": "시간이 다할 때까지", "until-consumed": "쓸 때까지", "until-destroyed": "부서질 때까지", "until-state": "상태가 바뀔 때까지",
  "until-event": "그 일이 일어날 때까지", "until-source-recast": "다시 시전할 때까지", "with-parent": "근원이 끝날 때까지", durable: "계속", "world-persistent": "세계에 남음",
};
// R51 (D186): `set-die` replaces the d20 with a fixed face (전투 기량의 은총 turns a miss into a 20).
/** R57 (D192): the moments this engine can put a declared fact in front of somebody. R63 (D198): and after a hit. */
export const FACT_MOMENTS = new Set(["pre-roll", "reaction", "on-hit"]);
/**
 * R63 (D198): the entry points that belong to one swing rather than to a button on the sheet. `pre-roll-attack` is
 * declared before the dice; `on-hit` is chosen once the swing has landed — most 2024 riders say "when you hit".
 */
export const ATTACK_INVOCATIONS = new Set(["pre-roll-attack", "on-hit"]);
/** D324: what runs as a spell is cast (주문 회상의 은총: roll a d4 and keep the slot when it matches). */
export const CAST_INVOCATION = "cast";
/** R78 (D213): an entry point that runs when a short rest ends (비전 회복, 마력 회복) — chosen in the rest window, not pressed on the turn. */
export const REST_INVOCATION = "short-rest";
/** R81 (D215): an entry point that runs when this character rolls initiative (경이로운 신진대사). */
export const INITIATIVE_INVOCATION = "initiative";
/** R99 (D234): this creature brought a hostile creature to 0 hit points (어둠의 존재의 축복). */
export const KILL_INVOCATION = "kill";
/** V4m (D275): an entry point that runs when a long rest ends (인간의 수완). */
export const LONG_REST_INVOCATION = "long-rest";
/** H3 (D240): the moment a feature is gained during character building — its choices and grants (tracks.ts runs it). */
export const GAIN_INVOCATION = "gain";
/** R81 (D215): the moments the table asks about instead of a button: the end of a short rest, an initiative roll. */
export const TRIGGER_INVOCATIONS = new Set([REST_INVOCATION, INITIATIVE_INVOCATION, KILL_INVOCATION, LONG_REST_INVOCATION]);
/**
 * V3c (D257): what happens by itself at the start of the owner's turn, with no window (생존자's healing). Its
 * operations run when their `when` holds against the sheet and its hit points (`actor.hp.current`, `actor.hp.max`).
 */
export const TURN_START_INVOCATION = "turn-start";
/** V4h (D270): what the end of the owner's turn does by itself (자기 회복: one of three conditions goes). */
export const TURN_END_INVOCATION = "turn-end";
export type TriggerEvent = typeof REST_INVOCATION | typeof INITIATIVE_INVOCATION | typeof KILL_INVOCATION | typeof LONG_REST_INVOCATION;
/**
 * R78 (D213): reserved resource ids a `resource.change` restores that are not pools — spell slots whose levels add up to
 * the amount (none above 5th, the rule both 2024 recoveries share) and Pact Magic slots. Same idea as R59's hit die.
 */
export const SLOT_LEVELS_RESOURCE = "resource.spell-slot-levels";
export const PACT_SLOT_RESOURCE = "resource.pact-slot";
/**
 * D300: `reroll-keep-lower` and `reroll-keep-higher` are disadvantage and advantage imposed *after* the die has
 * spoken — the second die is rolled and the worse (or better) of the two stands (수호의 섬광, 그림자 회피).
 */
const ROLL_MODES = new Set(["add-die", "add-flat", "reroll", "reroll-keep-lower", "reroll-keep-higher", "set-die", "subtract-die", "force-success"]);

function parseOperations(raw: unknown, path: string, unsupported: string[]): ContractOperation[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: ContractOperation[] = [];
  list.forEach((item, index) => {
    const operation = item as Record<string, unknown>;
    const kind = String(operation.kind ?? "");
    const at = `${path}[${index}]`;
    if (!OPERATION_KINDS.has(kind)) { unsupported.push(`${at}: ${kind || "이름 없는 연산"}`); return; }
    if (kind === "economy.modify") { out.push({ kind, bucket: String(operation.bucket ?? ""), amount: isExpr(operation.amount) ? operation.amount : { value: operation.amount ?? 0 }, when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "condition.apply") { const save = operation.save as { ability?: unknown; dc?: unknown } | undefined; out.push({ kind, condition: conditionName(operation.condition), target: String(operation.target ?? "target"), when: isExpr(operation.when) ? operation.when : undefined, ...(save && isExpr(save.dc) ? { save: { ability: String(save.ability ?? "con"), dc: save.dc } } : {}), ...(parseDuration(operation.duration) ? { duration: parseDuration(operation.duration) } : {}), ...(operation.repeatSave === "turn-end" ? { repeatSave: "turn-end" as const } : {}), ...(parseTargetMark(operation.successMark) ? { successMark: parseTargetMark(operation.successMark) } : {}) }); return; }
    if (kind === "condition.remove") { out.push({ kind, condition: conditionName(operation.condition), target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "healing.apply") { out.push({ kind, dice: operation.dice ? String(operation.dice) : undefined, ...(typeof operation.hitDice === "number" ? { hitDice: operation.hitDice } : {}), ...(isExpr(operation.diceCount) ? { diceCount: operation.diceCount } : {}), ...(isExpr(operation.diceSides) ? { diceSides: operation.diceSides } : {}), amount: isExpr(operation.amount) ? operation.amount : typeof operation.amount === "number" ? { value: operation.amount } : undefined, target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined, ...(operation.pool === "half-max" ? { pool: "half-max" as const } : {}) }); return; }
    const expr = (raw: unknown, fallback = 0) => (isExpr(raw) ? raw : { value: raw === undefined ? fallback : raw });
    if (kind === "hp.maximum.change") { out.push({ kind, amount: expr(operation.amount), target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "life.stabilize") { out.push({ kind, target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "life.death-save") { out.push({ kind, when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "resource.recharge") {
      const resource = String(operation.resource ?? "");
      if (!resource) { unsupported.push(`${at}: resource.recharge에 resource가 없습니다`); return; }
      out.push({ kind, resourceId: resourceIdOf(resource), die: String(operation.die ?? "1d6"), succeedsOn: (Array.isArray(operation.succeedsOn) ? operation.succeedsOn : [6]).map(Number), ...(isExpr(operation.succeedsOnValue) ? { succeedsOnValue: operation.succeedsOnValue } : {}), when: isExpr(operation.when) ? operation.when : undefined });
      return;
    }
    if (kind === "movement.stand") { out.push({ kind, target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "movement.relocate") { out.push({ kind, mode: String(operation.mode ?? "teleport"), target: String(operation.target ?? "self"), distance: isExpr(operation.distance) ? operation.distance : operation.distance === undefined ? undefined : { value: operation.distance }, note: operation.note ? String(operation.note) : undefined, when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "movement.grant") { out.push({ kind, target: String(operation.target ?? "self"), distance: expr(operation.distance), note: operation.note ? String(operation.note) : undefined, when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "content.grant") { out.push({ kind, contentId: String(operation.contentId ?? ""), target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined }); return; }
    if (kind === "adjudication.request") {
      const fact = operation.fact as { id?: string; at?: string; auto?: string; orAsk?: boolean } | undefined;
      if (fact && !FACT_MOMENTS.has(String(fact.at ?? ""))) { unsupported.push(`${at}: fact.at ${String(fact.at)}`); return; }
      out.push({ kind, question: String((operation.interaction as { prompt?: string } | undefined)?.prompt ?? operation.question ?? "표에서 판단"), ...(isExpr(operation.amount) ? { amount: operation.amount } : {}), ...(fact?.id ? { fact: { id: String(fact.id), at: String(fact.at), ...(fact.auto ? { auto: String(fact.auto) } : {}), ...(fact.orAsk === true ? { orAsk: true } : {}) } } : {}), when: isExpr(operation.when) ? operation.when : undefined });
      return;
    }
    if (kind === "artifact.spawn") {
      const template = (operation.template ?? {}) as Record<string, unknown>;
      out.push({ kind, template: { monsterId: template.monsterId ? String(template.monsterId) : undefined, name: template.name ? String(template.name) : undefined, count: template.count === undefined ? undefined : expr(template.count, 1) }, when: isExpr(operation.when) ? operation.when : undefined });
      return;
    }
    if (kind === "artifact.remove" || kind === "artifact.repair" || kind === "artifact.damage" || kind === "artifact.relocate" || kind === "artifact.update") {
      out.push({ kind, artifact: String(operation.artifact ?? ""), amount: operation.amount === undefined ? undefined : expr(operation.amount), damageType: operation.damageType ? String(operation.damageType) : undefined, placementRef: operation.placementRef ? String(operation.placementRef) : undefined, metadataPatch: (operation.metadataPatch as Record<string, unknown> | undefined), when: isExpr(operation.when) ? operation.when : undefined });
      return;
    }
    if (kind === "resource.change") {
      const resource = String(operation.resource ?? "");
      if (!resource) { unsupported.push(`${at}: resource.change에 resource가 없습니다`); return; }
      const raw = operation.amount;
      out.push({ kind, resourceId: resourceIdOf(resource), amount: isExpr(raw) ? raw : { value: typeof raw === "number" ? raw : (raw as { value?: number } | undefined)?.value ?? 0 }, target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined, ...(operation.upTo === true ? { upTo: true } : {}), ...(typeof operation.level === "number" ? { level: operation.level } : {}) });
      return;
    }
    if (kind === "temp-hp.grant" || kind === "damage.apply") {
      const raw = operation.amount;
      const amount = isExpr(raw) ? raw : raw === undefined ? undefined : { value: raw };
      if (kind === "damage.apply") out.push({ kind, dice: operation.dice ? String(operation.dice) : undefined, diceCount: isExpr(operation.diceCount) ? operation.diceCount : operation.diceCount === undefined ? undefined : { value: operation.diceCount }, ...(isExpr(operation.diceSides) ? { diceSides: operation.diceSides } : {}), ...(operation.save && typeof operation.save === "object" ? { save: { ability: String((operation.save as Record<string, unknown>).ability ?? "con"), dc: expr((operation.save as Record<string, unknown>).dc, 10), success: (operation.save as Record<string, unknown>).success === "none" ? "none" as const : "half" as const } } : {}), amount, damageType: String(operation.damageType ?? "타격"), target: String(operation.target ?? "target"), when: isExpr(operation.when) ? operation.when : undefined });
      else out.push({ kind, dice: operation.dice ? String(operation.dice) : undefined, ...(isExpr(operation.diceCount) ? { diceCount: operation.diceCount } : {}), ...(isExpr(operation.diceSides) ? { diceSides: operation.diceSides } : {}), amount, target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined });
      return;
    }
    if (kind === "effect.apply") {
      const template = (operation.template ?? {}) as Record<string, unknown>;
      out.push({ kind, lifetime: String(operation.lifetime ?? "until-duration"), target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined, template: {
        key: template.key ? String(template.key) : undefined, name: template.name ? String(template.name) : undefined,
        duration: template.duration ? String(template.duration) : undefined,
        rounds: typeof template.rounds === "number" ? template.rounds : undefined,
        concentration: template.concentration === true,
        ...(template.consumeOn === "attack" || template.consumeOn === "cast" || template.consumeOn === "attack-or-cast" ? { consumeOn: template.consumeOn } : {}),
        ...(isExpr(template.rescueDie) ? { rescueDie: template.rescueDie } : {}),
      } });
      return;
    }
    if (kind === "effect.remove" || kind === "effect.suppress") {
      const selector = String((operation.selector as { key?: string } | string | undefined) instanceof Object ? (operation.selector as { key?: string }).key ?? "" : operation.selector ?? "");
      if (!selector) { unsupported.push(`${at}: ${kind}에 selector가 없습니다`); return; }
      if (kind === "effect.remove") out.push({ kind, selector, target: String(operation.target ?? "self"), when: isExpr(operation.when) ? operation.when : undefined });
      else out.push({ kind, selector, suppressed: operation.suppressed !== false, reason: String(operation.reason ?? ""), when: isExpr(operation.when) ? operation.when : undefined });
      return;
    }
    if (kind === "property.modify") {
      const property = String(operation.property ?? "");
      const op = String(operation.operation ?? "add");
      if (!property) { unsupported.push(`${at}: property.modify에 property가 없습니다`); return; }
      // A bare number, string or boolean is the literal it looks like; only an object is read as an expression.
      const literal = operation.value;
      const value = isExpr(literal) ? literal : literal === undefined ? undefined : { value: literal };
      out.push({ kind, property, operation: op, value, ...(operation.spell ? { spell: String(operation.spell) } : {}), ...(operation.school ? { school: String(operation.school) } : {}), ...(operation.params && typeof operation.params === "object" ? { params: operation.params as Record<string, unknown> } : {}), dice: operation.dice ? String(operation.dice) : undefined, ...(isExpr(operation.diceSides) ? { diceSides: operation.diceSides } : {}), scope: operation.scope ? String(operation.scope) : undefined, abilities: Array.isArray(operation.abilities) ? operation.abilities.map(String) : undefined, damageTypes: Array.isArray(operation.damageTypes) ? operation.damageTypes.map(String) : undefined, note: operation.note ? String(operation.note) : undefined, when: isExpr(operation.when) ? operation.when : undefined });
      return;
    }
    const mode = String(operation.mode ?? "");
    if (!ROLL_MODES.has(mode)) { unsupported.push(`${at}: roll.modify ${mode || "모드 없음"}`); return; }
    out.push({ kind: "roll.modify", mode, dice: operation.dice ? String(operation.dice) : undefined, ...(isExpr(operation.diceSides) ? { diceSides: operation.diceSides } : {}), value: isExpr(operation.value) ? operation.value : operation.value === undefined ? undefined : { value: operation.value }, diceResourceId: operation.diceResource ? resourceIdOf(String(operation.diceResource)) : undefined, when: isExpr(operation.when) ? operation.when : undefined });
  });
  return out;
}

/** The payments a contract or one of its entry points declares, naming what this executor cannot take. */
function parsePayments(list: unknown, at: string, unsupported: string[]): ContractPayment[] {
  const payments: ContractPayment[] = [];
  for (const [index, item] of (Array.isArray(list) ? list : []).entries()) {
    const payment = item as Record<string, unknown>;
    const kind = payment.kind === "economy" ? "economy" : payment.kind === "resource" ? "resource" : null;
    if (!kind) { unsupported.push(`${at}[${index}]: ${String(payment.kind)}`); continue; }
    const condition = payment.condition as { kind?: string; outcome?: string } | undefined;
    if (condition && condition.kind !== "d20-result") unsupported.push(`${at}[${index}].condition: ${String(condition.kind)}`);
    const amount = (payment.amount as { value?: number } | undefined)?.value;
    if (typeof amount !== "number") { unsupported.push(`${at}[${index}].amount: 고정 숫자가 아닙니다`); continue; }
    payments.push({
      kind, amount, consumeAt: String(payment.consumeAt ?? "commit"),
      ...(kind === "resource" ? { resourceId: resourceIdOf(String(payment.resource ?? "")) } : { bucket: String(payment.bucket ?? "") }),
      ...(condition?.kind === "d20-result" && (condition.outcome === "success" || condition.outcome === "failure") ? { onlyOn: condition.outcome } : {}),
      refundOnCancel: payment.refundOnCancel === true,
      ...(payment.actionKind ? { actionKind: String(payment.actionKind) } : {}),
    });
  }
  return payments;
}

/** Read a `common-play` mechanic config into a contract, naming every part this executor cannot run. */
export function parseContract(config: Record<string, unknown>, entryId: string): CommonPlayContract {
  const unsupported: string[] = [];
  const id = String(config.id ?? entryId);
  const payments = parsePayments(config.payments, "payments", unsupported);
  const entryPoints: ContractEntryPoint[] = [];
  for (const [index, item] of (Array.isArray(config.entryPoints) ? config.entryPoints : []).entries()) {
    const entry = item as Record<string, unknown>;
    const invocation = String(entry.invocation ?? "manual");
    // R52 (D187): `pre-roll-attack` is the second invocation this executor runs — the attack dialog offers it.
    // R63 (D198): `on-hit` is the third — asked after the swing has landed, when a hit and a critical are known.
    if (invocation !== "manual" && invocation !== GAIN_INVOCATION && invocation !== TURN_START_INVOCATION && invocation !== TURN_END_INVOCATION && invocation !== CAST_INVOCATION && !TRIGGER_INVOCATIONS.has(invocation) && !ATTACK_INVOCATIONS.has(invocation)) unsupported.push(`entryPoints[${index}].invocation: ${invocation}`);
    const attack = entry.attack as { scope?: string; oncePerTurn?: boolean; requiresEffects?: unknown } | undefined;
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
      // V3d (D258): a labelled entry point is a use of its own (몽크의 기: 질풍 연타 …), with its own payments.
      ...(typeof entry.label === "string" ? { label: entry.label } : {}),
      ...(entry.killer === "nearby" ? { killer: "nearby" as const } : {}),
      ...(isExpr(entry.when) ? { when: entry.when } : {}),
      ...(Array.isArray(entry.payments) ? { payments: parsePayments(entry.payments, `entryPoints[${index}].payments`, unsupported) } : {}),
      ...(targeting ? { targeting: { from: String(targeting.from ?? "targets"), min: targeting.min ?? 1, max: targeting.max ?? 1 } } : {}),
      ...(test ? { test } : {}),
      ...(ATTACK_INVOCATIONS.has(invocation) ? { attack: { ...(attack?.scope ? { scope: String(attack.scope) } : {}), oncePerTurn: attack?.oncePerTurn !== false, requiresEffects: Array.isArray(attack?.requiresEffects) ? attack!.requiresEffects.map(String) : [] } } : {}),
      operations: parseOperations(entry.operations, `entryPoints[${index}].operations`, unsupported),
    });
  }
  const interceptors: ContractInterceptor[] = [];
  for (const [index, item] of (Array.isArray(config.interceptors) ? config.interceptors : []).entries()) {
    const raw = item as Record<string, unknown>;
    const factQueries = (Array.isArray(raw.factQueries) ? raw.factQueries : []).map((query) => {
      const fact = query as Record<string, unknown>;
      return { id: String(fact.id ?? ""), fact: String(fact.fact ?? ""), unknownPolicy: String(fact.unknownPolicy ?? "block"), ...(fact.question ? { question: String(fact.question) } : {}) };
    });
    // A fact about where everyone is standing cannot be answered on a scene without positions; the table decides it.
    // Facts the app does know (what kind of weapon swung) are not gaps and are not listed as such.
    // V4l (D274): `unknownPolicy: "ask"` with a `question` is not a gap — the window asks the player that question
    // instead of the engine answering it (날카로운 말: 60피트 안에서 보고 있는지).
    const asksFacts = factQueries.filter((query) => query.unknownPolicy === "ask" && query.question).map((query) => ({ id: query.id, question: String(query.question) }));
    for (const query of factQueries) if (!KNOWN_FACTS.has(query.fact) && !(query.unknownPolicy === "ask" && query.question)) unsupported.push(`interceptors[${index}].factQueries.${query.id}: ${query.fact}`);
    interceptors.push({
      id: String(raw.id ?? `interceptor${index}`), timing: String(raw.timing ?? ""), slot: String(raw.slot ?? ""),
      ...(raw.scope ? { scope: String(raw.scope) } : {}),
      ...(raw.trigger ? { trigger: String(raw.trigger) } : {}),
      families: (Array.isArray(raw.families) ? raw.families : []).map(String),
      outcomes: (Array.isArray(raw.outcomes) ? raw.outcomes : []).map(String),
      asks: Boolean(raw.interaction), factQueries, ...(asksFacts.length ? { asksFacts } : {}),
      ...(raw.oncePerTurn === true ? { oncePerTurn: true } : {}),
      ...(typeof raw.naturalOnly === "number" ? { naturalOnly: raw.naturalOnly } : {}),
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
    // `roll.modify` belongs to an interceptor and `property.modify` to a standing effect; neither is an entry point's doing.
    if (operation.kind === "roll.modify" || operation.kind === "property.modify") continue;
    if (operation.kind === "effect.apply" || operation.kind === "effect.remove" || operation.kind === "effect.suppress") continue;
    if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
    if (operation.kind === "economy.modify") effects.push({ kind: "economy", bucket: operation.bucket, amount: numeric(evaluate(operation.amount, scope)) || 0 });
    else if (operation.kind === "condition.apply") effects.push({ kind: "condition", condition: operation.condition, target: operation.target });
    else if (operation.kind === "healing.apply") effects.push({ kind: "heal", amount: numeric(evaluate(operation.amount, scope)) || 0, target: operation.target });
    else continue;
  }
  return { effects, ...(entry.test ? { test: entry.test, testDc: numeric(evaluate(entry.test.dc, scope)) || 0 } : {}) };
}

/** The interceptors that could fire on a roll of this family and outcome, ignoring facts the table has to supply. */
export function interceptorsFor(contract: CommonPlayContract, timing: string, family: string, outcome: "success" | "failure") {
  return contract.interceptors.filter((item) => item.timing === timing && (!item.families.length || item.families.includes(family)) && (!item.outcomes.length || item.outcomes.includes(outcome)));
}

/** Which turn bucket a contract's economy name refers to, or nothing when this engine does not track it. */
/**
 * R59 (D194): `bonus-action.as:<action>` says an official action may be taken as a bonus action. The bucket names
 * which one, so the turn panel can offer it in both menus instead of the player reading a sentence about it.
 */
export const economyAsAction = (bucket: string) => /^bonus-action\.as:(.+)$/.exec(bucket)?.[1];
/**
 * R61 (D196): `bonus-action.attack:<scope>` says the feature buys one more swing with a weapon of that kind, as a
 * bonus action. The turn panel offers it as a real attack instead of a sentence about one; `any` means any weapon.
 */
export const economyBonusAttack = (bucket: string) => /^bonus-action\.attack:(.+)$/.exec(bucket)?.[1];
/** V4p (D278): `free.attack:<scope>` — one more swing that costs no part of the turn (무리 파괴자). */
export const economyFreeAttack = (bucket: string) => /^free\.attack:(.+)$/.exec(bucket)?.[1];

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
  abilities: Record<string, { modifier: number; score?: number }>;
  saves: Record<string, { bonus: number }>;
  classes: Array<{ classId: string; level: number }>;
  /** R51 (D186): total character level, for a feat whose number is written against it (강인함). */
  level?: number;
  /** R51 (D186): what is worn, for a feat written as "while wearing <training> armour". */
  armor?: { training: string; dexCapped: boolean; shield: boolean };
  /** R78 (D213): Pact Magic, for "half your Pact Magic slots". */
  pactMagic?: { count: number; level: number };
  /** V4a (D263): the die a marked spell rolls on this sheet (적 학살자's d10). */
  markedSpellDice?: Record<string, number>;
  /** V4z (D288): the features this character has, for a rule that only applies to one of two chosen options. */
  features?: Array<{ id: string }>;
  /** D308: what the player picked at creation and level-up, by choice id (`origin.species.draconicAncestry` → [`green`]). */
  choices?: Array<{ id: string; selected: string[] }>;
}

/**
 * The named values a contract may read off a character: `proficiency.bonus`, `ability.str.modifier`,
 * `save.dex.modifier`, `actor.class-level:<classId>`. `extra` carries what only the moment knows (`test.outcome`).
 *
 * R51 (D186): `actor.level`, `armor.training`, `armor.dex-capped` and `equipment.shield` joined them, because the
 * PHB feats are written against what the character is wearing and how far along they are, not only their class.
 */
/** V4z (D288): the rule key of a feature id, the same way `featureRuleKey` writes it (no import: this module has none). */
const featureKeyOf = (id: string) => {
  const feat = /\.feat\.(.+)$/.exec(id);
  if (feat) return `feat:${feat[1]}`;
  const cls = /^[a-z-]+\.\d+\.(.+)$/.exec(id);
  if (cls) return featureKeyOf(cls[1]);
  const sub = /^dnd\.[a-z0-9]+\.feature\.(.+)$/.exec(id);
  if (sub) return sub[1];
  const trait = /\.trait\.([^.]+)$/.exec(id);
  if (trait) return `species.${trait[1]}`;
  return id;
};

export function characterScope(character: ScopeCharacter, extra: Record<string, ExprValue> = {}): Scope {
  return (ref) => {
    if (ref in extra) return extra[ref];
    if (ref === "proficiency.bonus") return character.proficiencyBonus;
    const ability = /^ability\.([a-z]{3})\.modifier$/.exec(ref);
    if (ability) return character.abilities[ability[1]]?.modifier;
    // R53 (D188): the score itself, not the modifier — 저항할 수 없는 공격의 은총 adds the whole 근력 점수.
    const score = /^ability\.([a-z]{3})\.score$/.exec(ref);
    if (score) return character.abilities[score[1]]?.score;
    const save = /^save\.([a-z]{3})\.modifier$/.exec(ref);
    if (save) return character.saves[save[1]]?.bonus;
    const level = /^actor\.class-level:(.+)$/.exec(ref);
    if (level) return character.classes.find((entry) => entry.classId === level[1])?.level ?? 0;
    if (ref === "actor.level") return character.level ?? character.classes.reduce((sum, entry) => sum + entry.level, 0);
    if (ref === "armor.training") return character.armor?.training ?? "none";
    if (ref === "armor.dex-capped") return Boolean(character.armor?.dexCapped);
    if (ref === "equipment.shield") return Boolean(character.armor?.shield);
    if (ref === "actor.pact-slots") return character.pactMagic?.count ?? 0;
    // V4z (D288): `actor.has-feature:<rule key>` — true when this sheet carries that feature (향상된 축복받은 일격).
    const feature = /^actor\.has-feature:(.+)$/.exec(ref);
    if (feature) return (character.features ?? []).some((item) => item.id === feature[1] || item.id.endsWith(`.${feature[1]}`) || featureKeyOf(item.id) === feature[1]);
    // D308: `actor.chose:<choice>:<option>` — true when that option was picked. The choice is named by its full id or
    // by its last part (`draconicAncestry`), so content need not know which step of creation asked it.
    const chose = /^actor\.chose:(.+):([^:]+)$/.exec(ref);
    if (chose) return (character.choices ?? []).some(({ id, selected }) => (id === chose[1] || id.endsWith(`.${chose[1]}`)) && selected.includes(chose[2]));
    const marked = /^actor\.marked-spell-die:(.+)$/.exec(ref);
    if (marked) return character.markedSpellDice?.[marked[1]] ?? 0;
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
  /** V4d (D266): the roll succeeds whatever it came to (전투 기량: a miss becomes a hit, not a critical). */
  forceSuccess?: boolean;
}

/**
 * Work out an interceptor's effect on a roll. `dice.d(sides)` is the host's own roller, so the result is as
 * reproducible as everything else it rolls; `poolDie` answers `subtract-die`'s `diceResource` (the bard's
 * inspiration die), which this engine does not track yet and which therefore contributes nothing rather than a guess.
 */
export function planRollModify(operations: ContractOperation[], scope: Scope, dice: { d: (sides: number) => number }, poolDie?: (resourceId: string) => number | undefined, /** D300: the d20 already on the card, so a rule that imposes (dis)advantage can keep the worse or better die. */ current?: number): RollModifyPlan {
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
      // D300: disadvantage (or advantage) after the fact — roll again and keep the worse (or better) die. Without the
      // die that was already rolled there is nothing to compare against, so the new one simply stands.
      case "reroll-keep-lower":
      case "reroll-keep-higher": {
        const rolled = rollDice(operation.dice ?? "1d20");
        if (!rolled) break;
        const keep = current === undefined ? rolled.total
          : operation.mode === "reroll-keep-lower" ? Math.min(current, rolled.total) : Math.max(current, rolled.total);
        plan.d20 = keep;
        plan.parts.push(`${operation.mode === "reroll-keep-lower" ? "불리점" : "이점"}: ${current === undefined ? "" : `${current} / `}${rolled.total} → ${keep}`);
        break;
      }
      case "add-die": {
        // V4l (D274): the die size may be an expression (비할 데 없는 기술 rolls the bard's own inspiration die).
        const sides = operation.diceSides === undefined ? undefined : Number(evaluate(operation.diceSides, scope));
        const formula = sides && Number.isFinite(sides) ? `1d${Math.floor(sides)}` : operation.dice ?? "";
        const rolled = rollDice(formula);
        if (!rolled) break;
        plan.delta += rolled.total;
        plan.parts.push(`+${formula} = ${rolled.total}`);
        break;
      }
      case "subtract-die": {
        // V4l (D274): an expression may name the die size (날카로운 말 takes the bard's own inspiration die off).
        const size = operation.diceSides === undefined ? undefined : Number(evaluate(operation.diceSides, scope));
        const formula = size && Number.isFinite(size) ? `1d${Math.floor(size)}` : operation.dice;
        const sides = formula ? rollDice(formula)?.total : operation.diceResourceId ? poolDie?.(operation.diceResourceId) : undefined;
        if (sides === undefined) break;
        plan.delta -= sides;
        plan.parts.push(`−${formula ?? ""}${formula ? " = " : ""}${sides}`);
        break;
      }
      // R51 (D186): 전투 기량의 은총 — "change the d20 to a 20". The mode the SRD feat's own `execution.reason`
      // asked for by name ("needs a force-hit roll mode"); it replaces the die rather than adding to the total, so a
      // forced 20 is a natural 20 and crits.
      case "set-die": {
        const value = Number(evaluate(operation.value, scope));
        if (!Number.isFinite(value)) break;
        plan.d20 = value;
        plan.parts.push(`d20 → ${value}`);
        break;
      }
      case "force-success": { plan.forceSuccess = true; plan.parts.push("성공으로"); break; }
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
