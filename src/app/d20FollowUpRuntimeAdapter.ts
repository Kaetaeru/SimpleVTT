import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SaveResultVm, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectedCharacterById, synchronizeProjectedCharacterResources } from "./characterSessionProjectionRegistry";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolvePendingResolution } from "../domain/resolution";
import type { D20TestResult } from "../domain/d20";
import type { ResolutionOperation } from "../domain/resolutionTypes";

const INTERRUPT_ID="follow-up.d20-modification";
type FollowUp=NonNullable<ActionVm["runtimeD20FollowUps"]>[number];
type DicePrototype={d20(actionId:string,index?:number):number};
type AdapterState={scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];syncChar():void;getSnapshot():Promise<AppSnapshot>};
type ResolutionState={resolutionId:string;handled:Set<string>};
type Candidate={followUp:FollowUp;actorId:string;family:"ability-check"|"saving-throw";natural:number;initial:number;target:number;handledKey:string;save?:SaveResultVm};
const states=new WeakMap<MockAdapter,ResolutionState>();
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function stateFor(adapter:MockAdapter,resolutionId:string){const current=states.get(adapter);if(current?.resolutionId===resolutionId)return current;const next={resolutionId,handled:new Set<string>()};states.set(adapter,next);return next;}
function action(scene:SceneVm,id:string){return Object.values(scene.actionsByActor).flat().find((entry)=>entry.id===id);}
function sheetFor(adapter:MockAdapter,internal:AdapterState,actorId:string){return actorId===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(adapter,actorId)?.sheet;}
function validFollowUp(entry:FollowUp){return Boolean(entry.sourceId)&&(entry.trigger==="failure"||entry.trigger==="after-roll")&&entry.families.some((family)=>family==="ability-check"||family==="saving-throw")&&entry.modification.mode==="add-die"&&Number.isInteger(entry.modification.diceSides)&&entry.modification.diceSides>=2&&entry.modification.diceSides<=20&&Boolean(entry.payment.resourceId)&&Number.isInteger(entry.payment.amount)&&entry.payment.amount>0;}
function followUps(scene:SceneVm,actorId:string){return (scene.actionsByActor[actorId]??[]).flatMap((entry)=>entry.runtimeD20FollowUps??[]).filter(validFollowUp);}
function rollDie(adapter:MockAdapter,sides:number){const limit=Math.floor(20/sides)*sides;let face:number;do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID);}while(face>limit);return((face-1)%sides)+1;}
function validD20(value:unknown):value is number{return typeof value==="number"&&Number.isInteger(value)&&value>=1&&value<=20;}

function seedResource(adapter:MockAdapter,internal:AdapterState,actorId:string,followUp:FollowUp){
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const combatant=state?.combatants[actorId];const sheet=sheetFor(adapter,internal,actorId);const resource=sheet?.resources.find((entry)=>entry.id===followUp.payment.resourceId);if(!state||!combatant||!resource)return state;
  const existing=combatant.resources.find((entry)=>entry.id===resource.id);if(existing?.current===resource.current&&existing.maximum===resource.max)return state;
  if(existing){existing.current=resource.current;existing.maximum=resource.max;existing.label=resource.label;existing.recovery=resource.recovery?structuredClone(resource.recovery):undefined;}
  else combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function hasPayment(adapter:MockAdapter,internal:AdapterState,actorId:string,followUp:FollowUp){
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const current=runtime?.combatants[actorId]?.resources.find((resource)=>resource.id===followUp.payment.resourceId)?.current??sheetFor(adapter,internal,actorId)?.resources.find((resource)=>resource.id===followUp.payment.resourceId)?.current??0;
  return current>=followUp.payment.amount;
}

function eligible(adapter:MockAdapter,internal:AdapterState,ignoreInterrupt=false):Candidate|undefined{
  const resolution=internal.resolution;if(!resolution||(!ignoreInterrupt&&resolution.interrupt))return;
  const handled=stateFor(adapter,resolution.id).handled;
  if(resolution.rollKind==="check"){
    if((ignoreInterrupt?resolution.stage!=="interrupt":resolution.stage!=="complete")||!validD20(resolution.naturalD20)||!Number.isFinite(resolution.rollTotal)||!Number.isFinite(resolution.checkTarget))return;
    const followUp=followUps(internal.scene,resolution.actorId).find((entry)=>entry.families.includes("ability-check")&&(entry.trigger!=="failure"||resolution.checkOutcome==="실패")&&!handled.has(`ability-check:${resolution.actorId}:${entry.sourceId}`)&&hasPayment(adapter,internal,resolution.actorId,entry));
    return followUp?{followUp,actorId:resolution.actorId,family:"ability-check",natural:resolution.naturalD20,initial:resolution.rollTotal!,target:resolution.checkTarget!,handledKey:`ability-check:${resolution.actorId}:${followUp.sourceId}`}:undefined;
  }
  if(resolution.rollKind!=="save"||(ignoreInterrupt?resolution.stage!=="interrupt":resolution.stage!=="save-result"))return;
  for(const save of resolution.saveResults){
    if(!validD20(save.d20)||!Number.isFinite(save.total)||!Number.isFinite(save.dc))continue;
    const followUp=followUps(internal.scene,save.targetId).find((entry)=>entry.families.includes("saving-throw")&&(entry.trigger!=="failure"||save.outcome==="실패")&&!handled.has(`saving-throw:${save.targetId}:${entry.sourceId}`)&&hasPayment(adapter,internal,save.targetId,entry));
    if(followUp)return{followUp,actorId:save.targetId,family:"saving-throw",natural:save.d20,initial:save.total,target:save.dc,handledKey:`saving-throw:${save.targetId}:${followUp.sourceId}`,save};
  }
}

function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;const candidate=eligible(adapter,internal);const actor=resolution&&candidate&&internal.scene.entities.find((entry)=>entry.id===candidate.actorId);if(!resolution||!candidate||!actor)return;
  const label=candidate.family==="ability-check"?"능력 판정":"내성";
  resolution.interrupt={id:INTERRUPT_ID,responderId:actor.id,responderName:actor.name,trigger:`${label} ${candidate.initial} vs DC ${candidate.target}${candidate.followUp.trigger==="failure"?" 실패":""}`,...candidate.followUp.presentation};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;
}

function restore(resolution:ResolutionView,origin:ActionVm,candidate:Candidate){
  resolution.interrupt=undefined;
  if(candidate.family==="ability-check"){resolution.stage="complete";resolution.canAdvance=false;resolution.nextLabel=undefined;return;}
  resolution.stage="save-result";resolution.canAdvance=true;resolution.nextLabel=origin.damage?.length?"피해 굴림":"적용";
}

MockAdapter.prototype.resolveAction=async function resolveWithD20FollowUp(actionId:string,targetIds:string[]){await previousResolveAction.call(this,actionId,targetIds);offer(this,this as unknown as AdapterState);return this.getSnapshot();};
MockAdapter.prototype.advanceResolution=async function advanceWithD20FollowUp(){await previousAdvanceResolution.call(this);offer(this,this as unknown as AdapterState);return this.getSnapshot();};

MockAdapter.prototype.respondToInterrupt=async function respondToD20FollowUp(accept:boolean){
  const internal=this as unknown as AdapterState;const resolution=internal.resolution;const interrupt=resolution?.interrupt;if(!resolution||interrupt?.id!==INTERRUPT_ID)return previousRespondToInterrupt.call(this,accept);
  const candidate=eligible(this,internal,true);const origin=action(internal.scene,resolution.actionId);if(!candidate||!origin)return this.getSnapshot();
  const {followUp}=candidate;const handled=stateFor(this,resolution.id).handled;
  if(!accept){handled.add(candidate.handledKey);resolution.detail.push(`${interrupt.responderName} ${followUp.presentation.optionName} 사용 안 함`);restore(resolution,origin,candidate);offer(this,internal);return this.getSnapshot();}
  const runtime=seedResource(this,internal,candidate.actorId,followUp);if(!runtime)return this.getSnapshot();
  const sides=followUp.modification.diceSides;const face=rollDie(this,sides);const rollId=`${resolution.id}:d20-follow-up:${encodeURIComponent(candidate.actorId)}:${encodeURIComponent(followUp.sourceId)}`;
  const operations:ResolutionOperation[]=[{id:rollId,kind:"d20",actorId:candidate.actorId,request:{family:candidate.family,target:candidate.target,targetSource:`authoritative prior ${candidate.family} target`,modifierContributions:[{source:`authoritative prior ${candidate.family} modifier total`,value:candidate.initial-candidate.natural}],rollModifications:[{source:followUp.sourceId,mode:"add-die",dice:{id:`${rollId}:bonus`,purpose:followUp.sourceId,sides,faces:[face]}}],dice:{id:`${rollId}:original`,purpose:`authoritative prior ${candidate.family}`,sides:20,faces:[candidate.natural]}}}];
  operations.push({id:`${rollId}:payment`,kind:"spend-resource",actorId:candidate.actorId,resourceId:followUp.payment.resourceId,amount:followUp.payment.amount,...(followUp.payment.consumeWhen==="success"?{when:{operationId:rollId,field:"outcome",equals:"success"}}:{})});
  if(candidate.family==="ability-check")for(const [index,operation] of (origin.checkSuccessOperations??[]).entries())if(operation.kind==="stabilize"&&resolution.targetIds[0])operations.push({id:`${rollId}:success:${index}`,kind:"stabilize",targetId:resolution.targetIds[0],when:{operationId:rollId,field:"outcome",equals:"success"}});
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,runtime,{id:`${resolution.id}:follow-up:${encodeURIComponent(followUp.sourceId)}`,actorId:candidate.actorId,sourceId:followUp.sourceId,expectedRevision:runtime.revision,operations});const result=committed.results[rollId] as D20TestResult|undefined;if(committed.status==="rejected"||!result){resolution.detail.push(committed.status==="rejected"?committed.error:"d20 follow-up result missing");return this.getSnapshot();}
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,runtime);if(projected.status==="rejected")return this.getSnapshot();const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return this.getSnapshot();if(!commitAdapterTurnRuntimeState(this,internal.scene,runtime.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return this.getSnapshot();}
  handled.add(candidate.handledKey);internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;projectAdapterTurnRuntime(this);synchronizeProjectedCharacterResources(this,committed.state);resolution.authoritativeDice.push(face);resolution.stateChanges.push(...projected.stateChanges);resolution.detail.push(`${followUp.presentation.optionName}: ${face} · ${candidate.initial} → ${result.total} · ${result.outcome==="success"?"성공":"실패"}${followUp.payment.consumeWhen==="success"&&result.outcome==="failure"?" · 자원 보존":" · 자원 소모"}`);
  if(candidate.family==="ability-check"){
    resolution.rollModifierContributions=[...(resolution.rollModifierContributions??[]),{source:followUp.sourceId,value:face}];resolution.rollTotal=result.total;resolution.checkOutcome=result.outcome==="success"?"성공":"실패";resolution.compact=`${candidate.initial} + d${sides} ${face} = ${result.total} vs DC ${candidate.target} · ${resolution.checkOutcome}`;resolution.calculatedOutcome=resolution.checkOutcome;resolution.finalOutcome=origin.checkOutcomeLabels?.[result.outcome]??resolution.checkOutcome;restore(resolution,origin,candidate);
    const history=runtimeResolutionEventHistories.get(this);runtimeResolutionEventHistories.set(this,{resolutionId:resolution.id,events:[...(history?.resolutionId===resolution.id?history.events:[]),...committed.events]});const activity=internal.activity.find((entry)=>entry.id===resolution.id);if(activity){activity.summary=resolution.compact;activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];activity.stateChanges=[...resolution.stateChanges];}
  }else{
    candidate.save!.total=result.total;candidate.save!.outcome=result.outcome==="success"?"성공":"실패";resolution.compact=`${origin.saveAbility??"내성"} DC ${candidate.save!.dc} · ${resolution.saveResults.filter((entry)=>entry.outcome==="성공").length} 성공 / ${resolution.saveResults.filter((entry)=>entry.outcome==="실패").length} 실패`;appendAdapterInterruptEvents(this,resolution.id,committed.events);restore(resolution,origin,candidate);
  }
  internal.syncChar();offer(this,internal);return this.getSnapshot();
};
