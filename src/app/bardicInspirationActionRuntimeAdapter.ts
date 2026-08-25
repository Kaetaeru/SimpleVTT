import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { BARDIC_INSPIRATION_RESOURCE_ID, BARD_ID, bardicInspirationDieSides, resolveGrantBardicInspiration } from "../domain/bardicInspiration";

const ACTION_ID="action.bard.bardic-inspiration";
interface AdapterState {role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>}
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

MockAdapter.prototype.getSnapshot=async function getSnapshotWithBardicInspirationTargets() {
  const snapshot=await previousGetSnapshot.call(this);
  for(const actions of Object.values(snapshot.scene.actionsByActor))for(const action of actions)if(action.id===ACTION_ID){
    action.eligibleTargetIds=action.eligibleTargetIds.filter((targetId)=>targetId!==action.actorId);
    action.eligibleTargetReasons={...action.eligibleTargetReasons,[action.actorId]:"바드의 영감은 자신이 아닌 아군에게만 줄 수 있습니다."};
  }
  return snapshot;
};

function actorAction(scene:SceneVm):ActionVm|undefined {
  for(const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]){
    const action=scene.actionsByActor[actorId]?.find((entry)=>entry.id===ACTION_ID);if(action)return action;
  }
}

function seedResource(adapter:MockAdapter,internal:AdapterState) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

MockAdapter.prototype.resolveAction=async function resolveBardicInspirationAction(actionId:string,targetIds:string[]) {
  if(actionId!==ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();const action=actorAction(snapshot.scene);const targetId=targetIds[0];
  if(!action?.available||targetIds.length!==1||targetId===action.actorId||!action.eligibleTargetIds.includes(targetId))return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId)return snapshot;
  const bardLevel=internal.activeCharacter.classLevels?.find((entry)=>entry.classId===BARD_ID)?.level??0;
  const state=seedResource(this,internal);if(!state||!bardLevel||!state.combatants[action.actorId]||!state.combatants[targetId])return snapshot;
  const resolutionId=`bardic-inspiration.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveGrantBardicInspiration(SIMPLEVTT_APP_RULES_PROFILE,state,{id:resolutionId,actorId:action.actorId,targetId,expectedRevision:state.revision,bardLevel,distanceFeet:0,targetCanSeeOrHearBard:true,useBonusAction:internal.sessionMode==="initiative",resourceId:BARDIC_INSPIRATION_RESOURCE_ID});
  if(committed.status==="rejected")return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;
  const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);
  const target=internal.scene.entities.find((entry)=>entry.id===targetId)!;const outcome=`${target.name}에게 d${bardicInspirationDieSides(bardLevel)} 영감 지급`;
  const resolution:ResolutionView={id:resolutionId,actorId:action.actorId,targetIds:[targetId],actionId:ACTION_ID,actionName:"바드의 영감",rollKind:"effect",stage:"complete",authoritativeDice:[],saveResults:[],damageComponents:[],compact:outcome,detail:["대상은 1시간 안에 실패한 d20 판정에 영감 주사위를 더할 수 있습니다."],provenance:["SRD 5.2.1 · Bardic Inspiration"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
  internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.activeCharacter.name,targetNames:[target.name]}));
  internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
};
