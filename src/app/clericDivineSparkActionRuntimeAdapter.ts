import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID, CLERIC_ID } from "../domain/coreClassResources";
import { clericDivineSparkDiceCount, resolveDivineSpark } from "../domain/clericDivineSpark";

const PREFIX="action.cleric.divine-spark.";
type Mode="healing"|"radiant"|"necrotic";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;combatantDefinitions:CombatantDefinitionVm[];resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>}
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function action(scene:SceneVm,id:string) {
  for(const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]){const found=scene.actionsByActor[actorId]?.find((entry)=>entry.id===id);if(found)return found;}
}

function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];const resource=internal.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function relation(actor:SceneEntity,target:SceneEntity) {return actor.id===target.id?"self" as const:actor.side===target.side?"ally" as const:"enemy" as const;}
function rollDie(adapter:MockAdapter,actionId:string,index:number,sides:number) {
  const limit=Math.floor(20/sides)*sides;let face:number;let attempt=0;
  do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,actionId,index+attempt++);}while(face>limit);
  return ((face-1)%sides)+1;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithDivineSparkTargets(){
  const snapshot=await previousGetSnapshot.call(this);
  for(const actions of Object.values(snapshot.scene.actionsByActor))for(const entry of actions)if(entry.id.startsWith(PREFIX)){
    entry.eligibleTargetIds=entry.eligibleTargetIds.filter((targetId)=>targetId!==entry.actorId);
    entry.eligibleTargetReasons={...entry.eligibleTargetReasons,[entry.actorId]:"신성한 불꽃은 자신이 아닌 생물에게 사용합니다."};
  }
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveClericDivineSpark(actionId:string,targetIds:string[]) {
  if(!actionId.startsWith(PREFIX))return previousResolveAction.call(this,actionId,targetIds);
  const mode=actionId.slice(PREFIX.length) as Mode;if(!["healing","radiant","necrotic"].includes(mode))return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;const snapshot=await internal.getSnapshot();const source=action(snapshot.scene,actionId);const targetId=targetIds[0];const target=internal.scene.entities.find((entry)=>entry.id===targetId);const actor=source&&internal.scene.entities.find((entry)=>entry.id===source.actorId);
  if(!source?.available||targetIds.length!==1||!source.eligibleTargetIds.includes(targetId)||!target||!actor||targetId===actor.id)return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&source.actorId!==internal.scene.currentActorId)return snapshot;
  const clericLevel=internal.activeCharacter.classLevels?.find((entry)=>entry.classId===CLERIC_ID)?.level??0;const state=seedResource(this,internal);if(!state||!clericLevel||!state.combatants[source.actorId]||!state.combatants[targetId])return snapshot;
  const targetSheet=target.id===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(this,target.id)?.sheet;let constitution;
  try{constitution=resolveRuntimeSaveModifier(target,targetSheet??internal.activeCharacter,"con",internal.combatantDefinitions);}catch{return snapshot;}
  const spatial=resolveRuntimeTargetingFact(internal.scene,source.actorId,targetId);const diceCount=clericDivineSparkDiceCount(clericLevel);const faces=Array.from({length:diceCount},(_,index)=>rollDie(this,actionId,index,8));const saveFace=(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,actionId,diceCount);
  const resolutionId=`cleric.divine-spark.${Date.now()}.${Math.floor(Math.random()*1000)}`;const beforeHp=target.hp;
  const common={id:resolutionId,actorId:source.actorId,expectedRevision:state.revision,clericLevel,wisdomModifier:Math.floor((internal.activeCharacter.abilities.wis-10)/2),spellSaveDc:source.saveDc??8,target:{id:targetId,kind:"creature" as const,relation:relation(actor,target),distanceFeet:spatial.distanceFeet,visible:spatial.visible,cover:spatial.cover,constitutionSaveModifier:constitution.modifier,creatureKind:target.kind==="character"?"character" as const:"monster" as const},effectFaces:faces,useActionEconomy:internal.sessionMode==="initiative"};
  const committed=mode==="healing"?resolveDivineSpark(SIMPLEVTT_APP_RULES_PROFILE,state,{...common,mode:"healing"}):resolveDivineSpark(SIMPLEVTT_APP_RULES_PROFILE,state,{...common,mode:"damage",damageType:mode,saveDice:{id:`${resolutionId}:save`,purpose:"Divine Spark Constitution save",sides:20,faces:[saveFace]}});
  if(committed.status==="rejected")return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);
  const after=internal.scene.entities.find((entry)=>entry.id===targetId)!;const delta=Math.abs(after.hp-beforeHp);const label=mode==="healing"?`${delta} HP 회복`:`${delta} ${mode==="radiant"?"광휘":"사령"} 피해`;const authoritative=mode==="healing"?faces:[...faces,saveFace];
  const resolution:ResolutionView={id:resolutionId,actorId:source.actorId,targetIds:[targetId],actionId,actionName:source.name,rollKind:mode==="healing"?"healing":"save",stage:"complete",authoritativeDice:authoritative,rollTotal:faces.reduce((sum,face)=>sum+face,0)+common.wisdomModifier,saveResults:[],damageComponents:[],compact:`${target.name} · ${label}`,detail:[...spatial.provenance],provenance:["SRD 5.2.1 · Cleric Divine Spark"],calculatedOutcome:label,finalOutcome:label,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
  internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:[target.name]}));internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
};
