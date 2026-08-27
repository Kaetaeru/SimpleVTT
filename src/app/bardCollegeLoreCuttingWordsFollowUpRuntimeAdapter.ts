import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { previewRuntimeAtomicAttackDamage } from "./phase09RealRuntimeAttackAdapter";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { queueAtomicAttackDamageReduction } from "./realAttackTransactionService";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import {
  commitAdapterTurnRuntimeState,
  ensureAdapterTurnRuntimeState,
  snapshotAdapterTurnRuntimeState,
} from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { projectedCharacterById, projectedCharacterIds } from "./characterSessionProjectionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { BARDIC_INSPIRATION_RESOURCE_ID, bardicInspirationDieSides } from "../domain/bardicInspiration";
import {
  BARD_COLLEGE_LORE_SUBCLASS_ID,
  LORE_CUTTING_WORDS_SOURCE,
  resolveLoreCuttingWords,
  type CuttingWordsTrigger,
} from "../domain/bardCollegeLore";
import { BARD_LORE_CLASS_ID } from "../domain/bardLoreProgression";

export const CUTTING_WORDS_INTERRUPT_ID="follow-up.bard.college-of-lore.cutting-words";
type DicePrototype={d20(actionId:string,index?:number):number};
type TriggerKind=CuttingWordsTrigger["kind"];
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
type OfferedTrigger={kind:TriggerKind;targetActorId:string;total:number;target?:number};
type ResolutionState={resolutionId:string;handled:Set<TriggerKind>;used:boolean;offered?:OfferedTrigger};

const states=new WeakMap<MockAdapter,ResolutionState>();
const pendingAttackPenalty=new WeakMap<MockAdapter,{resolutionId:string;reduction:number}>();
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function stateFor(adapter:MockAdapter,resolutionId:string){
  const current=states.get(adapter);
  if(current?.resolutionId===resolutionId)return current;
  const next:ResolutionState={resolutionId,handled:new Set<TriggerKind>(),used:false};
  states.set(adapter,next);
  return next;
}

function bardLevel(character:CharacterSheet){
  return character.classLevels?.find((entry)=>entry.classId===BARD_LORE_CLASS_ID)?.level??0;
}

function eligibleCharacter(internal:AdapterState,character:CharacterSheet){
  const resource=character.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID);
  if(
    bardLevel(character)<3
    || character.subclassIds?.[BARD_LORE_CLASS_ID]!==BARD_COLLEGE_LORE_SUBCLASS_ID
    || !resource?.current
  )return false;
  return internal.sessionMode!=="initiative"||Boolean(internal.scene.economyByActor[character.id]?.reaction);
}

function responderCandidates(adapter:MockAdapter,internal:AdapterState){
  const candidates=[internal.activeCharacter];
  for(const characterId of projectedCharacterIds(adapter)){
    if(characterId===internal.activeCharacter.id)continue;
    const mounted=projectedCharacterById(adapter,characterId);
    if(mounted)candidates.push(mounted.sheet);
  }
  return candidates;
}

function responderCharacter(adapter:MockAdapter,internal:AdapterState,characterId:string){
  if(characterId===internal.activeCharacter.id)return internal.activeCharacter;
  return projectedCharacterById(adapter,characterId)?.sheet;
}

function rollInspirationDie(adapter:MockAdapter,sides:number){
  const limit=Math.floor(20/sides)*sides;
  let face:number;
  do{
    face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,CUTTING_WORDS_INTERRUPT_ID);
  }while(face>limit);
  return ((face-1)%sides)+1;
}

function seedResource(adapter:MockAdapter,internal:AdapterState,character:CharacterSheet){
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){
    ensureAdapterTurnRuntimeState(adapter,internal.scene);
    state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  }
  const combatant=state?.combatants[character.id];
  const resource=character.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID);
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

function spatiallyEligible(internal:AdapterState,responderId:string,targetActorId:string){
  if(targetActorId===responderId)return undefined;
  if(!internal.scene.entities.some((entry)=>entry.id===targetActorId))return undefined;
  const fact=resolveRuntimeTargetingFact(internal.scene,responderId,targetActorId);
  return fact.distanceFeet<=60&&fact.visible?fact:undefined;
}

function offerInterrupt(adapter:MockAdapter,internal:AdapterState,trigger:OfferedTrigger,responder:CharacterSheet){
  const resolution=internal.resolution;
  if(!resolution)return false;
  const state=stateFor(adapter,resolution.id);
  if(state.used||state.handled.has(trigger.kind)||!eligibleCharacter(internal,responder)||!spatiallyEligible(internal,responder.id,trigger.targetActorId))return false;
  const targetName=internal.scene.entities.find((entry)=>entry.id===trigger.targetActorId)?.name??trigger.targetActorId;
  const sides=bardicInspirationDieSides(bardLevel(responder));
  state.offered=trigger;
  if(trigger.kind==="damage-roll")resolution.rollKind="damage";
  resolution.interrupt={
    id:CUTTING_WORDS_INTERRUPT_ID,
    responderId:responder.id,
    responderName:responder.name,
    trigger:trigger.kind==="damage-roll"
      ? `${targetName} 피해 굴림 ${trigger.total}`
      : `${targetName} ${trigger.kind==="attack-roll"?"공격":"능력 판정"} ${trigger.total} vs ${trigger.target}`,
    optionName:`도발의 말 d${sides}`,
    cost:`${internal.sessionMode==="initiative"?"반응 1 + ":""}바드의 영감 1회`,
    effect:`d${sides}만큼 대상 굴림을 감소시킵니다.`,
    source:"SRD 5.2.1 · College of Lore · Cutting Words",
  };
  resolution.stage="interrupt";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  return true;
}

function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;
  if(!resolution||resolution.interrupt)return false;
  const state=stateFor(adapter,resolution.id);
  if(state.used)return false;

  let trigger:OfferedTrigger|undefined;
  if(
    resolution.rollKind==="check"
    && resolution.stage==="complete"
    && resolution.checkOutcome==="성공"
    && Number.isFinite(resolution.rollTotal)
    && Number.isFinite(resolution.checkTarget)
  ){
    trigger={
      kind:"ability-check",
      targetActorId:resolution.actorId,
      total:resolution.rollTotal!,
      target:resolution.checkTarget!,
    };
  }else if(
    resolution.rollKind==="attack"
    && resolution.stage==="attack-result"
    && resolution.attackOutcome==="명중"
    && Number.isFinite(resolution.attackTotal)
    && Number.isFinite(resolution.targetAc)
  ){
    if(!state.handled.has("attack-roll")){
      trigger={
        kind:"attack-roll",
        targetActorId:resolution.actorId,
        total:resolution.attackTotal!,
        target:resolution.targetAc!,
      };
    }else if(!state.handled.has("damage-roll")){
      const preview=previewRuntimeAtomicAttackDamage(adapter);
      if(preview)trigger={
        kind:"damage-roll",
        targetActorId:resolution.actorId,
        total:preview.total,
      };
    }
  }
  if(!trigger)return false;

  for(const responder of responderCandidates(adapter,internal)){
    if(resolution.actorId===responder.id)continue;
    if(offerInterrupt(adapter,internal,trigger,responder))return true;
  }
  return false;
}

function restoreStage(resolution:ResolutionView,kind:TriggerKind){
  resolution.interrupt=undefined;
  if(kind==="ability-check"){
    resolution.stage="complete";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    return;
  }
  resolution.stage="attack-result";
  resolution.rollKind="attack";
  resolution.canAdvance=true;
  resolution.nextLabel=kind==="damage-roll"?"피해 적용":"판정 적용";
}

function refreshActivity(internal:AdapterState,resolution:ResolutionView){
  const activity=internal.activity.find((entry)=>entry.id===resolution.id);
  if(!activity)return;
  activity.summary=resolution.compact;
  const detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];
  for(const entry of detail)if(!activity.detail.includes(entry))activity.detail.push(entry);
  for(const entry of resolution.stateChanges)if(!activity.stateChanges.includes(entry))activity.stateChanges.push(entry);
}

MockAdapter.prototype.resolveAction=async function resolveWithLoreCuttingWords(actionId:string,targetIds:string[]){
  await previousResolveAction.call(this,actionId,targetIds);
  offer(this,this as unknown as AdapterState);
  return this.getSnapshot();
};

MockAdapter.prototype.advanceResolution=async function advanceWithLoreCuttingWords(){
  const internal=this as unknown as AdapterState;
  if(internal.resolution?.interrupt?.id===CUTTING_WORDS_INTERRUPT_ID)return internal.getSnapshot();
  if(offer(this,internal))return internal.getSnapshot();

  const pending=pendingAttackPenalty.get(this);
  const resolution=internal.resolution;
  const action=resolution&&internal.action(resolution.actionId);
  if(pending&&resolution?.id===pending.resolutionId&&resolution.stage==="attack-result"&&action?.attackBonus!==undefined){
    const original=action.attackBonus;
    action.attackBonus-=pending.reduction;
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
  if(resolution?.stage==="complete"&&states.get(this)?.used)refreshActivity(internal,resolution);
  return this.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToLoreCuttingWords(accept:boolean){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const interrupt=resolution?.interrupt;
  const state=resolution?stateFor(this,resolution.id):undefined;
  const offered=state?.offered;
  if(!resolution||interrupt?.id!==CUTTING_WORDS_INTERRUPT_ID||!state||!offered){
    await previousRespondToInterrupt.call(this,accept);
    offer(this,internal);
    return this.getSnapshot();
  }

  const responder=responderCharacter(this,internal,interrupt.responderId);
  state.offered=undefined;
  if(!accept){
    state.handled.add(offered.kind);
    resolution.detail.push(`${interrupt.responderName} 도발의 말 사용 안 함`);
    restoreStage(resolution,offered.kind);
    return this.getSnapshot();
  }
  if(!responder)return this.getSnapshot();

  const fact=spatiallyEligible(internal,responder.id,offered.targetActorId);
  const runtime=seedResource(this,internal,responder);
  if(!fact||!runtime)return this.getSnapshot();
  const sides=bardicInspirationDieSides(bardLevel(responder));
  const face=rollInspirationDie(this,sides);
  const trigger:CuttingWordsTrigger=offered.kind==="damage-roll"
    ? {kind:"damage-roll",total:offered.total}
    : {kind:offered.kind,total:offered.total,target:offered.target!};
  const committed=resolveLoreCuttingWords(SIMPLEVTT_APP_RULES_PROFILE,runtime,{
    id:`${resolution.id}:cutting-words`,
    actorId:responder.id,
    expectedRevision:runtime.revision,
    bardLevel:bardLevel(responder),
    subclassId:responder.subclassIds?.[BARD_LORE_CLASS_ID],
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
    responder.resources,
    responder.items,
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
  if(responder.id===internal.activeCharacter.id){
    internal.activeCharacter.resources=projected.resources;
    internal.activeCharacter.items=projected.items;
  }
  projectAdapterTurnRuntime(this);
  state.handled.add(offered.kind);
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
    const effectiveReduction=committed.adjustment.originalTotal-committed.adjustment.adjustedTotal;
    resolution.attackTotal=committed.adjustment.adjustedTotal;
    resolution.rollTotal=committed.adjustment.adjustedTotal;
    resolution.attackOutcome=committed.adjustment.outcome==="success"?"명중":"빗나감";
    resolution.compact=`${committed.adjustment.originalTotal} - d${sides} ${face} = ${committed.adjustment.adjustedTotal} vs AC ${offered.target} — ${resolution.attackOutcome}`;
    resolution.calculatedOutcome=resolution.compact;
    resolution.finalOutcome=resolution.compact;
    appendAdapterInterruptEvents(this,resolution.id,committed.events);
    pendingAttackPenalty.set(this,{resolutionId:resolution.id,reduction:effectiveReduction});
    restoreStage(resolution,"attack-roll");
  }else{
    appendAdapterInterruptEvents(this,resolution.id,committed.events);
    queueAtomicAttackDamageReduction(
      resolution.id,
      committed.adjustment.originalTotal-committed.adjustment.adjustedTotal,
      LORE_CUTTING_WORDS_SOURCE,
    );
    restoreStage(resolution,"damage-roll");
  }

  if(responder.id===internal.activeCharacter.id)internal.syncChar();
  return this.getSnapshot();
};
