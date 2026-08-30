import { DomainEvaluationError, evaluateSemanticPredicate, type SemanticPredicate, type SemanticValue } from "./profileEngine";
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

function validateArea(area:CommonPlayInstantArea) {
  const dimensions=[area.radiusFeet,area.lengthFeet,area.widthFeet,area.heightFeet].filter((value)=>value!==undefined);
  if(!dimensions.length||dimensions.some((value)=>!Number.isFinite(value)||value!<=0)) throw new DomainEvaluationError("area requires positive authoritative dimensions");
  if(area.rangeFeet!==undefined&&(!Number.isFinite(area.rangeFeet)||area.rangeFeet<0)) throw new DomainEvaluationError("area range must be non-negative");
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
