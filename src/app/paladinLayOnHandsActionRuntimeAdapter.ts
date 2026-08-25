import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { PALADIN_ID, PALADIN_LAY_ON_HANDS_RESOURCE_ID } from "../domain/coreClassResources";
import { resolveLayOnHands } from "../domain/paladinLayOnHands";
import { LAY_ON_HANDS_ACTION_ID, parseLayOnHandsExecutionActionId } from "./paladinLayOnHandsRuntimeContracts";

interface AdapterState {role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>}
const previousResolveAction=MockAdapter.prototype.resolveAction;

function actorAction(scene:SceneVm):ActionVm|undefined {
  for(const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]){const found=scene.actionsByActor[actorId]?.find((entry)=>entry.id===LAY_ON_HANDS_ACTION_ID);if(found)return found;}
}
function relation(actor:SceneEntity,target:SceneEntity) {return actor.id===target.id?"self" as const:actor.side===target.side?"ally" as const:"enemy" as const;}
function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];const resource=internal.activeCharacter.resources.find((entry)=>entry.id===PALADIN_LAY_ON_HANDS_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

MockAdapter.prototype.resolveAction=async function resolvePaladinLayOnHands(actionId:string,targetIds:string[]) {
  const command=parseLayOnHandsExecutionActionId(actionId);if(!command)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;const snapshot=await internal.getSnapshot();const source=actorAction(snapshot.scene);const targetId=targetIds[0];const target=internal.scene.entities.find((entry)=>entry.id===targetId);const actor=source&&internal.scene.entities.find((entry)=>entry.id===source.actorId);
  if(!source?.available||!source.layOnHands||!actor||!target||targetIds.length!==1||!source.eligibleTargetIds.includes(targetId))return snapshot;
  if(command.removeConditions.some((id)=>!source.layOnHands!.conditionOptions.some((entry)=>entry.id===id)))return snapshot;
  const cost=command.healingAmount+command.removeConditions.length*5;if(cost<1||cost>source.layOnHands.maximumSpend)return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&source.actorId!==internal.scene.currentActorId)return snapshot;
  const paladinLevel=internal.activeCharacter.classLevels?.find((entry)=>entry.classId===PALADIN_ID)?.level??0;const state=seedResource(this,internal);if(!state||!paladinLevel||!state.combatants[source.actorId]||!state.combatants[targetId])return snapshot;
  const spatial=resolveRuntimeTargetingFact(internal.scene,source.actorId,targetId);const resolutionId=`paladin.lay-on-hands.${Date.now()}.${Math.floor(Math.random()*1000)}`;const beforeHp=target.hp;
  const committed=resolveLayOnHands(SIMPLEVTT_APP_RULES_PROFILE,state,{id:resolutionId,actorId:source.actorId,expectedRevision:state.revision,paladinLevel,target:{id:targetId,kind:"creature",relation:relation(actor,target),distanceFeet:spatial.distanceFeet,visible:spatial.visible,cover:spatial.cover},healingAmount:command.healingAmount,removeConditions:command.removeConditions,resourceId:PALADIN_LAY_ON_HANDS_RESOURCE_ID,useBonusAction:internal.sessionMode==="initiative"});
  if(committed.status==="rejected")return snapshot;const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);const after=internal.scene.entities.find((entry)=>entry.id===targetId)!;const healed=Math.max(0,after.hp-beforeHp);const conditionText=command.removeConditions.length?` · 상태 ${command.removeConditions.length}개 제거`:"";const outcome=`${healed} HP 회복${conditionText}`;
  const resolution:ResolutionView={id:resolutionId,actorId:source.actorId,targetIds:[targetId],actionId,actionName:"치유의 손길",rollKind:"healing",stage:"complete",authoritativeDice:[],rollTotal:healed,saveResults:[],damageComponents:[],compact:`${target.name} · ${outcome}`,detail:[`치유 풀 ${cost}점 사용`,...spatial.provenance],provenance:["SRD 5.2.1 · Paladin Lay On Hands"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
  internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:[target.name]}));internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
};
