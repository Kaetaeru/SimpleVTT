import type { AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { consumableD20BonusEffectFor, resolveConsumeD20BonusEffect } from "../domain/consumableD20BonusEffect";

export const CONSUMABLE_D20_BONUS_INTERRUPT_ID="follow-up.effect-d20-bonus";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;getSnapshot():Promise<AppSnapshot>}
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function rollDie(adapter:MockAdapter,sides:number){const limit=Math.floor(20/sides)*sides;let face:number;do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,CONSUMABLE_D20_BONUS_INTERRUPT_ID);}while(face>limit);return((face-1)%sides)+1;}
function effectLabel(metadata:Record<string,string|number|boolean>|undefined){return typeof metadata?.displayName==="string"?metadata.displayName:"추가 주사위";}
function offer(adapter:MockAdapter,internal:AdapterState){const resolution=internal.resolution;if(!resolution||resolution.stage!=="attack-result"||resolution.attackOutcome!=="빗나감"||resolution.attackTotal===undefined||resolution.targetAc===undefined)return;const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const effect=state&&consumableD20BonusEffectFor(state,resolution.actorId,"attack-roll");const sides=Number(effect?.metadata?.dieSides);if(!effect||!Number.isInteger(sides)||sides<2||sides>20)return;const actor=internal.scene.entities.find((entry)=>entry.id===resolution.actorId);if(!actor)return;const label=effectLabel(effect.metadata);resolution.interrupt={id:CONSUMABLE_D20_BONUS_INTERRUPT_ID,responderId:actor.id,responderName:actor.name,trigger:`공격 굴림 ${resolution.attackTotal} vs AC ${resolution.targetAc} 실패`,optionName:`${label} d${sides}`,cost:`${label} 효과 소모`,effect:"주사위를 굴려 공격 총합에 더합니다.",source:effect.sourceId};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;}

MockAdapter.prototype.advanceResolution=async function advanceWithConsumableD20BonusEffect(){
  const internal=this as unknown as AdapterState;
  await previousAdvanceResolution.call(this);
  offer(this,internal);
  return this.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToConsumableD20BonusEffect(accept:boolean){
  const internal=this as unknown as AdapterState;const resolution=internal.resolution;const interrupt=resolution?.interrupt;if(!resolution||interrupt?.id!==CONSUMABLE_D20_BONUS_INTERRUPT_ID)return previousRespondToInterrupt.call(this,accept);
  if(!accept){resolution.detail.push(`${interrupt.responderName} ${interrupt.optionName} 사용 안 함`);resolution.interrupt=undefined;resolution.stage="attack-result";resolution.canAdvance=true;resolution.nextLabel="판정 적용";return this.getSnapshot();}
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);const effect=state&&consumableD20BonusEffectFor(state,resolution.actorId,"attack-roll");const sides=Number(effect?.metadata?.dieSides);const naturalFace=resolution.authoritativeDice[0];if(!state||!effect||!Number.isInteger(sides)||sides<2||sides>20||naturalFace===undefined||resolution.attackTotal===undefined||resolution.targetAc===undefined)return this.getSnapshot();
  const face=rollDie(this,sides);const committed=resolveConsumeD20BonusEffect(SIMPLEVTT_APP_RULES_PROFILE,state,{id:`${resolution.id}:d20-bonus`,actorId:resolution.actorId,expectedRevision:state.revision,family:"attack-roll",naturalFace,failedTotal:resolution.attackTotal,target:resolution.targetAc,dieFace:face,effectId:effect.id});if(committed.status==="rejected"||!committed.test)return this.getSnapshot();
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected"||!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state))return this.getSnapshot();internal.scene=projected.scene;appendAdapterInterruptEvents(this,resolution.id,committed.events);projectAdapterTurnRuntime(this);
  const label=effectLabel(effect.metadata);resolution.authoritativeDice.push(face);resolution.rollModifierContributions=[...(resolution.rollModifierContributions??[]),{source:effect.sourceId,value:face}];resolution.attackTotal=committed.test.total;resolution.rollTotal=committed.test.total;resolution.attackOutcome=committed.test.outcome==="success"?"명중":"빗나감";resolution.compact=`${committed.test.total-face} + d${sides} ${face} = ${committed.test.total} vs AC ${committed.test.target} — ${resolution.attackOutcome}`;resolution.calculatedOutcome=resolution.compact;resolution.finalOutcome=resolution.compact;resolution.detail.push(`${label} d${sides}: ${face} · 효과 소모`);resolution.stateChanges.push(...projected.stateChanges);resolution.interrupt=undefined;
  if(resolution.attackOutcome==="명중"){resolution.stage="roll-animation";resolution.rollKind="attack";resolution.canAdvance=true;resolution.nextLabel="명중 결과";return previousAdvanceResolution.call(this);}
  resolution.stage="attack-result";resolution.canAdvance=true;resolution.nextLabel="판정 적용";return this.getSnapshot();
};
