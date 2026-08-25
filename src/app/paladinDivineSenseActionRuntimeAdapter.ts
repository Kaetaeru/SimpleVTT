import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { resolveRuntimeCreatureType } from "./realRuntimeStatProvider";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { PALADIN_CHANNEL_DIVINITY_RESOURCE_ID, PALADIN_ID } from "../domain/coreClassResources";
import { divineSenseAwareness, resolveDivineSenseActivation } from "../domain/paladinDivineSense";

const ACTION_ID="action.paladin.divine-sense";
interface AdapterState {role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;combatantDefinitions:CombatantDefinitionVm[];resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>}
const previousResolveAction=MockAdapter.prototype.resolveAction;

function actorAction(scene:SceneVm):ActionVm|undefined {for(const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]){const found=scene.actionsByActor[actorId]?.find((entry)=>entry.id===ACTION_ID);if(found)return found;}}
function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];const resource=internal.activeCharacter.resources.find((entry)=>entry.id===PALADIN_CHANNEL_DIVINITY_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

MockAdapter.prototype.resolveAction=async function resolvePaladinDivineSense(actionId:string,targetIds:string[]) {
  if(actionId!==ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;const snapshot=await internal.getSnapshot();const action=actorAction(snapshot.scene);
  if(!action?.available||targetIds.length!==1||targetIds[0]!==action.actorId)return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId)return snapshot;
  const paladinLevel=internal.activeCharacter.classLevels?.find((entry)=>entry.classId===PALADIN_ID)?.level??0;const state=seedResource(this,internal);if(!state||paladinLevel<3||!state.combatants[action.actorId])return snapshot;
  const resolutionId=`paladin.divine-sense.${Date.now()}.${Math.floor(Math.random()*1000)}`;const committed=resolveDivineSenseActivation(SIMPLEVTT_APP_RULES_PROFILE,state,{id:resolutionId,actorId:action.actorId,expectedRevision:state.revision,paladinLevel,channelDivinityResourceId:PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,useBonusAction:internal.sessionMode==="initiative"});
  if(committed.status==="rejected")return snapshot;const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);
  const facts=internal.scene.entities.filter((entity)=>entity.id!==action.actorId).flatMap((entity)=>{const creatureType=resolveRuntimeCreatureType(entity,internal.combatantDefinitions);if(!creatureType)return[];const spatial=resolveRuntimeTargetingFact(internal.scene,action.actorId,entity.id);return[{id:entity.id,distanceFeet:spatial.distanceFeet,creatureType,location:entity.name}];});
  const awareness=divineSenseAwareness(committed.state,action.actorId,facts,[]);const found=awareness.creatures.map((entry)=>`${entry.location} (${entry.creatureType})`);const outcome=found.length?`${found.length}개 존재 감지`:`감지된 존재 없음`;
  const resolution:ResolutionView={id:resolutionId,actorId:action.actorId,targetIds:[action.actorId],actionId:ACTION_ID,actionName:"성스러운 감지",rollKind:"effect",stage:"complete",authoritativeDice:[],saveResults:[],damageComponents:[],compact:outcome,detail:[...(found.length?found:["60피트 내 감지 대상 없음"]),"공간 모듈이 없으면 현재 세션 Actor를 감지 범위로 취급합니다."],provenance:["SRD 5.2.1 · Paladin Divine Sense"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
  internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.activeCharacter.name,targetNames:[]}));internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
};
