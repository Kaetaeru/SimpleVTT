import { DomainEvaluationError, evaluateSemanticPredicate, type SemanticExpression, type SemanticPredicate, type SemanticValue } from "./profileEngine";
import { resolveTargeting, type TargetingFactInput, type TargetingResolution } from "./targeting";

export type CommonPlayAreaShape="line"|"cone"|"cube"|"sphere"|"cylinder"|"emanation";
export interface CommonPlayInstantArea {
  kind:"instant";
  shape:CommonPlayAreaShape;
  origin:"self"|"point";
  radiusFeet?:number;
  lengthFeet?:number;
  widthFeet?:number;
  heightFeet?:number;
  rangeFeet?:number;
}
export interface CommonPlaySelector {
  from:"targets"|"content"|"artifacts"|"items"|"actors"|"effects";
  where?:SemanticPredicate;
  min?:number;
  max?:number;
  orderBy?:string;
  area?:CommonPlayInstantArea;
}
export interface CommonPlaySelectorCandidate {
  id:string;
  targeting?:TargetingFactInput;
  properties:Record<string,SemanticValue>;
  /** Must come from a spatial provider or explicit authority answer. */
  areaMember?:boolean;
}
export interface CommonPlaySelectorInput {
  sourceId:string;
  selector:CommonPlaySelector;
  candidates:CommonPlaySelectorCandidate[];
  selectedIds?:string[];
  selection:"manual"|"automatic";
  authority:"actor-owner"|"dm"|"host"|"provider";
  /** Set false only when the owning production path is explicitly mapless and has no cover authority. */
  directTarget?:boolean;
}
export type CommonPlaySelectorResolution=
  | {status:"resolved";targetIds:string[];authority:CommonPlaySelectorInput["authority"];targeting?:TargetingResolution}
  | {status:"rejected"|"unsupported";reason:string};

type Obj=Record<string,unknown>;
const SELECTOR_KEYS=new Set(["from","where","min","max","orderBy","area"]);
const AREA_KEYS=new Set(["kind","shape","origin","radiusFeet","lengthFeet","widthFeet","heightFeet","rangeFeet"]);
const SOURCES=new Set(["targets","content","artifacts","items","actors","effects"]);
const SHAPES=new Set(["line","cone","cube","sphere","cylinder","emanation"]);
const ARITHMETIC=new Set(["add","subtract","multiply","divide","min","max","floor","ceil"]);
const COMPARISONS=new Set(["eq","ne","lt","lte","gt","gte","contains"]);
const SEMANTIC_TESTS=new Set(["exists","has-tag","activation-is","mode-is","source-active","resource-at-least","progression-at-least","relation-matches"]);

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}

function supportedKeys(value:Obj,keys:Set<string>,label:string) {
  const unsupported=Object.keys(value).filter((key)=>!keys.has(key));
  if(unsupported.length) throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
}

function stringValue(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim()) throw new DomainEvaluationError(`${label} must be a non-empty string`);
  return value.trim();
}

function semanticLiteral(value:unknown,label:string):SemanticValue {
  if(value===null||typeof value==="string"||typeof value==="boolean") return value;
  if(typeof value==="number"&&Number.isFinite(value)) return value;
  throw new DomainEvaluationError(`${label} must be a finite scalar semantic literal`);
}

function semanticExpression(value:unknown,label:string):SemanticExpression {
  const expression=object(value,label);
  if("value" in expression) {
    supportedKeys(expression,new Set(["value"]),label);
    return {value:semanticLiteral(expression.value,`${label}.value`)};
  }
  if("ref" in expression) {
    supportedKeys(expression,new Set(["ref"]),label);
    return {ref:stringValue(expression.ref,`${label}.ref`)};
  }
  supportedKeys(expression,new Set(["op","args"]),label);
  if(typeof expression.op!=="string"||!ARITHMETIC.has(expression.op)) throw new DomainEvaluationError(`${label}.op is unsupported`);
  if(!Array.isArray(expression.args)||!expression.args.length) throw new DomainEvaluationError(`${label}.args must be a non-empty array`);
  return {
    op:expression.op as "add"|"subtract"|"multiply"|"divide"|"min"|"max"|"floor"|"ceil",
    args:expression.args.map((arg,index)=>semanticExpression(arg,`${label}.args[${index}]`)),
  };
}

function semanticPredicate(value:unknown,label:string):SemanticPredicate {
  if(typeof value==="boolean") return value;
  const predicate=object(value,label);
  const op=predicate.op;
  if(op==="all"||op==="any") {
    supportedKeys(predicate,new Set(["op","args"]),label);
    if(!Array.isArray(predicate.args)||!predicate.args.length) throw new DomainEvaluationError(`${label}.args must be a non-empty array`);
    return {op,args:predicate.args.map((arg,index)=>semanticPredicate(arg,`${label}.args[${index}]`))};
  }
  if(op==="not") {
    supportedKeys(predicate,new Set(["op","arg"]),label);
    return {op:"not",arg:semanticPredicate(predicate.arg,`${label}.arg`)};
  }
  if(typeof op==="string"&&COMPARISONS.has(op)) {
    supportedKeys(predicate,new Set(["op","left","right"]),label);
    return {
      op:op as "eq"|"ne"|"lt"|"lte"|"gt"|"gte"|"contains",
      left:semanticExpression(predicate.left,`${label}.left`),
      right:semanticExpression(predicate.right,`${label}.right`),
    };
  }
  if(typeof op==="string"&&SEMANTIC_TESTS.has(op)) {
    supportedKeys(predicate,new Set(["op","ref","value"]),label);
    const ref=stringValue(predicate.ref,`${label}.ref`);
    const parsedValue=predicate.value===undefined?undefined:semanticLiteral(predicate.value,`${label}.value`);
    if(parsedValue!==undefined&&(parsedValue===null||typeof parsedValue==="object")) throw new DomainEvaluationError(`${label}.value must be string, number, or boolean when present`);
    return {
      op:op as "exists"|"has-tag"|"activation-is"|"mode-is"|"source-active"|"resource-at-least"|"progression-at-least"|"relation-matches",
      ref,
      ...(parsedValue===undefined?{}:{value:parsedValue}),
    };
  }
  throw new DomainEvaluationError(`${label}.op is unsupported`);
}

function validateArea(area:CommonPlayInstantArea) {
  const dimensions=[area.radiusFeet,area.lengthFeet,area.widthFeet,area.heightFeet].filter((value):value is number=>value!==undefined);
  if(!dimensions.length||dimensions.some((value)=>!Number.isFinite(value)||value<=0)) throw new DomainEvaluationError("area requires positive authoritative dimensions");
  if(area.rangeFeet!==undefined&&(!Number.isFinite(area.rangeFeet)||area.rangeFeet<0)) throw new DomainEvaluationError("area range must be non-negative");
}

function instantArea(value:unknown,label:string):CommonPlayInstantArea {
  const area=object(value,label);
  supportedKeys(area,AREA_KEYS,label);
  if(area.kind!=="instant") throw new DomainEvaluationError(`${label}.kind must be instant`);
  if(typeof area.shape!=="string"||!SHAPES.has(area.shape)) throw new DomainEvaluationError(`${label}.shape is unsupported`);
  if(area.origin!=="self"&&area.origin!=="point") throw new DomainEvaluationError(`${label}.origin must be self or point`);
  const result:CommonPlayInstantArea={kind:"instant",shape:area.shape as CommonPlayAreaShape,origin:area.origin};
  for(const key of ["radiusFeet","lengthFeet","widthFeet","heightFeet"] as const) {
    const dimension=area[key];
    if(dimension===undefined) continue;
    if(typeof dimension!=="number"||!Number.isFinite(dimension)||dimension<=0) throw new DomainEvaluationError(`${label}.${key} must be positive`);
    result[key]=dimension;
  }
  if(area.rangeFeet!==undefined) {
    if(typeof area.rangeFeet!=="number"||!Number.isFinite(area.rangeFeet)||area.rangeFeet<0) throw new DomainEvaluationError(`${label}.rangeFeet must be non-negative`);
    result.rangeFeet=area.rangeFeet;
  }
  validateArea(result);
  return result;
}

export function parseCommonPlaySelector(value:unknown,label="Common Play selector"):CommonPlaySelector {
  const selector=object(value,label);
  supportedKeys(selector,SELECTOR_KEYS,label);
  if(typeof selector.from!=="string"||!SOURCES.has(selector.from)) throw new DomainEvaluationError(`${label}.from is unsupported`);
  const min=selector.min===undefined?undefined:Number(selector.min);
  const max=selector.max===undefined?undefined:Number(selector.max);
  if(min!==undefined&&(!Number.isInteger(min)||min<0)) throw new DomainEvaluationError(`${label}.min must be a non-negative integer`);
  if(max!==undefined&&(!Number.isInteger(max)||max<0)) throw new DomainEvaluationError(`${label}.max must be a non-negative integer`);
  if(min!==undefined&&max!==undefined&&max<min) throw new DomainEvaluationError(`${label}.max must be >= min`);
  const where=selector.where===undefined?undefined:semanticPredicate(selector.where,`${label}.where`);
  const orderBy=selector.orderBy===undefined?undefined:stringValue(selector.orderBy,`${label}.orderBy`);
  const area=selector.area===undefined?undefined:instantArea(selector.area,`${label}.area`);
  if(area&&selector.from!=="targets") throw new DomainEvaluationError(`${label}.area requires from=targets`);
  return {
    from:selector.from as CommonPlaySelector["from"],
    ...(where===undefined?{}:{where}),
    ...(min===undefined?{}:{min}),
    ...(max===undefined?{}:{max}),
    ...(orderBy===undefined?{}:{orderBy}),
    ...(area===undefined?{}:{area}),
  };
}

export function resolveCommonPlaySelector(input:CommonPlaySelectorInput):CommonPlaySelectorResolution {
  try {
    const min=input.selector.min??0;
    const max=input.selector.max??input.candidates.length;
    if(!Number.isInteger(min)||min<0||!Number.isInteger(max)||max<min) throw new DomainEvaluationError("selector bounds are invalid");
    if(input.selector.area) {
      if(input.selector.from!=="targets") throw new DomainEvaluationError("area selector must select targets");
      validateArea(input.selector.area);
      if(input.candidates.some((candidate)=>candidate.areaMember===undefined)) {
        return {status:"unsupported",reason:"area membership requires a spatial provider or explicit authority answer"};
      }
    }
    let candidates=input.candidates.filter((candidate)=>!input.selector.area||candidate.areaMember===true)
      .filter((candidate)=>!input.selector.where||evaluateSemanticPredicate(input.selector.where,(ref)=>ref==="id"?candidate.id:candidate.properties[ref]));
    if(input.selector.orderBy) {
      const property=input.selector.orderBy;
      candidates=[...candidates].sort((left,right)=>String(left.properties[property]??"").localeCompare(String(right.properties[property]??""))||left.id.localeCompare(right.id));
    }
    let selected:CommonPlaySelectorCandidate[];
    if(input.selection==="manual") {
      const ids=input.selectedIds??[];
      if(new Set(ids).size!==ids.length) throw new DomainEvaluationError("selector does not accept duplicate target identities");
      const byId=new Map(candidates.map((candidate)=>[candidate.id,candidate]));
      selected=ids.map((id)=>byId.get(id)!).filter(Boolean);
      if(selected.length!==ids.length) throw new DomainEvaluationError("manual selection contains an ineligible target");
    } else selected=candidates.slice(0,max);
    if(selected.length<min||selected.length>max) throw new DomainEvaluationError(`selector requires ${min}-${max} result(s)`);
    if(input.selector.from!=="targets") return {status:"resolved",targetIds:selected.map((candidate)=>candidate.id),authority:input.authority};
    if(selected.some((candidate)=>!candidate.targeting)) throw new DomainEvaluationError("target selector requires typed targeting facts");
    const targeting=resolveTargeting(input.sourceId,{
      kind:"any",minTargets:min,maxTargets:max,directTarget:input.directTarget??!input.selector.area,
    },selected.map((candidate)=>candidate.targeting!));
    if(!targeting.valid) throw new DomainEvaluationError(targeting.rejected.flatMap((entry)=>entry.reasons).join("; ")||"invalid target selection");
    return {status:"resolved",targetIds:selected.map((candidate)=>candidate.id),authority:input.authority,targeting};
  } catch(error) {
    return {status:"rejected",reason:error instanceof Error?error.message:String(error)};
  }
}
