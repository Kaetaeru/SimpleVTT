import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import {
  consumeAtomicAttackDamagePreview,
  queueAtomicAttackDamageReduction,
} from "./realAttackTransactionService";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import {
  commitAdapterTurnRuntimeState,
  ensureAdapterTurnRuntimeState,
  snapshotAdapterTurnRuntimeState,
} from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { BARDIC_INSPIRATION_RESOURCE_ID, bardicInspirationDieSides } from "../domain/bardicInspiration";
import {
  BARD_COLLEGE_LORE_SUBCLASS_ID,
  LORE_CUTTING_WORDS_SOURCE,
  resolveLoreCuttingWords,
  type CuttingWordsTrigger,
} from "../domain/bardCollegeLore";
import { BARD_LORE_CLASS_ID } from "../domain/bardLoreProgression";

const INTERRUPT_ID="follow-up.bard.college-of-lore.cutting-words";
type DicePrototype={d20(actionId:string,index?:number):number};
type AdapterState={
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  action(id:string):ActionVm|undefined;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
};
type OfferedTrigger={kind:CuttingWordsTrigger["kind"];targetActorId:string;total:number;target?:number};
type ResolutionState={resolutionId:string;handled:Set<string>;used:boolean;offered?:OfferedTrigger};

const states=new WeakMap<MockAdapter,ResolutionState>();
const pendingAttackPenalty=new WeakMap<MockAdapter,{resolutionId:string;face:number}>();
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function stateFor(adapter:MockAdapter,resolutionId:string){
  const current=states.get(adapter);
  if(current?.resolutionId===resolutionId)return current;
  const next:ResolutionState={resolutionId,handled:new Set<string>(),used:false};
  states.set(adapter,next);
  return next;
}

function bardLevel(character:CharacterSheet){
  return character.classLevels?.find((entry)=>entry.classId===BARD_LORE_CLASS_ID)?.level??0;
}

function reactionAvailable(internal:AdapterState){
  return internal.sessionMode!=="initiative"
    || Boolean(internal.scene.economyByActor[internal.activeCharacter.id]?.reaction);
}

function eligible(internal:AdapterState){
  return bardLevel(internal.activeCharacter)>=3
    && internal.activeCharacter.subclassIds?.[BARD_LORE_CLASS_ID]===BARD_COLLEGE_LORE_SUBCLASS_ID
    && Boolean(internal.activeCharacter.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current)
    && reactionAvailable(internal);
}

function rollInspirationDie(adapter:MockAdapter,sides:number){
  const limit=Math.floor(20/sides)*sides;
  let face:number;
  do{
    face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID);
  }while(face>limit);
  return ((face-1)%sides)+1;
}

function seedResource(adapter:MockAdapter,internal:AdapterState){
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){
    ensureAdapterTurnRuntimeState(adapter,internal.scene);
    state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  }
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID);
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

function spatiallyEligible(internal:AdapterState,targetActorId:string){
  if(targetActorId===internal.activeCharacter.id)return undefined;
  if(!internal.scene.entities.some((entry)=>entry.id===targetActorId))return undefined;
  const fact=resolveRuntimeTargetingFact(internal.scene,internal.activeCharacter.id,targetActorId);
  return fact.distanceFeet<=60&&fact.visible?fact:undefined;
}

function offerInterrupt(adapter:MockAdapter,internal:AdapterState,trigger:OfferedTrigger){
  const resolution=internal.resolution;
  if(!resolution)return;
  const state=stateFor(adapter,resolution.id);
  const key=trigger.kind;
  if(state.used||state.handled.has(key)||!eligible(internal)||!spatiallyEligible(internal,trigger.targetActorId))return;
  const targetName=internal.scene.entities.find((entry)=>entry.id===trigger.targetActorId)?.name??trigger.targetActorId;
  const sides=bardicInspirationDieSides(bardLevel(internal.activeCharacter));
  state.offered=trigger;
  resolution.interrupt={
    id:INTERRUPT_ID,
    responderId:internal.activeCharacter.id,
    responderName:internal.activeCharacter.name,
    trigger:trigger.kind==="damage-roll"
      ? `${targetName} 피해 굴림 ${trigger.total}`
      : `${targetName} ${trigger.kind==="attack-roll"?"공격":"능력 판정"} ${trigger.total} vs ${trigger.target}`,
    optionName:`도발의 말 d${sides}`,
    cost:`반응${internal.sessionMode==="initiative"?" 1 · ":" · "}바드의 영감 1회`,
    effect:`d${sides}만큼 대상 굴림을 감소시킵니다.`,
    source:"SRD 5.2.1 · College of Lore · Cutting Words",
  };
  resolution.stage="interrupt";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
}

function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;
  if(!resolution||resolution.interrupt||!eligible(internal))return;
  const state=stateFor(adapter,resolution.id);
  if(state.used)return;

  if(
    resolution.rollKind==="check"
    && resolution.stage==="complete"
    && resolution.actorId!==internal.activeCharacter.id
    && resolution.checkOutcome==="성공"
    && Number.isFinite(resolution.rollTotal)
    && Number.isFinite(resolution.checkTarget)
  ){
    offerInterrupt(adapter,internal,{
      kind:"ability-check",
      targetActorId:resolution.actorId,
      total:resolution.rollTotal!,
      target:resolution.checkTarget!,
    });
    return;
  }

  if(
    resolution.rollKind==="attack"
    && resolution.stage==="attack-result"
    && resolution.actorId!==internal.activeCharacter.id
    && resolution.attackOutcome==="명중"
    && Number.isFinite(resolution.attackTotal)
    && Number.isFinite(resolution.targetAc)
  ){
    offerInterrupt(adapter,internal,{
      kind:"attack-roll",
      targetActorId:resolution.actorId,
      total:resolution.attackTotal!,
      target:resolution.targetAc!,
    });
    return;
  }

  if(
    resolution.rollKind==="damage"
    && resolution.stage==="damage-animation"
    && resolution.actorId!==internal.activeCharacter.id
  ){
    const preview=consumeAtomicAttackDamagePreview(resolution.id);
    if(preview)offerInterrupt(adapter,internal,{
      kind:"damage-roll",
      targetActorId:resolution.actorId,
      total:preview.total,
    });
  }
}

function restoreStage(resolution:ResolutionView,kind:CuttingWordsTrigger["kind"]){
  resolution.interrupt=undefined;
  if(kind==="ability-check"){
    resolution.stage="complete";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
  }else if(kind==="attack-roll"){
    resolution.stage="attack-result";
    resolution.canAdvance=true;
    resolution.nextLabel="판정 적용";
  }else{
    resolution.stage="damage-animation";
    resolution.canAdvance=true;
    resolution.nextLabel="피해 적용";
  }
}

function refreshActivity(internal:AdapterState,resolution:ResolutionView){
  const activity=internal.activity.find((entry)=>entry.id===resolution.id);
  if(!activity)return;
  activity.summary=resolution.compact;
  activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];
  activity.stateChanges=[...resolution.stateChanges];
}

MockAdapter.prototype.resolveAction=async function resolveWithLoreCuttingWords(actionId:string,targetIds:string[]){
  await previousResolveAction.call(this,actionId,targetIds);
  offer(this,this as unknown as AdapterState);
  return this.getSnapshot();
};

MockAdapter.prototype.advanceResolution=async function advanceWithLoreCuttingWords(){
  const internal=this as unknown as AdapterState;
  const pending=pendingAttackPenalty.get(this);
  const resolution=internal.resolution;
  const action=resolution&&internal.action(resolution.actionId);
  if(pending&&resolution?.id===pending.resolutionId&&resolution.stage==="attack-result"&&action?.attackBonus!==undefined){
    const original=action.attackBonus;
    action.attackBonus-=pending.face;
    try{
      await previousAdvanceResolution.call(this);
    }finally{
      action.attackBonus=original;
      pendingAttackPenalty.delete(this);
    }
  }else{
    await previousAdvanceResolution.call(this);
  }
  offer(this,internal);
  return this.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToLoreCuttingWords(accept:boolean){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const interrupt=resolution?.interrupt;
  const state=resolution?stateFor(this,resolution.id):undefined;
  const offered=state?.offered;
  if(!resolution||interrupt?.id!==INTERRUPT_ID||!state||!offered){
    await previousRespondToInterrupt.call(this,accept);
    offer(this,internal);
    return this.getSnapshot();
  }

  state.handled.add(offered.kind);
  state.offered=undefined;
  if(!accept){
    resolution.detail.push(`${interrupt.responderName} 도발의 말 사용 안 함`);
    restoreStage(resolution,offered.kind);
    return this.getSnapshot();
  }

  const fact=spatiallyEligible(internal,offered.targetActorId);
  const runtime=seedResource(this,internal);
  if(!fact||!runtime)return this.getSnapshot();
  const sides=bardicInspirationDieSides(bardLevel(internal.activeCharacter));
  const face=rollInspirationDie(this,sides);
  const trigger:CuttingWordsTrigger=offered.kind==="damage-roll"
    ? {kind:"damage-roll",total:offered.total}
    : {kind:offered.kind,total:offered.total,target:offered.target!};
  const committed=resolveLoreCuttingWords(SIMPLEVTT_APP_RULES_PROFILE,runtime,{
    id:`${resolution.id}:cutting-words`,
    actorId:internal.activeCharacter.id,
    expectedRevision:runtime.revision,
    bardLevel:bardLevel(internal.activeCharacter),
    subclassId:internal.activeCharacter.subclassIds?.[BARD_LORE_CLASS_ID],
    targetActorId:offered.targetActorId,
    distanceFeet:fact.distanceFeet,
    targetVisible:fact.visible,
    trigger,
    inspirationDieFace:face,
    useReaction:internal.sessionMode==="initiative",
  });
  if(committed.status==="rejected"||!committed.adjustment)return this.getSnapshot();

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
  state.used=true;
  resolution.authoritativeDice.push(face);
  resolution.stateChanges.push(...projected.stateChanges);
  resolution.detail.push(`도발의 말 d${sides}: ${face} · ${committed.adjustment.originalTotal} → ${committed.adjustment.adjustedTotal} · 바드의 영감 1회 소모`);
  resolution.interrupt=undefined;

  if(offered.kind==="ability-check"){
    resolution.rollTotal=committed.adjustment.adjustedTotal;
    resolution.checkOutcome=committed.adjustment.outcome==="success"?"성공":"실패";
    resolution.compact=`${resolution.rollTotal} vs DC ${offered.target} · ${resolution.checkOutcome}`;
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
    refreshActivity(internal,resolution);
  }else if(offered.kind==="attack-roll"){
    resolution.attackTotal=committed.adjustment.adjustedTotal;
    resolution.rollTotal=committed.adjustment.adjustedTotal;
    resolution.attackOutcome=committed.adjustment.outcome==="success"?"명중":"빗나감";
    resolution.compact=`${committed.adjustment.adjustedTotal} vs AC ${offered.target} — ${resolution.attackOutcome}`;
    resolution.calculatedOutcome=resolution.compact;
    resolution.finalOutcome=resolution.compact;
    appendAdapterInterruptEvents(this,resolution.id,committed.events);
    pendingAttackPenalty.set(this,{resolutionId:resolution.id,face});
    restoreStage(resolution,"attack-roll");
  }else{
    appendAdapterInterruptEvents(this,resolution.id,committed.events);
    queueAtomicAttackDamageReduction(resolution.id,face,LORE_CUTTING_WORDS_SOURCE);
    resolution.stage="attack-result";
    resolution.rollKind="attack";
    resolution.canAdvance=true;
    resolution.nextLabel="명중 결과";
    await previousAdvanceResolution.call(this);
  }

  internal.syncChar();
  return this.getSnapshot();
};
