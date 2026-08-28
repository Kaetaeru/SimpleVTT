export type ArithmeticOperator =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "min"
  | "max"
  | "floor"
  | "ceil"
  | "round";

export type ExpressionNode =
  | { value: number }
  | { ref: string }
  | { op: ArithmeticOperator; args: ExpressionNode[] };

export interface EconomyModifierBucketDefinition {
  kind:"extra-action";
  allowsMagicAction:boolean;
  activeTurnOnly?:boolean;
}

export interface RulesProfileLike {
  profileId: string;
  roundingPolicy?: { id: string; default?: "floor"|"ceil"|"round" };
  properties: Record<string, { storage?: string; formula?: ExpressionNode }>;
  economy?: {
    modifierBuckets?:Record<string,EconomyModifierBucketDefinition>;
  };
  d20Test?: {
    advantageDisadvantage?: {
      sameSideStacks?: boolean;
      opposingCancel?: boolean;
    };
  };
}

export interface ProvenanceRecord {
  source: string;
  status: "applied" | "suppressed" | "superseded" | "failed";
  reason: string;
}

export interface PropertyResolution {
  property: string;
  value: number;
  provenance: ProvenanceRecord[];
}

export type RollState = "normal" | "advantage" | "disadvantage";

export interface RollStateContribution {
  source: string;
  state: Exclude<RollState, "normal">;
}

export interface RollStateResolution {
  rollState: RollState;
  provenance: ProvenanceRecord[];
}

export class DomainEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainEvaluationError";
  }
}

function assertArgs(op: string, args: ExpressionNode[], expected: number | "at-least-one") {
  if (expected === "at-least-one") {
    if (args.length < 1) throw new DomainEvaluationError(`${op} requires at least one argument`);
    return;
  }
  if (args.length !== expected) throw new DomainEvaluationError(`${op} requires exactly ${expected} argument(s)`);
}

export function evaluateExpression(
  expression: ExpressionNode,
  resolveReference: (property: string) => number,
): number {
  if ("value" in expression) {
    if (!Number.isFinite(expression.value)) throw new DomainEvaluationError("expression literal must be finite");
    return expression.value;
  }

  if ("ref" in expression) return resolveReference(expression.ref);

  const values = expression.args.map((arg) => evaluateExpression(arg, resolveReference));
  switch (expression.op) {
    case "add":
      assertArgs(expression.op, expression.args, "at-least-one");
      return values.reduce((sum, value) => sum + value, 0);
    case "subtract":
      assertArgs(expression.op, expression.args, 2);
      return values[0] - values[1];
    case "multiply":
      assertArgs(expression.op, expression.args, "at-least-one");
      return values.reduce((product, value) => product * value, 1);
    case "divide":
      assertArgs(expression.op, expression.args, 2);
      if (values[1] === 0) throw new DomainEvaluationError("division by zero");
      return values[0] / values[1];
    case "min":
      assertArgs(expression.op, expression.args, "at-least-one");
      return Math.min(...values);
    case "max":
      assertArgs(expression.op, expression.args, "at-least-one");
      return Math.max(...values);
    case "floor":
      assertArgs(expression.op, expression.args, 1);
      return Math.floor(values[0]);
    case "ceil":
      assertArgs(expression.op, expression.args, 1);
      return Math.ceil(values[0]);
    case "round":
      assertArgs(expression.op, expression.args, 1);
      return Math.round(values[0]);
  }
}

function stripOuterParens(value: string) {
  return value.startsWith("(") && value.endsWith(")") ? value.slice(1, -1) : value;
}

export function renderExpression(
  expression: ExpressionNode,
  resolveReference: (property: string) => number,
): string {
  if ("value" in expression) return String(expression.value);
  if ("ref" in expression) return String(resolveReference(expression.ref));

  const rendered = expression.args.map((arg) => renderExpression(arg, resolveReference));
  switch (expression.op) {
    case "add":
      return `(${rendered.join(" + ")})`;
    case "subtract":
      return `(${rendered[0]} - ${rendered[1]})`;
    case "multiply":
      return `(${rendered.join(" * ")})`;
    case "divide":
      return `(${rendered[0]} / ${rendered[1]})`;
    case "min":
    case "max":
      return `${expression.op}(${rendered.join(", ")})`;
    case "floor":
    case "ceil":
    case "round":
      return `${expression.op}(${stripOuterParens(rendered[0])})`;
  }
}

export function resolveProfileProperty(
  profile: RulesProfileLike,
  property: string,
  inputProperties: Record<string, number>,
): PropertyResolution {
  const memo = new Map<string, number>(Object.entries(inputProperties));
  const resolving = new Set<string>();
  const provenance: ProvenanceRecord[] = [];

  const resolve = (propertyId: string): number => {
    const existing = memo.get(propertyId);
    if (existing !== undefined) return existing;

    if (resolving.has(propertyId)) throw new DomainEvaluationError(`cyclic property formula: ${propertyId}`);
    const definition = profile.properties[propertyId];
    if (!definition?.formula) throw new DomainEvaluationError(`unresolved property reference: ${propertyId}`);

    resolving.add(propertyId);
    const value = evaluateExpression(definition.formula, resolve);
    memo.set(propertyId, value);
    resolving.delete(propertyId);

    const usesDefaultFloor =
      "op" in definition.formula && definition.formula.op === "floor" && profile.roundingPolicy?.id;
    const source = usesDefaultFloor
      ? `profile:${profile.profileId}/${profile.roundingPolicy!.id}`
      : `profile:${profile.profileId}/property:${propertyId}`;
    provenance.push({
      source,
      status: "applied",
      reason: `${renderExpression(definition.formula, resolve)} = ${value}`,
    });
    return value;
  };

  return { property, value: resolve(property), provenance };
}

export function resolveRollState(
  profile: RulesProfileLike,
  contributions: RollStateContribution[],
): RollStateResolution {
  const advantages = contributions.filter((entry) => entry.state === "advantage");
  const disadvantages = contributions.filter((entry) => entry.state === "disadvantage");
  const policy = profile.d20Test?.advantageDisadvantage;
  const opposingCancel = policy?.opposingCancel ?? true;
  const sameSideStacks = policy?.sameSideStacks ?? false;

  if (opposingCancel && advantages.length > 0 && disadvantages.length > 0) {
    return {
      rollState: "normal",
      provenance: contributions.map((entry) => ({
        source: entry.source,
        status: "suppressed",
        reason:
          entry.state === "advantage"
            ? "cancelled by opposing Disadvantage contribution"
            : "cancelled by opposing Advantage contribution",
      })),
    };
  }

  const active = advantages.length > 0 ? advantages : disadvantages;
  if (active.length === 0) return { rollState: "normal", provenance: [] };

  const rollState = active[0].state;
  return {
    rollState,
    provenance: active.map((entry, index) => ({
      source: entry.source,
      status: index === 0 || sameSideStacks ? "applied" : "suppressed",
      reason:
        index === 0 || sameSideStacks
          ? `${rollState} contribution applied`
          : `additional ${rollState} contribution does not stack`,
    })),
  };
}
