import { DomainEvaluationError } from "./profileEngine";

export interface SpellMaterialRequirement {
  id?:string;
  costGp?:number;
  consumed?:boolean;
}

export interface SpellComponentRequirements {
  verbal?:boolean;
  somatic?:boolean;
  material?:SpellMaterialRequirement;
}

export interface SpellComponentContext {
  canSpeak:boolean;
  silenced:boolean;
  freeHands:number;
  hasFocus:boolean;
  hasComponentPouch:boolean;
  materials:Record<string,{quantity:number;unitCostGp?:number}>;
}

export interface SpellComponentResolution {
  satisfied:true;
  consumed:Array<{materialId:string;quantity:number}>;
  usedSubstitute?:"focus"|"component-pouch";
}

export function resolveSpellComponents(requirements:SpellComponentRequirements,context:SpellComponentContext):SpellComponentResolution {
  if(!Number.isInteger(context.freeHands)||context.freeHands<0)throw new DomainEvaluationError("spell component freeHands must be a non-negative integer");
  if(requirements.verbal&&(context.silenced||!context.canSpeak))throw new DomainEvaluationError("verbal spell component is unavailable");
  const material=requirements.material;
  const heldFocusOrMaterial=material!==undefined&&(context.hasFocus||context.hasComponentPouch||Boolean(material.id&&context.materials[material.id]?.quantity));
  if(requirements.somatic&&context.freeHands<1&&!heldFocusOrMaterial)throw new DomainEvaluationError("somatic spell component requires a free hand or the held material component");
  if(!material)return {satisfied:true,consumed:[]};
  if(material.costGp!==undefined&&(!Number.isFinite(material.costGp)||material.costGp<0))throw new DomainEvaluationError("material component cost must be non-negative and finite");
  const owned=material.id?context.materials[material.id]:undefined;
  const costly=(material.costGp??0)>0;
  if(costly||material.consumed){
    if(!material.id||!owned||owned.quantity<1||(owned.unitCostGp??0)<(material.costGp??0))throw new DomainEvaluationError("specific costly or consumed material component is unavailable");
    return {satisfied:true,consumed:material.consumed?[{materialId:material.id,quantity:1}]:[]};
  }
  if(owned?.quantity)return {satisfied:true,consumed:[]};
  if(context.hasFocus)return {satisfied:true,consumed:[],usedSubstitute:"focus"};
  if(context.hasComponentPouch)return {satisfied:true,consumed:[],usedSubstitute:"component-pouch"};
  throw new DomainEvaluationError("material spell component, focus, or component pouch is unavailable");
}

export type CastingActivityKind="long-cast"|"ritual";
export interface CommonPlayCastingActivity {
  id:string;
  actorId:string;
  definitionId:string;
  kind:CastingActivityKind;
  requiredSeconds:number;
  elapsedSeconds:number;
  concentrationRequired:true;
  status:"active"|"completed"|"interrupted";
}

export function advanceCastingActivity(activity:CommonPlayCastingActivity,elapsedSeconds:number,concentrating:boolean):CommonPlayCastingActivity {
  if(activity.status!=="active")return structuredClone(activity);
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw new DomainEvaluationError("casting activity elapsed time must be non-negative and finite");
  if(!concentrating)return {...activity,status:"interrupted"};
  const elapsed=Math.min(activity.requiredSeconds,activity.elapsedSeconds+elapsedSeconds);
  return {...activity,elapsedSeconds:elapsed,status:elapsed>=activity.requiredSeconds?"completed":"active"};
}
