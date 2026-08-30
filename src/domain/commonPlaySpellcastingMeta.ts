import { DomainEvaluationError } from "./profileEngine";

export interface SpellMaterialRequirement {
  id?:string;
  costGp?:number;
  consumed?:boolean;
  perTarget?:boolean;
}

export interface SpellComponentRequirements {
  verbal?:boolean;
  somatic?:boolean;
  materials?:SpellMaterialRequirement[];
  /** @deprecated Use materials for normalized definitions. */
  material?:SpellMaterialRequirement;
}

export interface SpellComponentContext {
  canSpeak:boolean;
  silenced:boolean;
  freeHands:number;
  hasFocus:boolean;
  hasComponentPouch:boolean;
  targetCount?:number;
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
  const materials=requirements.materials??(requirements.material?[requirements.material]:[]);
  const heldFocusOrMaterial=materials.length>0&&(context.hasFocus||context.hasComponentPouch||materials.some((material)=>Boolean(material.id&&context.materials[material.id]?.quantity)));
  if(requirements.somatic&&context.freeHands<1&&!heldFocusOrMaterial)throw new DomainEvaluationError("somatic spell component requires a free hand or the held material component");
  const consumed:Array<{materialId:string;quantity:number}>=[];
  for(const material of materials){
    if(material.costGp!==undefined&&(!Number.isFinite(material.costGp)||material.costGp<0))throw new DomainEvaluationError("material component cost must be non-negative and finite");
    const owned=material.id?context.materials[material.id]:undefined;
    const quantity=material.perTarget?context.targetCount??0:1;
    if(!Number.isInteger(quantity)||quantity<1)throw new DomainEvaluationError("per-target material component requires a positive target count");
    const costly=(material.costGp??0)>0;
    if(costly||material.consumed){
      if(!material.id||!owned||owned.quantity<quantity||(owned.unitCostGp??0)<(material.costGp??0))throw new DomainEvaluationError("specific costly or consumed material component is unavailable");
      if(material.consumed)consumed.push({materialId:material.id,quantity});
      continue;
    }
    if(owned?.quantity&&owned.quantity>=quantity)continue;
    if(context.hasFocus||context.hasComponentPouch)continue;
    throw new DomainEvaluationError("material spell component, focus, or component pouch is unavailable");
  }
  return {satisfied:true,consumed,...(materials.length&&!materials.some((material)=>material.id&&context.materials[material.id]?.quantity)?{usedSubstitute:context.hasFocus?"focus":"component-pouch"}: {})};
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
