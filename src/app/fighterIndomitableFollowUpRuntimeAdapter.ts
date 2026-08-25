import "./progressionContracts";
import type { ActionVm, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import {
  setFighterIndomitableModifierBonus,
  synchronizeFighterIndomitableProjectedResources,
} from "./fighterIndomitableRuntimeState";
import { resolveRuntimeSaveModifier, runtimeAbilityKey } from "./realRuntimeStatProvider";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { FIGHTER_ID, FIGHTER_INDOMITABLE_RESOURCE_ID } from "../domain/coreClassResources";
import { resolveFighterIndomitable } from "../domain/fighterIndomitable";

const INTERRUPT_ID="follow-up.fighter.indomitable";
const DODGING_STATUS="회피";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;combatantDefinitions:CombatantDefinitionVm[];action(id:string):ActionVm|undefined;syncChar():void;getSnapshot():Promise<AppSnapshot>}
type ResolutionState={resolutionId:string;handled:Set<string>};
const states=new WeakMap<MockAdapter,ResolutionState>();
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function stateFor(adapter:MockAdapter,resolutionId:string){const current=states.get(adapter);if(current?.resolutionId===resolutionId)return current;const next={resolutionId,handled:new Set<string>()};states.set(adapter,next);return next;}
function sheetFor(adapter:MockAdapter,internal:AdapterState,actorId:string){return actorId===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(adapter,actorId)?.sheet;}
function fighterLevel(sheet:CharacterSheet){return sheet.classLevels?.find((entry)=>entry.classId===FIGHTER_ID)?.level??0;}
function rollD20(adapter:MockAdapter,index=0){return (MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID,index);}
function isDexteritySave(action:ActionVm){return ["dex","dexterity","민첩"].includes(String(action.saveAbility??"").toLowerCase());}

function seedResource(adapter:MockAdapter,internal:AdapterState,sheet:CharacterSheet){
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const combatant=state?.combatants[sheet.id];const resource=sheet.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID);if(!state||!combatant||!resource)return state;
  if(combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function eligible(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;const action=resolution&&internal.action(resolution.actionId);if(!resolution||!action||resolution.rollKind!=="save"||resolution.stage!=="save-result")return;
  const state=stateFor(adapter,resolution.id);
  return resolution.saveResults.find((save)=>{
    if(save.outcome!=="실패"||state.handled.has(save.targetId))return false;
    const sheet=sheetFor(adapter,internal,save.targetId);if(!sheet||fighterLevel(sheet)<9)return false;
    const runtime=snapshotAdapterTurnRuntimeState(adapter,internal.scene);return Boolean(runtime?.combatants[save.targetId]?.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)?.current??sheet.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)?.current);
  });
}

function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;const save=eligible(adapter,internal);if(!resolution||!save)return;
  resolution.interrupt={id:INTERRUPT_ID,responderId:save.targetId,responderName:save.targetName,trigger:`${save.targetName} 내성 ${save.total} vs DC ${save.dc} 실패`,optionName:"불굴 재굴림",cost:"불굴 1회",effect:"내성 굴림을 다시 하고 파이터 레벨을 더합니다. 새 결과를 반드시 사용합니다.",source:"SRD 5.2.1 · Fighter Indomitable"};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;
}

MockAdapter.prototype.advanceResolution=async function advanceWithIndomitableOffer(){await previousAdvanceResolution.call(this);offer(this,this as unknown as AdapterState);return this.getSnapshot();};

MockAdapter.prototype.respondToInterrupt=async function respondToIndomitable(accept:boolean){
  const internal=this as unknown as AdapterState;const resolution=internal.resolution;const interrupt=resolution?.interrupt;if(!resolution||interrupt?.id!==INTERRUPT_ID)return previousRespondToInterrupt.call(this,accept);
  const state=stateFor(this,resolution.id);state.handled.add(interrupt.responderId);
  if(!accept){resolution.detail.push(`${interrupt.responderName} 불굴 사용 안 함`);resolution.interrupt=undefined;resolution.stage="save-result";resolution.canAdvance=true;resolution.nextLabel=internal.action(resolution.actionId)?.damage?.length?"피해 굴림":"적용";offer(this,internal);return this.getSnapshot();}
  const save=resolution.saveResults.find((entry)=>entry.targetId===interrupt.responderId);const action=internal.action(resolution.actionId);const sheet=sheetFor(this,internal,interrupt.responderId);const entity=internal.scene.entities.find((entry)=>entry.id===interrupt.responderId);if(!save||!action||!sheet||!entity)return this.getSnapshot();
  const runtime=seedResource(this,internal,sheet);const level=fighterLevel(sheet);const stat=resolveRuntimeSaveModifier(entity,sheet,action.saveAbility??"내성",internal.combatantDefinitions);const rollStateContributions=isDexteritySave(action)&&entity.status.includes(DODGING_STATUS)?[{source:`condition:${DODGING_STATUS}:dexterity-save`,state:"advantage" as const}]:undefined;const faces=rollStateContributions?[rollD20(this),rollD20(this,1)]:[rollD20(this)];if(!runtime)return this.getSnapshot();
  const committed=resolveFighterIndomitable(SIMPLEVTT_APP_RULES_PROFILE,runtime,{id:`${resolution.id}:indomitable:${save.targetId}`,actorId:save.targetId,expectedRevision:runtime.revision,fighterLevel:level,originalOutcome:"failure",ability:runtimeAbilityKey(action.saveAbility??"내성"),target:save.dc,modifierContributions:[{source:stat.source,value:stat.modifier}],rollStateContributions,dice:{id:`${resolution.id}:${save.targetId}:indomitable-d20`,purpose:`${save.targetName} Indomitable saving throw`,sides:20,faces}});const result=committed.results[`${resolution.id}:indomitable:${save.targetId}:reroll`] as {natural:number;total:number;outcome:"success"|"failure"}|undefined;if(committed.status==="rejected"||!result)return this.getSnapshot();
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,runtime);if(projected.status==="rejected")return this.getSnapshot();const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return this.getSnapshot();if(!commitAdapterTurnRuntimeState(this,internal.scene,runtime.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return this.getSnapshot();}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;projectAdapterTurnRuntime(this);setFighterIndomitableModifierBonus(this,resolution.id,save.targetId,level);synchronizeFighterIndomitableProjectedResources(this);appendAdapterInterruptEvents(this,resolution.id,committed.events);
  const index=resolution.saveResults.indexOf(save);resolution.authoritativeDice[index]=result.natural;save.d20=result.natural;save.total=result.total;save.outcome=result.outcome==="success"?"성공":"실패";resolution.detail.push(`${save.targetName} 불굴: d20 ${result.natural} + 파이터 레벨 ${level} = ${result.total} · ${save.outcome} · 1회 소모`);resolution.compact=`${action.saveAbility} 내성 DC ${save.dc} · ${resolution.saveResults.filter((entry)=>entry.outcome==="성공").length} 성공 / ${resolution.saveResults.filter((entry)=>entry.outcome==="실패").length} 실패`;resolution.stateChanges.push(...projected.stateChanges);resolution.interrupt=undefined;resolution.stage="save-result";resolution.canAdvance=true;resolution.nextLabel=action.damage?.length?"피해 굴림":"적용";internal.syncChar();offer(this,internal);return this.getSnapshot();
};
