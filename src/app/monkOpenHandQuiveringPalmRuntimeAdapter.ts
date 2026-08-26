import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import { runtimeResolutionEventHistories, recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { resolvePendingResolution } from "../domain/resolution";
import type { D20TestResult } from "../domain/d20";
import {
  MONK_FOCUS_RESOURCE_ID,
  MONK_OPEN_HAND_CLASS_ID,
  OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
  OPEN_HAND_QUIVERING_PALM_TAG,
  compileOpenHandQuiveringPalmDetonation,
  compileOpenHandQuiveringPalmSeed,
} from "../domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../domain/srdSubclassCatalog";

export const OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID="action.monk.open-hand.quivering-palm.detonate";
const UNARMED_DAMAGE_ACTION_ID="action.unarmed-strike.damage";
const SEED_INTERRUPT_ID="follow-up.monk.open-hand.quivering-palm.seed";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {
  role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;combatantDefinitions:CombatantDefinitionVm[];
  resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>;
}
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousStartInitiative=MockAdapter.prototype.startInitiative;
const handledSeeds=new WeakMap<MockAdapter,Set<string>>();

function monkLevel(sheet:CharacterSheet){return sheet.classLevels?.find((entry)=>entry.classId===MONK_OPEN_HAND_CLASS_ID)?.level??0;}
function qualifies(sheet:CharacterSheet){return monkLevel(sheet)>=17&&sheet.subclassIds?.[MONK_OPEN_HAND_CLASS_ID]===MONK_OPEN_HAND_SUBCLASS_ID;}
function focus(sheet:CharacterSheet){return sheet.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID);}
function markHandled(adapter:MockAdapter,id:string){const ids=handledSeeds.get(adapter)??new Set<string>();ids.add(id);handledSeeds.set(adapter,ids);}
function seedState(adapter:MockAdapter,internal:AdapterState){
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id],resource=focus(internal.activeCharacter);if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max});const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}
function rollDie(adapter:MockAdapter,id:string,sides:number,offset:number){const limit=Math.floor(20/sides)*sides;let face:number,attempt=0;do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,id,offset+attempt++*32);}while(face>limit);return((face-1)%sides)+1;}
function saveFact(adapter:MockAdapter,internal:AdapterState,target:SceneEntity){const sheet=target.id===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(adapter,target.id)?.sheet;return resolveRuntimeSaveModifier(target,sheet??internal.activeCharacter,"con",internal.combatantDefinitions);}
function quiveringTarget(adapter:MockAdapter,internal:AdapterState){return snapshotAdapterTurnRuntimeState(adapter,internal.scene)?.effects.find((effect)=>effect.sourceActorId===internal.activeCharacter.id&&effect.tags.includes(OPEN_HAND_QUIVERING_PALM_TAG))?.targetId;}
function project(scene:SceneVm,action:ActionVm|undefined){for(const actorId of Object.keys(scene.actionsByActor))scene.actionsByActor[actorId]=(scene.actionsByActor[actorId]??[]).filter((entry)=>entry.id!==OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID);if(action)scene.actionsByActor[action.actorId]=[...(scene.actionsByActor[action.actorId]??[]),structuredClone(action)];}
function detonationAction(adapter:MockAdapter,internal:AdapterState,snapshot:AppSnapshot):ActionVm|undefined{
  const sheet=snapshot.activeCharacter;if(!qualifies(sheet))return;const targetId=quiveringTarget(adapter,internal),target=targetId?snapshot.scene.entities.find((entry)=>entry.id===targetId):undefined;if(!target)return;
  const actionAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[sheet.id]?.action??false);const dc=8+sheet.proficiencyBonus+Math.floor((sheet.abilities.wis-10)/2);
  return {id:OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID,actorId:sheet.id,name:"진동장",category:"basic",target:"enemy",economy:"행동",resolutionKind:"saving-throw",summary:`건강 내성 DC ${dc} · 10d12 역장 · 성공 절반`,available:actionAvailable,disabledReason:actionAvailable?undefined:"행동을 이미 사용했습니다.",eligibleTargetIds:[target.id],saveDc:dc,saveAbility:"건강",saveHalf:true,damage:[{type:"역장",dice:"10d12",flat:0,average:65}],details:[{label:"대상",value:target.name},{label:"내성",value:`건강 DC ${dc}`},{label:"피해",value:"10d12 역장 · 성공 시 절반"},{label:"비용",value:"행동 1"},{label:"출처",value:"SRD 5.2.1 · Monk · Warrior of the Open Hand · Quivering Palm",source:OPEN_HAND_QUIVERING_PALM_FEATURE_ID}]};
}
function offerSeed(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution,resource=focus(internal.activeCharacter);if(!resolution||handledSeeds.get(adapter)?.has(resolution.id)||!qualifies(internal.activeCharacter)||resolution.actorId!==internal.activeCharacter.id||resolution.actionId!==UNARMED_DAMAGE_ACTION_ID||resolution.stage!=="complete"||resolution.attackOutcome!=="명중"||resolution.targetIds.length!==1||(resource?.current??0)<4)return;
  const target=internal.scene.entities.find((entry)=>entry.id===resolution.targetIds[0]);if(!target)return;resolution.interrupt={id:SEED_INTERRUPT_ID,responderId:resolution.actorId,responderName:internal.activeCharacter.name,trigger:`맨손 타격이 ${target.name}에게 명중`,optionName:"진동장 주입",cost:"기 4점",effect:"대상에게 진동을 심습니다. 기존 진동 대상은 교체됩니다.",source:"SRD 5.2.1 · Open Hand · Quivering Palm"};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;
}
function refreshActivity(internal:AdapterState,resolution:ResolutionView){const activity=internal.activity.find((entry)=>entry.id===resolution.id);if(!activity)return;activity.summary=resolution.compact;activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];activity.stateChanges=[...resolution.stateChanges];}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithQuiveringPalm(){const internal=this as unknown as AdapterState;const snapshot=await previousGetSnapshot.call(this);const action=detonationAction(this,internal,snapshot);project(internal.scene,action);project(snapshot.scene,action);return snapshot;};
MockAdapter.prototype.startInitiative=async function startInitiativePreservingQuiveringPalm(){
  const internal=this as unknown as AdapterState;
  const before=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const preserved=(before?.effects??[]).filter((effect)=>effect.tags.includes(OPEN_HAND_QUIVERING_PALM_TAG)).map((effect)=>structuredClone(effect));
  const snapshot=await previousStartInitiative.call(this);
  if(!preserved.length)return snapshot;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);if(!state)return snapshot;
  const known=new Set(state.effects.map((effect)=>effect.id)),missing=preserved.filter((effect)=>!known.has(effect.id));if(!missing.length)return snapshot;
  const expected=state.revision;state.effects.push(...missing);state.revision+=1;
  return commitAdapterTurnRuntimeState(this,internal.scene,expected,state)?this.getSnapshot():snapshot;
};
MockAdapter.prototype.resolveAction=async function resolveWithQuiveringPalm(actionId:string,targetIds:string[]){if(actionId===OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID)return resolveDetonation(this,this as unknown as AdapterState,targetIds);const snapshot=await previousResolveAction.call(this,actionId,targetIds);offerSeed(this,this as unknown as AdapterState);return snapshot.resolution?.stage==="interrupt"?(this as MockAdapter).getSnapshot():snapshot;};
MockAdapter.prototype.advanceResolution=async function advanceWithQuiveringPalmSeed(){await previousAdvanceResolution.call(this);offerSeed(this,this as unknown as AdapterState);return this.getSnapshot();};
MockAdapter.prototype.respondToInterrupt=async function respondToQuiveringPalmSeed(accept:boolean){
  const internal=this as unknown as AdapterState,resolution=internal.resolution,interrupt=resolution?.interrupt;if(!resolution||interrupt?.id!==SEED_INTERRUPT_ID)return previousRespondToInterrupt.call(this,accept);
  if(!accept){markHandled(this,resolution.id);resolution.detail.push("진동장 주입 안 함");resolution.interrupt=undefined;resolution.stage="complete";return this.getSnapshot();}
  const state=seedState(this,internal),targetId=resolution.targetIds[0];if(!state||!targetId)return this.getSnapshot();const pending=compileOpenHandQuiveringPalmSeed(state,{id:`${resolution.id}:quivering-palm-seed`,actorId:resolution.actorId,targetId,expectedRevision:state.revision,monkLevel:monkLevel(internal.activeCharacter),subclassId:internal.activeCharacter.subclassIds?.[MONK_OPEN_HAND_CLASS_ID],unarmedStrikeHit:true});const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,pending);if(committed.status==="rejected")return this.getSnapshot();
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return this.getSnapshot();const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return this.getSnapshot();if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return this.getSnapshot();}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);markHandled(this,resolution.id);resolution.interrupt=undefined;resolution.stage="complete";resolution.detail.push(`진동장 주입: ${targetId} · 기 4점`);resolution.stateChanges.push(...projected.stateChanges);if(!resolution.provenance.includes("SRD 5.2.1 · Open Hand · Quivering Palm"))resolution.provenance.push("SRD 5.2.1 · Open Hand · Quivering Palm");const history=runtimeResolutionEventHistories.get(this);runtimeResolutionEventHistories.set(this,{resolutionId:resolution.id,events:[...(history?.resolutionId===resolution.id?history.events:[]),...committed.events]});refreshActivity(internal,resolution);internal.syncChar();return this.getSnapshot();
};

async function resolveDetonation(adapter:MockAdapter,internal:AdapterState,targetIds:string[]){
  const snapshot=await internal.getSnapshot(),action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID),targetId=targetIds[0],target=targetId?internal.scene.entities.find((entry)=>entry.id===targetId):undefined;if(!action?.available||targetIds.length!==1||!action.eligibleTargetIds.includes(targetId)||!target)return snapshot;if(internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId)return snapshot;
  const state=seedState(adapter,internal);if(!state||!state.combatants[action.actorId]||!state.combatants[targetId])return snapshot;let save;try{save=saveFact(adapter,internal,target);}catch{return snapshot;}const resolutionId=`monk.open-hand.quivering-palm.${Date.now()}.${Math.floor(Math.random()*1000)}`,saveFace=rollDie(adapter,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID,20,0),damageFaces=Array.from({length:10},(_,index)=>rollDie(adapter,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID,12,index+1));const pending=compileOpenHandQuiveringPalmDetonation(state,{id:resolutionId,actorId:action.actorId,targetId,expectedRevision:state.revision,monkLevel:monkLevel(internal.activeCharacter),subclassId:internal.activeCharacter.subclassIds?.[MONK_OPEN_HAND_CLASS_ID],activation:"action",samePlane:true,proficiencyBonus:internal.activeCharacter.proficiencyBonus,wisdomModifier:Math.floor((internal.activeCharacter.abilities.wis-10)/2),targetConSaveModifier:save.modifier,saveDice:{id:`${resolutionId}:save-d20`,purpose:"Quivering Palm Constitution save",sides:20,faces:[saveFace]},forceDamageFaces:damageFaces,creatureKind:target.kind==="character"?"character":"monster"});if(internal.sessionMode!=="initiative")pending.operations=pending.operations.filter((operation)=>operation.kind!=="use-economy");const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,pending);if(committed.status==="rejected")return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;const writeBack=await persistCharacterResolutionEvents(adapter,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;if(!commitAdapterTurnRuntimeState(adapter,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(adapter,committed.events,"inverse");return snapshot;}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(adapter);if(session)projectTurnRuntimeToScene(session,internal.scene);const saveResult=committed.results[`${resolutionId}:save`] as D20TestResult,raw=damageFaces.reduce((sum,face)=>sum+face,0),adjusted=saveResult.outcome==="success"?Math.floor(raw/2):raw,outcome=`${target.name} 건강 내성 ${saveResult.outcome==="success"?"성공":"실패"} · ${adjusted} 역장 피해`;
  const resolution:ResolutionView={id:resolutionId,actorId:action.actorId,targetIds:[targetId],actionId:action.id,actionName:"진동장",rollKind:"save",stage:"complete",authoritativeDice:[saveFace,...damageFaces],rollTotal:saveResult.total,saveResults:[{targetId,targetName:target.name,d20:saveResult.natural,total:saveResult.total,dc:saveResult.target,outcome:saveResult.outcome==="success"?"성공":"실패",finalDamage:adjusted}],damageComponents:[{type:"역장",roll:"10d12",raw,adjusted,adjustment:saveResult.outcome==="success"?"내성 성공 · 절반":"내성 실패",source:OPEN_HAND_QUIVERING_PALM_FEATURE_ID}],compact:outcome,detail:[`건강 내성 ${saveResult.total} vs DC ${saveResult.target}`,`10d12 = ${raw}`],provenance:["SRD 5.2.1 · Monk · Warrior of the Open Hand · Quivering Palm"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.activeCharacter.name,targetNames:[target.name]}));internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(adapter,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
}
