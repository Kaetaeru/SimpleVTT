import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import {
  FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID,
  resolveFiendDarkOnesOwnLuck,
  warlockFiendRuntimeResourceDefinitions,
} from "../domain/warlockFiend";
import { WARLOCK_FIEND_SUBCLASS_ID } from "../domain/srdSubclassCatalog";
import { WARLOCK_ID } from "../domain/warlockProgressionChoices";

const INTERRUPT_ID="follow-up.warlock.fiend.dark-ones-own-luck";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];action(id:string):ActionVm|undefined;syncChar():void;getSnapshot():Promise<AppSnapshot>}
type HandledState={resolutionId:string;actorIds:Set<string>};
const handled=new WeakMap<MockAdapter,HandledState>();
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function warlockLevel(sheet:CharacterSheet){return sheet.classLevels?.find((entry)=>entry.classId===WARLOCK_ID)?.level??0;}
function qualifies(sheet:CharacterSheet){return warlockLevel(sheet)>=6&&sheet.subclassIds?.[WARLOCK_ID]===WARLOCK_FIEND_SUBCLASS_ID;}
function stateFor(adapter:MockAdapter,resolutionId:string){const current=handled.get(adapter);if(current?.resolutionId===resolutionId)return current;const next={resolutionId,actorIds:new Set<string>()};handled.set(adapter,next);return next;}
function rollD10(adapter:MockAdapter){const face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID);return ((face-1)%10)+1;}

function ensureResource(sheet:CharacterSheet){
  if(!qualifies(sheet))return;
  const definition=warlockFiendRuntimeResourceDefinitions(sheet.classLevels??[],sheet.subclassIds??{},sheet.abilities.cha).find((entry)=>entry.resourceId===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID);
  if(!definition)return;
  const existing=sheet.resources.find((entry)=>entry.id===definition.resourceId);
  if(existing){existing.label=definition.label;existing.max=definition.maximum;existing.current=Math.min(existing.current,definition.maximum);existing.source=definition.source;existing.recovery={...(existing.recovery??{}),...definition.recovery};return;}
  sheet.resources.push({id:definition.resourceId,label:definition.label,current:definition.maximum,max:definition.maximum,source:definition.source,recovery:{...definition.recovery}});
}

function seedResource(adapter:MockAdapter,internal:AdapterState){
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];const resource=internal.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function resourceAvailable(internal:AdapterState){return Boolean(internal.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current);}
function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;if(!resolution||resolution.interrupt||!qualifies(internal.activeCharacter)||!resourceAvailable(internal))return;
  const state=stateFor(adapter,resolution.id);const actorId=internal.activeCharacter.id;if(state.actorIds.has(actorId))return;
  if(resolution.rollKind==="check"&&resolution.stage==="complete"&&resolution.checkOutcome==="실패"&&resolution.actorId===actorId&&Number.isFinite(resolution.checkTarget)&&Number.isFinite(resolution.rollTotal)){
    resolution.interrupt={id:INTERRUPT_ID,responderId:actorId,responderName:internal.activeCharacter.name,trigger:`능력 판정 ${resolution.rollTotal} vs DC ${resolution.checkTarget} 실패`,optionName:"어둠의 존재의 행운 d10",cost:"사용 횟수 1회",effect:"d10을 더하고 새 합계로 성공 여부를 판정합니다.",source:"SRD 5.2.1 · Warlock · Fiend · Dark One's Own Luck"};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;return;
  }
  if(resolution.rollKind!=="save"||resolution.stage!=="save-result")return;
  const save=resolution.saveResults.find((entry)=>entry.targetId===actorId&&entry.outcome==="실패");if(!save)return;
  resolution.interrupt={id:INTERRUPT_ID,responderId:actorId,responderName:internal.activeCharacter.name,trigger:`내성 ${save.total} vs DC ${save.dc} 실패`,optionName:"어둠의 존재의 행운 d10",cost:"사용 횟수 1회",effect:"d10을 더하고 새 합계로 성공 여부를 판정합니다.",source:"SRD 5.2.1 · Warlock · Fiend · Dark One's Own Luck"};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;
}

function updateActivity(internal:AdapterState,resolution:ResolutionView){const activity=internal.activity.find((entry)=>entry.id===resolution.id);if(activity){activity.summary=resolution.compact;activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];activity.stateChanges=[...resolution.stateChanges];}}
function markHandled(adapter:MockAdapter,resolutionId:string,actorId:string){stateFor(adapter,resolutionId).actorIds.add(actorId);}
function restoreStage(internal:AdapterState,resolution:ResolutionView){
  if(resolution.rollKind==="save"){resolution.stage="save-result";resolution.canAdvance=true;resolution.nextLabel=internal.action(resolution.actionId)?.damage?.length?"피해 굴림":"적용";}
  else{resolution.stage="complete";resolution.canAdvance=false;resolution.nextLabel=undefined;}
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithFiendLuckResource(){const internal=this as unknown as AdapterState;ensureResource(internal.activeCharacter);const snapshot=await previousGetSnapshot.call(this);ensureResource(snapshot.activeCharacter);return snapshot;};
MockAdapter.prototype.resolveAction=async function resolveWithFiendLuckOffer(actionId:string,targetIds:string[]){await previousResolveAction.call(this,actionId,targetIds);offer(this,this as unknown as AdapterState);return this.getSnapshot();};
MockAdapter.prototype.advanceResolution=async function advanceWithFiendLuckOffer(){await previousAdvanceResolution.call(this);offer(this,this as unknown as AdapterState);return this.getSnapshot();};

MockAdapter.prototype.respondToInterrupt=async function respondToFiendLuck(accept:boolean){
  const internal=this as unknown as AdapterState;const resolution=internal.resolution;const interrupt=resolution?.interrupt;
  if(!resolution||interrupt?.id!==INTERRUPT_ID){const snapshot=await previousRespondToInterrupt.call(this,accept);offer(this,internal);return snapshot;}
  const actorId=interrupt.responderId;markHandled(this,resolution.id,actorId);
  if(!accept){resolution.detail.push(`${interrupt.responderName} 어둠의 존재의 행운 사용 안 함`);resolution.interrupt=undefined;restoreStage(internal,resolution);return this.getSnapshot();}
  const runtime=seedResource(this,internal);if(!runtime)return this.getSnapshot();const face=rollD10(this);let initial:number;let target:number;let family:"ability-check"|"saving-throw";let save=undefined as ResolutionView["saveResults"][number]|undefined;
  if(resolution.rollKind==="check"){if(resolution.rollTotal===undefined||resolution.checkTarget===undefined)return this.getSnapshot();initial=resolution.rollTotal;target=resolution.checkTarget;family="ability-check";}
  else{save=resolution.saveResults.find((entry)=>entry.targetId===actorId&&entry.outcome==="실패");if(!save)return this.getSnapshot();initial=save.total;target=save.dc;family="saving-throw";}
  const committed=resolveFiendDarkOnesOwnLuck(SIMPLEVTT_APP_RULES_PROFILE,runtime,{id:`${resolution.id}:dark-ones-own-luck`,actorId,expectedRevision:runtime.revision,warlockLevel:warlockLevel(internal.activeCharacter),subclassId:internal.activeCharacter.subclassIds?.[WARLOCK_ID],family,initialTotal:initial,target,d10Face:face});if(committed.status==="rejected"||!committed.check)return this.getSnapshot();
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,runtime);if(projected.status==="rejected")return this.getSnapshot();const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return this.getSnapshot();if(!commitAdapterTurnRuntimeState(this,internal.scene,runtime.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return this.getSnapshot();}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;projectAdapterTurnRuntime(this);const outcome=committed.check.outcome==="success"?"성공":"실패";resolution.detail.push(`어둠의 존재의 행운 d10: ${face} · ${initial} → ${committed.check.finalTotal} · ${outcome}`);resolution.stateChanges.push(...projected.stateChanges);resolution.interrupt=undefined;
  if(family==="ability-check"){resolution.authoritativeDice.push(face);resolution.rollTotal=committed.check.finalTotal;resolution.checkOutcome=outcome;resolution.compact=`${initial} + d10 ${face} = ${committed.check.finalTotal} vs DC ${target} · ${outcome}`;resolution.calculatedOutcome=outcome;resolution.finalOutcome=outcome;const history=runtimeResolutionEventHistories.get(this);runtimeResolutionEventHistories.set(this,{resolutionId:resolution.id,events:[...(history?.resolutionId===resolution.id?history.events:[]),...committed.events]});}
  else if(save){save.total=committed.check.finalTotal;save.outcome=outcome;const action=internal.action(resolution.actionId);resolution.compact=`${action?.saveAbility??"내성"} DC ${save.dc} · ${resolution.saveResults.filter((entry)=>entry.outcome==="성공").length} 성공 / ${resolution.saveResults.filter((entry)=>entry.outcome==="실패").length} 실패`;appendAdapterInterruptEvents(this,resolution.id,committed.events);}
  restoreStage(internal,resolution);updateActivity(internal,resolution);internal.syncChar();return this.getSnapshot();
};
