import type { AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { BARDIC_INSPIRATION_EFFECT_TAG, bardicInspirationEffectForTarget, resolveUseBardicInspiration } from "../domain/bardicInspiration";

const INTERRUPT_ID="follow-up.bardic-inspiration";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;getSnapshot():Promise<AppSnapshot>}
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const pendingAttackBonus=new WeakMap<MockAdapter,{resolutionId:string;face:number}>();

function rollDie(adapter:MockAdapter,sides:number){const limit=Math.floor(20/sides)*sides;let face:number;do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID);}while(face>limit);return((face-1)%sides)+1;}
function offer(adapter:MockAdapter,internal:AdapterState){const resolution=internal.resolution;if(!resolution||resolution.stage!=="attack-result"||resolution.attackOutcome!=="빗나감"||resolution.attackTotal===undefined||resolution.targetAc===undefined)return;const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const effect=state&&bardicInspirationEffectForTarget(state,resolution.actorId);const sides=Number(effect?.metadata?.dieSides);if(!effect||![6,8,10,12].includes(sides))return;const actor=internal.scene.entities.find((entry)=>entry.id===resolution.actorId);if(!actor)return;resolution.interrupt={id:INTERRUPT_ID,responderId:actor.id,responderName:actor.name,trigger:`공격 굴림 ${resolution.attackTotal} vs AC ${resolution.targetAc} 실패`,optionName:`바드의 영감 d${sides}`,cost:"보유한 영감 주사위 1개",effect:"주사위를 굴려 공격 총합에 더합니다.",source:"SRD 5.2.1 · Bardic Inspiration"};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;}

MockAdapter.prototype.advanceResolution=async function advanceWithBardicInspirationFollowUp(){
  const internal=this as unknown as AdapterState;const bonus=pendingAttackBonus.get(this);const resolution=internal.resolution;const action=resolution&&Object.values(internal.scene.actionsByActor).flat().find((entry)=>entry.id===resolution.actionId);
  if(bonus&&resolution?.id===bonus.resolutionId&&resolution.stage==="attack-result"&&action?.attackBonus!==undefined){const original=action.attackBonus;action.attackBonus+=bonus.face;try{await previousAdvanceResolution.call(this);}finally{action.attackBonus=original;}pendingAttackBonus.delete(this);}else await previousAdvanceResolution.call(this);
  offer(this,internal);return this.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToBardicInspirationFollowUp(accept:boolean){
  const internal=this as unknown as AdapterState;const resolution=internal.resolution;const interrupt=resolution?.interrupt;if(!resolution||interrupt?.id!==INTERRUPT_ID)return previousRespondToInterrupt.call(this,accept);
  if(!accept){resolution.detail.push(`${interrupt.responderName} 바드의 영감 사용 안 함`);resolution.interrupt=undefined;resolution.stage="attack-result";resolution.canAdvance=true;resolution.nextLabel="판정 적용";return this.getSnapshot();}
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);const effect=state&&bardicInspirationEffectForTarget(state,resolution.actorId);const sides=Number(effect?.metadata?.dieSides);if(!state||!effect||![6,8,10,12].includes(sides)||resolution.attackTotal===undefined||resolution.targetAc===undefined)return this.getSnapshot();
  const face=rollDie(this,sides);const committed=resolveUseBardicInspiration(SIMPLEVTT_APP_RULES_PROFILE,state,{id:`${resolution.id}:bardic-inspiration`,actorId:resolution.actorId,expectedRevision:state.revision,failedTotal:resolution.attackTotal,target:resolution.targetAc,dieFace:face,effectId:effect.id});if(committed.status==="rejected"||!committed.check)return this.getSnapshot();
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected"||!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state))return this.getSnapshot();internal.scene=projected.scene;appendAdapterInterruptEvents(this,resolution.id,committed.events);projectAdapterTurnRuntime(this);
  resolution.authoritativeDice.push(face);resolution.attackTotal=committed.check.finalTotal;resolution.rollTotal=committed.check.finalTotal;resolution.attackOutcome=committed.check.outcome==="success"?"명중":"빗나감";resolution.compact=`${committed.check.initialTotal} + d${sides} ${face} = ${committed.check.finalTotal} vs AC ${committed.check.target} — ${resolution.attackOutcome}`;resolution.calculatedOutcome=resolution.compact;resolution.finalOutcome=resolution.compact;resolution.detail.push(`바드의 영감 d${sides}: ${face} · 영감 주사위 소모`);resolution.stateChanges.push(...projected.stateChanges);resolution.interrupt=undefined;pendingAttackBonus.set(this,{resolutionId:resolution.id,face});
  if(resolution.attackOutcome==="명중"){resolution.stage="roll-animation";resolution.rollKind="attack";resolution.canAdvance=true;resolution.nextLabel="명중 결과";return previousAdvanceResolution.call(this);}
  resolution.stage="attack-result";resolution.canAdvance=true;resolution.nextLabel="판정 적용";return this.getSnapshot();
};
