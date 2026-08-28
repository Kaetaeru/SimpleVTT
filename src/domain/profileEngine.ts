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

export type SemanticValue=number|string|boolean|null|SemanticValue[];
export type SemanticExpression=
  | {value:SemanticValue}
  | {ref:string}
  | {op:ArithmeticOperator;args:SemanticExpression[]};
export type SemanticPredicate=
  | boolean
  | {op:"all"|"any";args:SemanticPredicate[]}
  | {op:"not";arg:SemanticPredicate}
  | {op:"eq"|"ne"|"lt"|"lte"|"gt"|"gte"|"contains";left:SemanticExpression;right:SemanticExpression}
  | {op:"exists"|"has-tag"|"activation-is"|"mode-is"|"source-active"|"resource-at-least"|"progression-at-least"|"relation-matches";ref:string;value?:number|string|boolean};

export interface EconomyGrantBucketDefinition {
  kind:"extra-action";
  allowsMagicAction:boolean;
  activeTurnOnly?:boolean;
}

export interface RulesProfileLike {
  profileId: string;
  roundingPolicy?: { id: string; default?: "floor"|"ceil"|"round" };
  properties: Record<string, { storage?: string; formula?: ExpressionNode }>;
  d20Test?: {
    advantageDisadvantage?: {
      sameSideStacks?: boolean;
      opposingCancel?: boolean;
    };
  };
  economy?: {
    grantBuckets?:Record<string,EconomyGrantBucketDefinition>;
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

export function evaluateSemanticExpression(
  expression:SemanticExpression,
  resolveReference:(property:string)=>SemanticValue|undefined,
):SemanticValue {
  if("value" in expression) return expression.value;
  if("ref" in expression) {
    const value=resolveReference(expression.ref);
    if(value===undefined) throw new DomainEvaluationError(`unresolved semantic reference: ${expression.ref}`);
    return value;
  }
  const values=expression.args.map((arg)=>evaluateSemanticExpression(arg,resolveReference));
  if(values.some((value)=>typeof value!=="number")) throw new DomainEvaluationError(`${expression.op} requires numeric semantic arguments`);
  return evaluateExpression({op:expression.op,args:(values as number[]).map((value)=>({value}))},()=>{throw new DomainEvaluationError("normalized semantic arithmetic cannot contain references");});
}

function compareSemantic(left:SemanticValue,right:SemanticValue,operator:"lt"|"lte"|"gt"|"gte") {
  if(typeof left==="number"&&typeof right==="number") {
    if(operator==="lt") return left<right;
    if(operator==="lte") return left<=right;
    if(operator==="gt") return left>right;
    return left>=right;
  }
  if(typeof left==="string"&&typeof right==="string") {
    if(operator==="lt") return left<right;
    if(operator==="lte") return left<=right;
    if(operator==="gt") return left>right;
    return left>=right;
  }
  throw new DomainEvaluationError(`${operator} requires comparable operands of the same type`);
}

export function evaluateSemanticPredicate(
  predicate:SemanticPredicate,
  resolveReference:(property:string)=>SemanticValue|undefined,
):boolean {
  if(typeof predicate==="boolean") return predicate;
  if("args" in predicate) return predicate.op==="all"
    ? predicate.args.every((entry)=>evaluateSemanticPredicate(entry,resolveReference))
    : predicate.args.some((entry)=>evaluateSemanticPredicate(entry,resolveReference));
  if(predicate.op==="not") return !evaluateSemanticPredicate(predicate.arg,resolveReference);
  if("left" in predicate) {
    const left=evaluateSemanticExpression(predicate.left,resolveReference);
    const right=evaluateSemanticExpression(predicate.right,resolveReference);
    if(predicate.op==="eq") return Object.is(left,right);
    if(predicate.op==="ne") return !Object.is(left,right);
    if(predicate.op==="contains") return Array.isArray(left)?left.some((entry)=>Object.is(entry,right)):typeof left==="string"&&typeof right==="string"?left.includes(right):false;
    return compareSemantic(left,right,predicate.op);
  }
  const value=resolveReference(predicate.ref);
  if(predicate.op==="exists") return value!==undefined;
  if(predicate.op==="has-tag") return Array.isArray(value)&&value.some((entry)=>Object.is(entry,predicate.value));
  if(predicate.op==="resource-at-least"||predicate.op==="progression-at-least") return typeof value==="number"&&typeof predicate.value==="number"&&value>=predicate.value;
  return Object.is(value,predicate.value);
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
