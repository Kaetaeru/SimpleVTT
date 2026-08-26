import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { BARDIC_INSPIRATION_RESOURCE_ID, bardicInspirationDieSides } from "../domain/bardicInspiration";
import { BARD_COLLEGE_LORE_SUBCLASS_ID, resolveLorePeerlessSkill } from "../domain/bardCollegeLore";
import { BARD_LORE_CLASS_ID } from "../domain/bardLoreProgression";

const INTERRUPT_ID="follow-up.bard.college-of-lore.peerless-skill";
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
const pendingAttackBonus=new WeakMap<MockAdapter,{resolutionId:string;face:number}>();
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

function bardLevel(character:CharacterSheet){
  return character.classLevels?.find((entry)=>entry.classId===BARD_LORE_CLASS_ID)?.level??0;
}

function isEligibleLoreBard(character:CharacterSheet){
  return bardLevel(character)>=14
    && character.subclassIds?.[BARD_LORE_CLASS_ID]===BARD_COLLEGE_LORE_SUBCLASS_ID
    && Boolean(character.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current);
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
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
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

function offer(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;
  if(!resolution||resolution.interrupt||!isEligibleLoreBard(internal.activeCharacter))return;
  const state=stateFor(adapter,resolution.id);
  const sides=bardicInspirationDieSides(bardLevel(internal.activeCharacter));

  if(
    resolution.rollKind==="check"
    && resolution.stage==="complete"
    && resolution.actorId===internal.activeCharacter.id
    && resolution.checkOutcome==="실패"
    && Number.isFinite(resolution.rollTotal)
    && Number.isFinite(resolution.checkTarget)
    && !state.handled.has("check")
  ){
    resolution.interrupt={
      id:INTERRUPT_ID,
      responderId:resolution.actorId,
      responderName:internal.activeCharacter.name,
      trigger:`능력 판정 ${resolution.rollTotal} vs DC ${resolution.checkTarget} 실패`,
      optionName:`비할 데 없는 기술 d${sides}`,
      cost:"성공으로 바뀌면 바드의 영감 1회",
      effect:`d${sides}을 판정 총합에 더합니다. 실패가 유지되면 영감을 소비하지 않습니다.`,
      source:"SRD 5.2.1 · College of Lore · Peerless Skill",
    };
    resolution.stage="interrupt";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    return;
  }

  if(
    resolution.rollKind==="attack"
    && resolution.stage==="attack-result"
    && resolution.actorId===internal.activeCharacter.id
    && resolution.attackOutcome==="빗나감"
    && Number.isFinite(resolution.attackTotal)
    && Number.isFinite(resolution.targetAc)
    && internal.action(resolution.actionId)?.attackBonus!==undefined
    && !state.handled.has("attack")
  ){
    resolution.interrupt={
      id:INTERRUPT_ID,
      responderId:resolution.actorId,
      responderName:internal.activeCharacter.name,
      trigger:`공격 굴림 ${resolution.attackTotal} vs AC ${resolution.targetAc} 실패`,
      optionName:`비할 데 없는 기술 d${sides}`,
      cost:"성공으로 바뀌면 바드의 영감 1회",
      effect:`d${sides}을 공격 총합에 더합니다. 실패가 유지되면 영감을 소비하지 않습니다.`,
      source:"SRD 5.2.1 · College of Lore · Peerless Skill",
    };
    resolution.stage="interrupt";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
  }
}

function restoreFailedStage(internal:AdapterState,resolution:ResolutionView,family:"ability-check"|"attack-roll"){
  resolution.interrupt=undefined;
  if(family==="ability-check"){
    resolution.stage="complete";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    return;
  }
  resolution.stage="attack-result";
  resolution.canAdvance=true;
  resolution.nextLabel="판정 적용";
}

function refreshPeerlessAttackActivity(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;
  const state=states.get(adapter);
  if(!resolution||resolution.stage!=="complete"||state?.resolutionId!==resolution.id||!state.handled.has("attack"))return;
  const activity=internal.activity.find((entry)=>entry.id===resolution.id);
  if(!activity)return;
  activity.summary=resolution.compact;
  activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];
  activity.stateChanges=[...resolution.stateChanges];
}

MockAdapter.prototype.resolveAction=async function resolveWithLorePeerlessSkill(actionId:string,targetIds:string[]){
  await previousResolveAction.call(this,actionId,targetIds);
  offer(this,this as unknown as AdapterState);
  return this.getSnapshot();
};

MockAdapter.prototype.advanceResolution=async function advanceWithLorePeerlessSkill(){
  const internal=this as unknown as AdapterState;
  const pending=pendingAttackBonus.get(this);
  const resolution=internal.resolution;
  const action=resolution&&internal.action(resolution.actionId);
  if(pending&&resolution?.id===pending.resolutionId&&resolution.stage==="attack-result"&&action?.attackBonus!==undefined){
    const original=action.attackBonus;
    action.attackBonus+=pending.face;
    try{
      await previousAdvanceResolution.call(this);
    }finally{
      action.attackBonus=original;
      pendingAttackBonus.delete(this);
    }
  }else{
    await previousAdvanceResolution.call(this);
  }
  offer(this,internal);
  refreshPeerlessAttackActivity(this,internal);
  return this.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToLorePeerlessSkill(accept:boolean){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const interrupt=resolution?.interrupt;
  if(!resolution||interrupt?.id!==INTERRUPT_ID){
    await previousRespondToInterrupt.call(this,accept);
    offer(this,internal);
    return this.getSnapshot();
  }

  const family=resolution.rollKind==="check"?"ability-check":"attack-roll";
  const handledKey=family==="ability-check"?"check":"attack";
  stateFor(this,resolution.id).handled.add(handledKey);

  if(!accept){
    resolution.detail.push(`${interrupt.responderName} 비할 데 없는 기술 사용 안 함`);
    restoreFailedStage(internal,resolution,family);
    return this.getSnapshot();
  }

  const initial=family==="ability-check"?resolution.rollTotal:resolution.attackTotal;
  const target=family==="ability-check"?resolution.checkTarget:resolution.targetAc;
  const runtime=seedResource(this,internal);
  if(!runtime||initial===undefined||target===undefined)return this.getSnapshot();
  const sides=bardicInspirationDieSides(bardLevel(internal.activeCharacter));
  const face=rollInspirationDie(this,sides);
  const committed=resolveLorePeerlessSkill(SIMPLEVTT_APP_RULES_PROFILE,runtime,{
    id:`${resolution.id}:peerless-skill`,
    actorId:internal.activeCharacter.id,
    expectedRevision:runtime.revision,
    bardLevel:bardLevel(internal.activeCharacter),
    subclassId:internal.activeCharacter.subclassIds?.[BARD_LORE_CLASS_ID],
    kind:family,
    failedTotal:initial,
    target,
    inspirationDieFace:face,
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
  resolution.detail.push(`비할 데 없는 기술 d${sides}: ${face} · ${initial} → ${committed.check.finalTotal} · ${committed.check.outcome==="success"?"성공":"실패"}${committed.check.inspirationExpended?" · 바드의 영감 1회 소모":" · 영감 유지"}`);
  resolution.interrupt=undefined;

  if(family==="ability-check"){
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
  }else{
    resolution.attackTotal=committed.check.finalTotal;
    resolution.rollTotal=committed.check.finalTotal;
    resolution.attackOutcome=committed.check.outcome==="success"?"명중":"빗나감";
    resolution.compact=`${committed.check.initialTotal} + d${sides} ${face} = ${committed.check.finalTotal} vs AC ${committed.check.target} — ${resolution.attackOutcome}`;
    resolution.calculatedOutcome=resolution.compact;
    resolution.finalOutcome=resolution.compact;
    appendAdapterInterruptEvents(this,resolution.id,committed.events);
    if(committed.check.outcome==="success"){
      pendingAttackBonus.set(this,{resolutionId:resolution.id,face});
      resolution.stage="roll-animation";
      resolution.rollKind="attack";
      resolution.canAdvance=true;
      resolution.nextLabel="명중 결과";
      internal.syncChar();
      await previousAdvanceResolution.call(this);
      return this.getSnapshot();
    }
    restoreFailedStage(internal,resolution,"attack-roll");
  }

  internal.syncChar();
  return this.getSnapshot();
};
