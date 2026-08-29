import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionOperation } from "../domain/resolutionTypes";

type AdapterState={role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>};
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function action(scene:SceneVm,actionId:string) {
  for(const actions of Object.values(scene.actionsByActor)){
    const found=actions.find((entry)=>entry.id===actionId);
    if(found)return found;
  }
}

function seedResource(adapter:MockAdapter,internal:AdapterState,source:ActionVm) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const combatant=state?.combatants[source.actorId];
  const cost=source.resourceCost;
  if(!state||!combatant||!cost)return state;
  if(combatant.resources.some((entry)=>entry.id===cost.resourceId))return state;
  const resource=internal.activeCharacter.id===source.actorId?internal.activeCharacter.resources.find((entry)=>entry.id===cost.resourceId):undefined;
  if(!resource)return;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithEffectGrantTargets() {
  const snapshot=await previousGetSnapshot.call(this);
  for(const actions of Object.values(snapshot.scene.actionsByActor))for(const source of actions)if(source.runtimeEffectGrant?.excludeActor){
    source.eligibleTargetIds=source.eligibleTargetIds.filter((targetId)=>targetId!==source.actorId);
    source.eligibleTargetReasons={...source.eligibleTargetReasons,[source.actorId]:"이 효과는 자신에게 부여할 수 없습니다."};
  }
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveEffectGrantAction(actionId:string,targetIds:string[]) {
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const source=action(snapshot.scene,actionId);
  const grant=source?.runtimeEffectGrant;
  if(!source||!grant)return previousResolveAction.call(this,actionId,targetIds);
  const targetId=targetIds[0];
  if(!source.available||targetIds.length!==1||!targetId||grant.excludeActor&&targetId===source.actorId||!source.eligibleTargetIds.includes(targetId))return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&source.actorId!==internal.scene.currentActorId)return snapshot;
  const state=seedResource(this,internal,source);
  if(!state?.combatants[source.actorId]||!state.combatants[targetId])return snapshot;
  const exclusiveTag=grant.exclusiveTag;
  if(exclusiveTag&&state.effects.some((effect)=>effect.targetId===targetId&&effect.tags.includes(exclusiveTag)))return snapshot;
  const resolutionId=`effect-grant.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const operations:ResolutionOperation[]=[];
  const slot=source.economy==="행동"?"action":source.economy==="추가 행동"?"bonus-action":source.economy==="반응"?"reaction":undefined;
  if(internal.sessionMode==="initiative"&&slot)operations.push({id:`${resolutionId}:economy`,kind:"use-economy",actorId:source.actorId,slot,bonusActionGranted:slot==="bonus-action"||undefined,actionKind:source.category==="magic"?"magic":"other"});
  if(source.resourceCost)operations.push({id:`${resolutionId}:resource`,kind:"spend-resource",actorId:source.actorId,resourceId:source.resourceCost.resourceId,amount:source.resourceCost.amount});
  operations.push({id:`${resolutionId}:effect`,kind:"apply-effect",effect:{id:`effect.grant.${encodeURIComponent(source.id)}.${targetId}.${resolutionId}`,sourceId:source.id,sourceActorId:source.actorId,targetId,kind:"marker",tags:[...grant.tags],duration:structuredClone(grant.duration),metadata:grant.metadata?structuredClone(grant.metadata):undefined}});
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{id:resolutionId,actorId:source.actorId,sourceId:source.id,expectedRevision:state.revision,operations});
  if(committed.status==="rejected")return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);
  if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;
  const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);
  const target=internal.scene.entities.find((entry)=>entry.id===targetId)!;
  const label=typeof grant.metadata?.publicLabel==="string"?grant.metadata.publicLabel:source.name;
  const outcome=`${target.name}에게 ${label} 적용`;
  const resolution:ResolutionView={id:resolutionId,actorId:source.actorId,targetIds:[targetId],actionId:source.id,actionName:source.name,rollKind:"effect",stage:"complete",authoritativeDice:[],saveResults:[],damageComponents:[],compact:outcome,detail:[source.summary],provenance:[source.id],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
  internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.activeCharacter.name,targetNames:[target.name]}));
  internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
};
