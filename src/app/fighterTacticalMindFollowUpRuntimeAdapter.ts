import "./progressionContracts";
import type { ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { FIGHTER_ID, FIGHTER_SECOND_WIND_RESOURCE_ID } from "../domain/coreClassResources";
import { compileFighterTacticalMind } from "../domain/fighterTacticalMind";
import { resolvePendingResolution } from "../domain/resolution";

const INTERRUPT_ID="follow-up.fighter.tactical-mind";
const STABILIZE_ACTION_ID="action.standard.stabilize";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];syncChar():void;getSnapshot():Promise<AppSnapshot>}
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const handled=new WeakMap<MockAdapter,Set<string>>();

function fighterLevel(character:CharacterSheet){return character.classLevels?.find((entry)=>entry.classId===FIGHTER_ID)?.level??0;}
function rollD10(adapter:MockAdapter){let face:number;do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,INTERRUPT_ID);}while(face>20);return((face-1)%10)+1;}
function seedSecondWind(adapter:MockAdapter,internal:AdapterState){const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const combatant=state?.combatants[internal.activeCharacter.id];const resource=internal.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID);if(!state||!combatant||!resource)return;const existing=combatant.resources.find((entry)=>entry.id===resource.id);if(existing)return state;combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});const expected=state.revision;state.revision+=1;return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;}
function offer(adapter:MockAdapter,internal:AdapterState){const resolution=internal.resolution;const level=fighterLevel(internal.activeCharacter);const resource=internal.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID);if(!resolution||handled.get(adapter)?.has(resolution.id)||resolution.rollKind!=="check"||resolution.stage!=="complete"||resolution.checkOutcome!=="실패"||!Number.isFinite(resolution.checkTarget)||level<2||!resource?.current||resolution.actorId!==internal.activeCharacter.id)return;resolution.interrupt={id:INTERRUPT_ID,responderId:resolution.actorId,responderName:internal.activeCharacter.name,trigger:`능력 판정 ${resolution.rollTotal} vs DC ${resolution.checkTarget} 실패`,optionName:"전술적 정신 d10",cost:"성공 시 재기의 바람 1회",effect:"d10을 더합니다. 그래도 실패하면 사용 횟수를 소모하지 않습니다.",source:"SRD 5.2.1 · Fighter Tactical Mind"};resolution.stage="interrupt";resolution.canAdvance=false;resolution.nextLabel=undefined;}

function markHandled(adapter:MockAdapter,resolutionId:string){const ids=handled.get(adapter)??new Set<string>();ids.add(resolutionId);handled.set(adapter,ids);}

MockAdapter.prototype.resolveAction=async function resolveWithTacticalMindOffer(actionId:string,targetIds:string[]){const snapshot=await previousResolveAction.call(this,actionId,targetIds);offer(this,this as unknown as AdapterState);return this.getSnapshot();};

MockAdapter.prototype.respondToInterrupt=async function respondToTacticalMind(accept:boolean){
  const internal=this as unknown as AdapterState;const resolution=internal.resolution;const interrupt=resolution?.interrupt;if(!resolution||interrupt?.id!==INTERRUPT_ID)return previousRespondToInterrupt.call(this,accept);
  if(!accept){markHandled(this,resolution.id);resolution.detail.push(`${interrupt.responderName} 전술적 정신 사용 안 함`);resolution.interrupt=undefined;resolution.stage="complete";resolution.canAdvance=false;return this.getSnapshot();}
  const state=seedSecondWind(this,internal);const level=fighterLevel(internal.activeCharacter);const target=resolution.checkTarget;const initial=resolution.rollTotal;const resource=state?.combatants[resolution.actorId]?.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID);if(!state||!resource?.current||target===undefined||initial===undefined)return this.getSnapshot();
  const face=rollD10(this);const succeeded=initial+face>=target;const request={id:`${resolution.id}:tactical-mind`,actorId:resolution.actorId,expectedRevision:state.revision,fighterLevel:level,failedCheckTotal:initial,target,d10Face:face};const pending=compileFighterTacticalMind(request);if(succeeded&&resolution.actionId===STABILIZE_ACTION_ID&&resolution.targetIds[0])pending.operations.push({id:`${request.id}:stabilize`,kind:"stabilize",targetId:resolution.targetIds[0]});const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,pending);if(committed.status==="rejected")return this.getSnapshot();
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return this.getSnapshot();const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return this.getSnapshot();if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return this.getSnapshot();}
  markHandled(this,resolution.id);internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;projectAdapterTurnRuntime(this);resolution.authoritativeDice.push(face);resolution.rollTotal=initial+face;resolution.checkOutcome=succeeded?"성공":"실패";resolution.compact=`${initial} + d10 ${face} = ${resolution.rollTotal} vs DC ${target} · ${resolution.checkOutcome}`;resolution.calculatedOutcome=resolution.checkOutcome;resolution.finalOutcome=resolution.actionId===STABILIZE_ACTION_ID?`안정화 ${resolution.checkOutcome}`:resolution.checkOutcome;resolution.detail.push(`전술적 정신 d10: ${face}${succeeded?" · 재기의 바람 1회 소모":" · 실패 유지, 사용 횟수 보존"}`);resolution.stateChanges.push(...projected.stateChanges);resolution.interrupt=undefined;resolution.stage="complete";resolution.canAdvance=false;
  const history=runtimeResolutionEventHistories.get(this);runtimeResolutionEventHistories.set(this,{resolutionId:resolution.id,events:[...(history?.resolutionId===resolution.id?history.events:[]),...committed.events]});const activity=internal.activity.find((entry)=>entry.id===resolution.id);if(activity){activity.summary=resolution.compact;activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];activity.stateChanges=[...resolution.stateChanges];}internal.syncChar();return this.getSnapshot();
};
