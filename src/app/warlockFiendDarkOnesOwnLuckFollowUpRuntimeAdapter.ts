import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { WARLOCK_FIEND_SUBCLASS_ID } from "../domain/srdSubclassCatalog";
import {
  FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID,
  resolveFiendDarkOnesOwnLuck,
} from "../domain/warlockFiend";
import { WARLOCK_ID } from "../domain/warlockProgressionChoices";

const INTERRUPT_ID="follow-up.warlock.fiend.dark-ones-own-luck";
type DicePrototype={d20(actionId:string,index?:number):number};
type AdapterState={
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  action(id:string):ActionVm|undefined;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
};
type ResolutionState={resolutionId:string;handled:Set<string>};

const states=new WeakMap<MockAdapter,ResolutionState>();
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function stateFor(adapter:MockAdapter,resolutionId:string){
  const current=states.get(adapter);
  if(current?.resolutionId===resolutionId)return current;
  const next={resolutionId,handled:new Set<string>()};
  states.set(adapter,next);
  return next;
}

function warlockLevel(character:CharacterSheet){
  return character.classLevels?.find((entry)=>entry.classId===WARLOCK_ID)?.level??0;
}

function isEligibleFiend(character:CharacterSheet){
  return warlockLevel(character)>=6
    && character.subclassIds?.[WARLOCK_ID]===WARLOCK_FIEND_SUBCLASS_ID
    && Boolean(character.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current);
}

function rollD10(adapter:MockAdapter){
  const face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID);
  return ((face-1)%10)+1;
}

function seedResource(adapter:MockAdapter,internal:AdapterState){
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID);
  if(!state||!combatant||!resource)return state;
  if(combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({
    id:resource.id,
    label:resource.label,
    current:resource.current,
    maximum:resource.max,
    recovery:resource.recovery?structuredClone(resource.recovery):undefined,
  });
  const expected=state.revision;
  state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)
    ? snapshotAdapterTurnRuntimeState(adapter,internal.scene)
    : undefined;
}

function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;
  if(!resolution||resolution.interrupt||!isEligibleFiend(internal.activeCharacter))return;
  const state=stateFor(adapter,resolution.id);
  if(
    resolution.rollKind==="check"
    && resolution.stage==="complete"
    && resolution.actorId===internal.activeCharacter.id
    && Number.isFinite(resolution.rollTotal)
    && Number.isFinite(resolution.checkTarget)
    && !state.handled.has("check")
  ){
    resolution.interrupt={
      id:INTERRUPT_ID,
      responderId:resolution.actorId,
      responderName:internal.activeCharacter.name,
      trigger:`능력 판정 ${resolution.rollTotal} vs DC ${resolution.checkTarget}`,
      optionName:"어둠의 존재의 행운 d10",
      cost:"사용 횟수 1회",
      effect:"d10을 판정 총합에 더합니다.",
      source:"SRD 5.2.1 · Fiend Patron · Dark One's Own Luck",
    };
    resolution.stage="interrupt";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    return;
  }
  if(resolution.rollKind!=="save"||resolution.stage!=="save-result")return;
  const save=resolution.saveResults.find((entry)=>entry.targetId===internal.activeCharacter.id&&!state.handled.has(`save:${entry.targetId}`));
  if(!save)return;
  resolution.interrupt={
    id:INTERRUPT_ID,
    responderId:save.targetId,
    responderName:save.targetName,
    trigger:`${save.targetName} 내성 ${save.total} vs DC ${save.dc}`,
    optionName:"어둠의 존재의 행운 d10",
    cost:"사용 횟수 1회",
    effect:"d10을 내성 굴림 총합에 더합니다.",
    source:"SRD 5.2.1 · Fiend Patron · Dark One's Own Luck",
  };
  resolution.stage="interrupt";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
}

function restoreSaveStage(internal:AdapterState,resolution:ResolutionView){
  const action=internal.action(resolution.actionId);
  resolution.stage="save-result";
  resolution.canAdvance=true;
  resolution.nextLabel=action?.damage?.length?"피해 굴림":"적용";
}

MockAdapter.prototype.resolveAction=async function resolveWithFiendDarkOnesOwnLuck(actionId:string,targetIds:string[]){
  await previousResolveAction.call(this,actionId,targetIds);
  offer(this,this as unknown as AdapterState);
  return this.getSnapshot();
};

MockAdapter.prototype.advanceResolution=async function advanceWithFiendDarkOnesOwnLuck(){
  await previousAdvanceResolution.call(this);
  offer(this,this as unknown as AdapterState);
  return this.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToFiendDarkOnesOwnLuck(accept:boolean){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const interrupt=resolution?.interrupt;
  if(!resolution||interrupt?.id!==INTERRUPT_ID){
    await previousRespondToInterrupt.call(this,accept);
    offer(this,internal);
    return this.getSnapshot();
  }

  const state=stateFor(this,resolution.id);
  const checkFamily=resolution.rollKind==="check";
  const save=checkFamily?undefined:resolution.saveResults.find((entry)=>entry.targetId===interrupt.responderId);
  const handledKey=checkFamily?"check":`save:${interrupt.responderId}`;
  state.handled.add(handledKey);

  if(!accept){
    resolution.detail.push(`${interrupt.responderName} 어둠의 존재의 행운 사용 안 함`);
    resolution.interrupt=undefined;
    if(checkFamily){
      resolution.stage="complete";
      resolution.canAdvance=false;
      resolution.nextLabel=undefined;
    }else{
      restoreSaveStage(internal,resolution);
    }
    offer(this,internal);
    return this.getSnapshot();
  }

  const initial=checkFamily?resolution.rollTotal:save?.total;
  const target=checkFamily?resolution.checkTarget:save?.dc;
  const runtime=seedResource(this,internal);
  if(!runtime||initial===undefined||target===undefined)return this.getSnapshot();
  const face=rollD10(this);
  const committed=resolveFiendDarkOnesOwnLuck(SIMPLEVTT_APP_RULES_PROFILE,runtime,{
    id:`${resolution.id}:dark-ones-own-luck`,
    actorId:internal.activeCharacter.id,
    expectedRevision:runtime.revision,
    warlockLevel:warlockLevel(internal.activeCharacter),
    subclassId:internal.activeCharacter.subclassIds?.[WARLOCK_ID],
    family:checkFamily?"ability-check":"saving-throw",
    initialTotal:initial,
    target,
    d10Face:face,
  });
  if(committed.status==="rejected"||!committed.check)return this.getSnapshot();

  const projected=applyResolutionEvents(
    internal.scene,
    committed.events,
    internal.activeCharacter.resources,
    internal.activeCharacter.items,
    runtime,
  );
  if(projected.status==="rejected")return this.getSnapshot();
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if(writeBack.status==="rejected")return this.getSnapshot();
  if(!commitAdapterTurnRuntimeState(this,internal.scene,runtime.revision,committed.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return this.getSnapshot();
  }

  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  projectAdapterTurnRuntime(this);
  resolution.authoritativeDice.push(face);
  resolution.stateChanges.push(...projected.stateChanges);
  resolution.detail.push(`어둠의 존재의 행운 d10: ${face} · ${initial} → ${committed.check.finalTotal} · ${committed.check.outcome==="success"?"성공":"실패"} · 1회 소모`);
  resolution.interrupt=undefined;

  if(checkFamily){
    resolution.rollTotal=committed.check.finalTotal;
    resolution.checkOutcome=committed.check.outcome==="success"?"성공":"실패";
    resolution.compact=`${resolution.rollTotal} vs DC ${target} · ${resolution.checkOutcome}`;
    resolution.calculatedOutcome=resolution.compact;
    resolution.finalOutcome=resolution.checkOutcome;
    resolution.stage="complete";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    const history=runtimeResolutionEventHistories.get(this);
    runtimeResolutionEventHistories.set(this,{
      resolutionId:resolution.id,
      events:[...(history?.resolutionId===resolution.id?history.events:[]),...committed.events],
    });
    const activity=internal.activity.find((entry)=>entry.id===resolution.id);
    if(activity){
      activity.summary=resolution.compact;
      activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];
      activity.stateChanges=[...resolution.stateChanges];
    }
  }else if(save){
    save.total=committed.check.finalTotal;
    save.outcome=committed.check.outcome==="success"?"성공":"실패";
    const action=internal.action(resolution.actionId);
    resolution.compact=`${action?.saveAbility??"내성"} DC ${save.dc} · ${resolution.saveResults.filter((entry)=>entry.outcome==="성공").length} 성공 / ${resolution.saveResults.filter((entry)=>entry.outcome==="실패").length} 실패`;
    appendAdapterInterruptEvents(this,resolution.id,committed.events);
    restoreSaveStage(internal,resolution);
  }

  internal.syncChar();
  offer(this,internal);
  return this.getSnapshot();
};
