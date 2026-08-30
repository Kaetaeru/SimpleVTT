import type { RulesRuntimeState } from "./combatState";
import type { EffectInstance } from "./effects";
import { DomainEvaluationError } from "./profileEngine";
import type { PendingResolution, ResolutionOperation } from "./resolutionTypes";
import { advanceCastingActivity, type CastingActivityKind, type CommonPlayCastingActivity } from "./commonPlaySpellcastingMeta";

const CASTING_TAG="common-play:casting-activity";

function activityFromEffect(effect:EffectInstance):CommonPlayCastingActivity|undefined {
  if(!effect.tags.includes(CASTING_TAG))return undefined;
  const metadata=effect.metadata;
  if(typeof metadata?.definitionId!=="string"||typeof metadata.requiredSeconds!=="number"||typeof metadata.elapsedSeconds!=="number"||(metadata.kind!=="long-cast"&&metadata.kind!=="ritual"))return undefined;
  return {id:effect.id,actorId:effect.targetId,definitionId:metadata.definitionId,kind:metadata.kind as CastingActivityKind,requiredSeconds:metadata.requiredSeconds,elapsedSeconds:metadata.elapsedSeconds,concentrationRequired:true,status:"active"};
}

export function activeCastingProcess(state:RulesRuntimeState,actorId:string,definitionId?:string) {
  for(const effect of state.effects) {
    const activity=activityFromEffect(effect);
    if(activity&&activity.actorId===actorId&&(!definitionId||activity.definitionId===definitionId))return {effect,activity};
  }
  return undefined;
}

function economy(id:string,actorId:string,useActionEconomy:boolean):ResolutionOperation[] {
  return useActionEconomy?[{id:`${id}:economy`,kind:"use-economy",actorId,slot:"action"}]:[];
}

export function beginCastingProcess(input:{
  state:RulesRuntimeState;id:string;actorId:string;definitionId:string;kind:CastingActivityKind;requiredSeconds:number;useActionEconomy:boolean;
}):PendingResolution {
  if(activeCastingProcess(input.state,input.actorId))throw new DomainEvaluationError("actor already has an active casting process");
  if(!Number.isFinite(input.requiredSeconds)||input.requiredSeconds<=0)throw new DomainEvaluationError("casting process duration must be positive");
  const groupId=`${input.id}:concentration`;
  return {id:input.id,actorId:input.actorId,sourceId:input.definitionId,expectedRevision:input.state.revision,operations:[
    ...economy(input.id,input.actorId,input.useActionEconomy),
    {id:`${input.id}:concentration`,kind:"start-concentration",actorId:input.actorId,groupId,sourceId:input.definitionId},
    {id:`${input.id}:effect`,kind:"apply-effect",effect:{
      id:`${input.id}:effect`,sourceId:input.definitionId,sourceActorId:input.actorId,targetId:input.actorId,kind:"marker",tags:[CASTING_TAG],
      duration:{kind:"special",key:"maintained-casting"},concentrationGroupId:groupId,
      termination:{sourceBecomesIncapacitated:true,sourceDies:true},
      metadata:{definitionId:input.definitionId,kind:input.kind,requiredSeconds:input.requiredSeconds,elapsedSeconds:0,publicLabel:"주문 시전 유지"},
    }},
  ]};
}

export function advanceCastingProcess(input:{
  state:RulesRuntimeState;id:string;actorId:string;definitionId:string;elapsedSeconds:number;useActionEconomy:boolean;
}) {
  const current=activeCastingProcess(input.state,input.actorId,input.definitionId);
  if(!current)throw new DomainEvaluationError("active casting process not found");
  const next=advanceCastingActivity(current.activity,input.elapsedSeconds,true,true);
  const operations=next.status==="completed"?[]:[
    ...economy(input.id,input.actorId,input.useActionEconomy),
    {id:`${input.id}:progress`,kind:"update-effect" as const,effectId:current.effect.id,metadataPatch:{elapsedSeconds:next.elapsedSeconds}},
  ];
  return {activity:next,effect:current.effect,operations};
}

export function cancelCastingProcessOperations(effect:EffectInstance,actorId:string,reason:string):ResolutionOperation[] {
  return [
    {id:`${effect.id}:remove`,kind:"remove-effect",effectId:effect.id},
    {id:`${effect.id}:concentration:end`,kind:"end-concentration",actorId,reason},
  ];
}
