import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectedCharacterById, synchronizeProjectedCharacterResources } from "./characterSessionProjectionRegistry";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
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
const states=new WeakMap<MockAdapter,ResolutionState>();
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function stateFor(adapter:MockAdapter,resolutionId:string){const current=states.get(adapter);if(current?.resolutionId===resolutionId)return current;const next={resolutionId,handled:new Set<string>()};states.set(adapter,next);return next;}
function action(scene:SceneVm,id:string){return Object.values(scene.actionsByActor).flat().find((entry)=>entry.id===id);}
function sheetFor(adapter:MockAdapter,internal:AdapterState,actorId:string){return actorId===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(adapter,actorId)?.sheet;}
function validFollowUp(entry:FollowUp){return Boolean(entry.sourceId)&&entry.trigger==="failure"&&entry.families.includes("ability-check")&&entry.modification.mode==="add-die"&&Number.isInteger(entry.modification.diceSides)&&entry.modification.diceSides>=2&&entry.modification.diceSides<=20&&Boolean(entry.payment.resourceId)&&Number.isInteger(entry.payment.amount)&&entry.payment.amount>0;}
function followUps(scene:SceneVm,actorId:string){return (scene.actionsByActor[actorId]??[]).flatMap((entry)=>entry.runtimeD20FollowUps??[]).filter(validFollowUp);}
function rollDie(adapter:MockAdapter,sides:number){const limit=Math.floor(20/sides)*sides;let face:number;do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID);}while(face>limit);return((face-1)%sides)+1;}

function seedResource(adapter:MockAdapter,internal:AdapterState,actorId:string,followUp:FollowUp){
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const combatant=state?.combatants[actorId];const sheet=sheetFor(adapter,internal,actorId);const resource=sheet?.resources.find((entry)=>entry.id===followUp.payment.resourceId);if(!state||!combatant||!resource)return state;
  const existing=combatant.resources.find((entry)=>entry.id===resource.id);if(existing?.current===resource.current&&existing.maximum===resource.max)return state;
  if(existing){existing.current=resource.current;existing.maximum=resource.max;existing.label=resource.label;existing.recovery=resource.recovery?structuredClone(resource.recovery):undefined;}
  else combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function eligible(adapter:MockAdapter,internal:AdapterState,ignoreInterrupt=false){
  const resolution=internal.resolution;const natural=resolution?.naturalD20;const wrongStage=resolution&&(ignoreInterrupt?resolution.stage!=="interrupt":resolution.stage!=="complete");if(!resolution||!ignoreInterrupt&&resolution.interrupt||resolution.rollKind!=="check"||wrongStage||resolution.checkOutcome!=="실패"||!Number.isFinite(resolution.rollTotal)||!Number.isFinite(resolution.checkTarget)||typeof natural!=="number"||!Number.isInteger(natural)||natural<1||natural>20)return;
  const handled=stateFor(adapter,resolution.id).handled;const runtime=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const sheet=sheetFor(adapter,internal,resolution.actorId);
  return followUps(internal.scene,resolution.actorId).find((entry)=>!handled.has(entry.sourceId)&&Boolean(runtime?.combatants[resolution.actorId]?.resources.find((resource)=>resource.id===entry.payment.resourceId)?.current??sheet?.resources.find((resource)=>resource.id===entry.payment.resourceId)?.current));
}

function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;const followUp=eligible(adapter,internal);const actor=resolution&&internal.scene.entities.find((entry)=>entry.id===resolution.actorId);if(!resolution||!followUp||!actor)return;
  resolution.interrupt={id:INTERRUPT_ID,responderId:actor.id,responderName:actor.name,trigger:`능력 판정 ${resolution.rollTotal} vs DC ${resolution.checkTarget} 실패`,...followUp.presentation};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;
}

function restore(resolution:ResolutionView){resolution.interrupt=undefined;resolution.stage="complete";resolution.canAdvance=false;resolution.nextLabel=undefined;}

MockAdapter.prototype.resolveAction=async function resolveWithD20FollowUp(actionId:string,targetIds:string[]){await previousResolveAction.call(this,actionId,targetIds);offer(this,this as unknown as AdapterState);return this.getSnapshot();};
MockAdapter.prototype.advanceResolution=async function advanceWithD20FollowUp(){await previousAdvanceResolution.call(this);offer(this,this as unknown as AdapterState);return this.getSnapshot();};

MockAdapter.prototype.respondToInterrupt=async function respondToD20FollowUp(accept:boolean){
  const internal=this as unknown as AdapterState;const resolution=internal.resolution;const interrupt=resolution?.interrupt;if(!resolution||interrupt?.id!==INTERRUPT_ID)return previousRespondToInterrupt.call(this,accept);
  const followUp=eligible(this,internal,true);if(!followUp)return this.getSnapshot();
  const handled=stateFor(this,resolution.id).handled;
  if(!accept){handled.add(followUp.sourceId);resolution.detail.push(`${interrupt.responderName} ${followUp.presentation.optionName} 사용 안 함`);restore(resolution);offer(this,internal);return this.getSnapshot();}
  const origin=action(internal.scene,resolution.actionId);const runtime=seedResource(this,internal,resolution.actorId,followUp);const initial=resolution.rollTotal;const target=resolution.checkTarget;const natural=resolution.naturalD20;if(!origin||!runtime||initial===undefined||target===undefined||natural===undefined)return this.getSnapshot();
  const sides=followUp.modification.diceSides;if(!Number.isInteger(sides)||sides<2||sides>20)return this.getSnapshot();const face=rollDie(this,sides);const rollId=`${resolution.id}:d20-follow-up:${encodeURIComponent(followUp.sourceId)}`;
  const operations:ResolutionOperation[]=[{id:rollId,kind:"d20",actorId:resolution.actorId,request:{family:"ability-check",target,targetSource:"authoritative prior ability-check target",modifierContributions:[{source:"authoritative prior ability-check modifier total",value:initial-natural}],rollModifications:[{source:followUp.sourceId,mode:"add-die",dice:{id:`${rollId}:bonus`,purpose:followUp.sourceId,sides,faces:[face]}}],dice:{id:`${rollId}:original`,purpose:"authoritative prior ability check",sides:20,faces:[natural]}}}];
  operations.push({id:`${rollId}:payment`,kind:"spend-resource",actorId:resolution.actorId,resourceId:followUp.payment.resourceId,amount:followUp.payment.amount,...(followUp.payment.consumeWhen==="success"?{when:{operationId:rollId,field:"outcome",equals:"success"}}:{})});
  for(const [index,operation] of (origin.checkSuccessOperations??[]).entries())if(operation.kind==="stabilize"&&resolution.targetIds[0])operations.push({id:`${rollId}:success:${index}`,kind:"stabilize",targetId:resolution.targetIds[0],when:{operationId:rollId,field:"outcome",equals:"success"}});
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,runtime,{id:`${resolution.id}:follow-up:${encodeURIComponent(followUp.sourceId)}`,actorId:resolution.actorId,sourceId:followUp.sourceId,expectedRevision:runtime.revision,operations});const result=committed.results[rollId] as D20TestResult|undefined;if(committed.status==="rejected"||!result){resolution.detail.push(committed.status==="rejected"?committed.error:"d20 follow-up result missing");return this.getSnapshot();}
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,runtime);if(projected.status==="rejected")return this.getSnapshot();const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return this.getSnapshot();if(!commitAdapterTurnRuntimeState(this,internal.scene,runtime.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return this.getSnapshot();}
  handled.add(followUp.sourceId);internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;projectAdapterTurnRuntime(this);synchronizeProjectedCharacterResources(this,committed.state);resolution.authoritativeDice.push(face);resolution.rollModifierContributions=[...(resolution.rollModifierContributions??[]),{source:followUp.sourceId,value:face}];resolution.rollTotal=result.total;resolution.checkOutcome=result.outcome==="success"?"성공":"실패";resolution.compact=`${initial} + d${sides} ${face} = ${result.total} vs DC ${target} · ${resolution.checkOutcome}`;resolution.calculatedOutcome=resolution.checkOutcome;resolution.finalOutcome=origin.checkOutcomeLabels?.[result.outcome]??resolution.checkOutcome;resolution.detail.push(`${followUp.presentation.optionName}: ${face}${followUp.payment.consumeWhen==="success"&&result.outcome==="failure"?" · 실패 유지, 자원 보존":" · 자원 소모"}`);resolution.stateChanges.push(...projected.stateChanges);restore(resolution);
  const history=runtimeResolutionEventHistories.get(this);runtimeResolutionEventHistories.set(this,{resolutionId:resolution.id,events:[...(history?.resolutionId===resolution.id?history.events:[]),...committed.events]});const activity=internal.activity.find((entry)=>entry.id===resolution.id);if(activity){activity.summary=resolution.compact;activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];activity.stateChanges=[...resolution.stateChanges];}internal.syncChar();offer(this,internal);return this.getSnapshot();
};
