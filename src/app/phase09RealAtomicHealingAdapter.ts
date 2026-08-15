import "./phase09RealRuntimeAttackAdapter";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, CharacterSummary, ResolutionView, SceneEntity, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveAtomicSelfHealing } from "./realAtomicHealingTransactionService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { undoResolutionEvents } from "./realEventUndoService";
import type { ResolutionEvent } from "../domain/resolutionTypes";

interface BeforeState {
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
}

interface AtomicHealingAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  syncChar():void;
  resolution:ResolutionView|null;
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  sessionMode:SessionMode;
  activity:ActivityEntry[];
  before:BeforeState|null;
  lastBefore:BeforeState|null;
  lastResolutionId:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

interface HealingEventHistory {
  resolutionId:string;
  events:ResolutionEvent[];
}

const histories=new WeakMap<MockAdapter,HealingEventHistory>();
const previousAdvance=MockAdapter.prototype.advanceResolution;
const previousUndo=MockAdapter.prototype.undoLastResolution;

function isSecondWind(action:ActionVm|undefined) {
  return action?.id==="action.second-wind" && action.resolutionKind==="healing" && action.target==="self";
}

function reject(internal:AtomicHealingAdapterState,error:string) {
  const resolution=internal.resolution;
  if (!resolution) return;
  resolution.stateChanges=[];
  resolution.detail.push(`atomic healing transaction 거부: ${error}`);
  resolution.finalOutcome=`적용 거부: ${error}`;
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.before=null;
}

MockAdapter.prototype.advanceResolution=async function advanceResolutionWithAtomicSecondWind() {
  const internal=this as unknown as AtomicHealingAdapterState;
  const resolution=internal.resolution;
  const action=resolution ? internal.action(resolution.actionId) : undefined;
  if (!resolution || !isSecondWind(action) || resolution.adjudicated || resolution.stage!=="effect-preview") {
    return previousAdvance.call(this);
  }
  const actor=internal.entity(action!.actorId);
  const economy=internal.scene.economyByActor[action!.actorId];
  if (!actor || !economy) {
    reject(internal,"Second Wind actor/economy runtime state is missing");
    return internal.getSnapshot();
  }
  const transaction=resolveAtomicSelfHealing({
    resolutionId:resolution.id,
    action:action!,
    actor,
    economy,
    resources:internal.activeCharacter.resources,
    initiativeMode:internal.sessionMode==="initiative",
    healingAmount:resolution.rollTotal ?? 0,
  });
  if (transaction.status==="rejected") {
    histories.delete(this);
    reject(internal,transaction.error);
    return internal.getSnapshot();
  }

  actor.hp=transaction.hp;
  actor.tempHp=transaction.tempHp;
  internal.scene.economyByActor[actor.id]={ ...transaction.economy };
  internal.activeCharacter.resources=transaction.resources.map((resource)=>({ ...resource }));
  resolution.stateChanges.push(...transaction.stateChanges);
  resolution.provenance.push(...transaction.provenance);
  resolution.compact=`${actor.name} ${transaction.restored} HP 회복`;
  resolution.calculatedOutcome=`${transaction.restored} HP 회복`;
  if (!resolution.adjudicated) resolution.finalOutcome="회복 적용";
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.syncChar();
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events:transaction.events,
    actorName:actor.name,
    targetNames:[actor.name],
  }));
  histories.set(this,{ resolutionId:resolution.id,events:transaction.events.map((event)=>structuredClone(event)) });
  internal.lastBefore=null;
  internal.lastResolutionId=resolution.id;
  internal.before=null;
  return internal.getSnapshot();
};

MockAdapter.prototype.undoLastResolution=async function undoAtomicSecondWindFromEvents() {
  const internal=this as unknown as AtomicHealingAdapterState;
  const history=histories.get(this);
  if (!history || internal.lastResolutionId!==history.resolutionId) return previousUndo.call(this);
  const undone=undoResolutionEvents(internal.scene,history.events,internal.activeCharacter.resources);
  if (undone.status==="rejected") {
    if (internal.resolution) {
      internal.resolution.detail.push(`Event-native Undo 거부: ${undone.error}`);
      internal.resolution.finalOutcome=`Undo 거부: ${undone.error}`;
    }
    return internal.getSnapshot();
  }
  internal.scene=undone.scene;
  internal.activeCharacter.resources=undone.resources.map((resource)=>({ ...resource }));
  internal.syncChar();
  internal.activity=internal.activity.map((entry)=>entry.id===history.resolutionId ? { ...entry,reversed:true } : entry);
  internal.activity.unshift({
    id:`phase09.second-wind-undo.${Date.now()}.${Math.floor(Math.random()*1000)}`,
    time:"지금",actor:"시스템",title:"Resolution 되돌림",summary:history.resolutionId,
    detail:[`ResolutionEvent ${history.events.length}개 역순 적용`,`Before snapshot 미사용`,`HP + economy + resource inverse`],
    stateChanges:undone.stateChanges,correction:true,undoOf:history.resolutionId,
  });
  internal.resolution=null;
  internal.lastBefore=null;
  internal.lastResolutionId=null;
  histories.delete(this);
  return internal.getSnapshot();
};
