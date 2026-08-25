import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeCreatureType, resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID, CLERIC_ID } from "../domain/coreClassResources";
import { resolveTurnUndead, searUndeadDiceCount } from "../domain/clericTurnUndead";

const ACTION_ID="action.cleric.turn-undead";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;combatantDefinitions:CombatantDefinitionVm[];resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>}
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function actorAction(scene:SceneVm):ActionVm|undefined {
  for(const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]){
    const found=scene.actionsByActor[actorId]?.find((entry)=>entry.id===ACTION_ID);if(found)return found;
  }
}

function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function relation(actor:SceneEntity,target:SceneEntity) {return actor.id===target.id?"self" as const:actor.side===target.side?"ally" as const:"enemy" as const;}
function rollDie(adapter:MockAdapter,index:number,sides:number) {
  const limit=Math.floor(20/sides)*sides;let face:number;let attempt=0;
  do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,ACTION_ID,index+attempt++);}while(face>limit);
  return((face-1)%sides)+1;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithTurnUndeadTargets(){
  const snapshot=await previousGetSnapshot.call(this);const internal=this as unknown as AdapterState;
  for(const actions of Object.values(snapshot.scene.actionsByActor))for(const action of actions)if(action.id===ACTION_ID){
    const ids=snapshot.scene.entities.filter((entity)=>entity.id!==action.actorId&&resolveRuntimeCreatureType(entity,internal.combatantDefinitions)==="undead").map((entity)=>entity.id);
    action.eligibleTargetIds=action.eligibleTargetIds.filter((id)=>ids.includes(id));
    for(const entity of snapshot.scene.entities)if(!ids.includes(entity.id))action.eligibleTargetReasons={...action.eligibleTargetReasons,[entity.id]:entity.id===action.actorId?"자신은 대상이 아닙니다.":"언데드 유형의 액터만 선택할 수 있습니다."};
  }
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveClericTurnUndead(actionId:string,targetIds:string[]){
  if(actionId!==ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;const snapshot=await internal.getSnapshot();const source=actorAction(snapshot.scene);const actor=source&&internal.scene.entities.find((entry)=>entry.id===source.actorId);
  if(!source?.available||!actor||!targetIds.length||targetIds.length>(source.maxTargets??64)||targetIds.some((id)=>!source.eligibleTargetIds.includes(id)))return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&source.actorId!==internal.scene.currentActorId)return snapshot;
  const clericLevel=internal.activeCharacter.classLevels?.find((entry)=>entry.classId===CLERIC_ID)?.level??0;const state=seedResource(this,internal);
  if(!state||!clericLevel||!state.combatants[source.actorId])return snapshot;
  const wisdom=Math.floor((internal.activeCharacter.abilities.wis-10)/2);const resolutionId=`cleric.turn-undead.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  try{
    const targets=targetIds.map((targetId,index)=>{
      const entity=internal.scene.entities.find((entry)=>entry.id===targetId);if(!entity)throw new Error("target missing");
      const sheet=entity.id===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(this,entity.id)?.sheet;
      const save=resolveRuntimeSaveModifier(entity,sheet??internal.activeCharacter,"wis",internal.combatantDefinitions);const spatial=resolveRuntimeTargetingFact(internal.scene,source.actorId,targetId);
      return{id:targetId,kind:"creature" as const,relation:relation(actor,entity),distanceFeet:spatial.distanceFeet,visible:spatial.visible,cover:spatial.cover,creatureType:resolveRuntimeCreatureType(entity,internal.combatantDefinitions)??"",wisdomSaveModifier:save.modifier,creatureKind:entity.kind==="character"?"character" as const:"monster" as const,saveDice:{id:`${resolutionId}:save:${targetId}`,purpose:"Turn Undead Wisdom save",sides:20 as const,faces:[(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,ACTION_ID,index)]}};
    });
    const sear=clericLevel>=5?{effectFaces:Array.from({length:searUndeadDiceCount(wisdom)},(_,index)=>rollDie(this,targetIds.length+index,8))}:undefined;
    const committed=resolveTurnUndead(SIMPLEVTT_APP_RULES_PROFILE,state,{id:resolutionId,actorId:source.actorId,expectedRevision:state.revision,clericLevel,wisdomModifier:wisdom,spellSaveDc:source.saveDc??8,targets,searUndead:sear,useActionEconomy:internal.sessionMode==="initiative"});
    if(committed.status==="rejected")return snapshot;
    const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;
    const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;
    if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
    internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);
    const names=targetIds.map((id)=>internal.scene.entities.find((entry)=>entry.id===id)?.name??id);const resolution:ResolutionView={id:resolutionId,actorId:source.actorId,targetIds,actionId:ACTION_ID,actionName:"언데드 퇴치",rollKind:"save",stage:"complete",authoritativeDice:targets.flatMap((target)=>target.saveDice.faces),saveResults:[],damageComponents:[],compact:`언데드 ${targetIds.length}명 판정 완료`,detail:["실패한 언데드는 공포 및 행동불능 상태가 공개됩니다."],provenance:["SRD 5.2.1 · Cleric Turn Undead"],calculatedOutcome:"언데드 퇴치 적용",finalOutcome:"언데드 퇴치 적용",stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
    internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:names}));internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
  }catch{return snapshot;}
};
