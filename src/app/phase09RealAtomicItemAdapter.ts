import "./phase09RealAtomicHealingAdapter";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, CharacterSummary, ResolutionView, SceneEntity, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveAtomicItemAction } from "./realAtomicItemActionService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { undoResolutionEvents } from "./realEventUndoService";
import { phase09ReferenceNoRollDamageFact } from "./phase09ReferenceEffectFacts";
import type { ResolutionEvent } from "../domain/resolutionTypes";

interface BeforeState {
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
}

interface AtomicItemAdapterState {
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

interface ItemEventHistory { resolutionId:string; events:ResolutionEvent[]; }
const histories=new WeakMap<MockAdapter,ItemEventHistory>();
const previousAdvance=MockAdapter.prototype.advanceResolution;
const previousUndo=MockAdapter.prototype.undoLastResolution;

function isPotion(action:ActionVm|undefined) { return action?.id==="action.healing-potion"&&action.resolutionKind==="healing"&&Boolean(action.itemCost); }
function isWand(action:ActionVm|undefined) { return action?.id==="action.wand"&&action.resolutionKind==="no-roll-damage"&&Boolean(action.itemCost); }

function beforeEntity(before:BeforeState,id:string) { return before.scene.entities.find((entry)=>entry.id===id); }

function reject(internal:AtomicItemAdapterState,error:string) {
  const resolution=internal.resolution;
  if (!resolution) return;
  if (internal.before) {
    internal.scene=structuredClone(internal.before.scene);
    internal.activeCharacter=structuredClone(internal.before.activeCharacter);
    internal.characters=structuredClone(internal.before.characters);
  }
  resolution.stateChanges=[];
  resolution.detail.push(`atomic item transaction 거부: ${error}`);
  resolution.finalOutcome=`적용 거부: ${error}`;
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.before=null;
}

function finalize(
  adapter:MockAdapter,
  internal:AtomicItemAdapterState,
  action:ActionVm,
  transaction:Extract<ReturnType<typeof resolveAtomicItemAction>,{ status:"committed" }>,
) {
  const resolution=internal.resolution!;
  const target=internal.entity(resolution.targetIds[0]);
  if (!target) return false;
  target.hp=transaction.targetHp;
  target.tempHp=transaction.targetTempHp;
  internal.scene.economyByActor[action.actorId]={ ...transaction.actorEconomy };
  internal.activeCharacter.items=transaction.items.map((item)=>structuredClone(item));
  resolution.stateChanges.push(...transaction.stateChanges);
  resolution.provenance.push(...transaction.provenance.filter((entry)=>!resolution.provenance.includes(entry)));
  if (transaction.damageComponent) {
    resolution.authoritativeDice=[...transaction.authoritativeDice];
    resolution.damageComponents=[transaction.damageComponent];
    resolution.compact=`자동 명중 · ${transaction.damageComponent.adjusted} ${transaction.damageComponent.type} 피해`;
    resolution.calculatedOutcome=resolution.compact;
    if (!resolution.adjudicated) resolution.finalOutcome=resolution.compact;
  } else {
    resolution.compact=`${target.name} ${transaction.restored ?? 0} HP 회복`;
    resolution.calculatedOutcome=`${transaction.restored ?? 0} HP 회복`;
    if (!resolution.adjudicated) resolution.finalOutcome="회복 적용";
  }
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.syncChar();
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events:transaction.events,
    actorName:internal.entity(action.actorId)?.name ?? action.actorId,
    targetNames:resolution.targetIds.map((id)=>internal.entity(id)?.name ?? id),
  }));
  histories.set(adapter,{ resolutionId:resolution.id,events:transaction.events.map((event)=>structuredClone(event)) });
  internal.lastBefore=null;
  internal.lastResolutionId=resolution.id;
  internal.before=null;
  return true;
}

MockAdapter.prototype.advanceResolution=async function advanceResolutionWithAtomicItems() {
  const internal=this as unknown as AtomicItemAdapterState;
  const resolution=internal.resolution;
  const action=resolution ? internal.action(resolution.actionId) : undefined;
  if (!resolution||!action||resolution.adjudicated) return previousAdvance.call(this);
  const potion=isPotion(action)&&resolution.stage==="effect-preview";
  const wand=isWand(action)&&resolution.stage==="damage-animation";
  if (!potion&&!wand) return previousAdvance.call(this);
  const before=internal.before;
  if (!before) {
    histories.delete(this);
    reject(internal,"missing before-state for atomic item action");
    return internal.getSnapshot();
  }
  const actor=beforeEntity(before,action.actorId);
  const target=beforeEntity(before,resolution.targetIds[0]);
  const economy=before.scene.economyByActor[action.actorId];
  if (!actor||!target||!economy) {
    histories.delete(this);
    reject(internal,"atomic item actor/target/economy state is missing");
    return internal.getSnapshot();
  }
  const transaction=potion
    ? resolveAtomicItemAction({
        resolutionId:resolution.id,action,actor,target,economy,items:before.activeCharacter.items,initiativeMode:internal.sessionMode==="initiative",
        kind:"healing",healingAmount:resolution.rollTotal ?? 0,
      })
    : resolveAtomicItemAction({
        resolutionId:resolution.id,action,actor,target,economy,items:before.activeCharacter.items,initiativeMode:internal.sessionMode==="initiative",
        kind:"damage",damageFact:phase09ReferenceNoRollDamageFact(action.id),
      });
  if (transaction.status==="rejected") {
    histories.delete(this);
    reject(internal,transaction.error);
    return internal.getSnapshot();
  }
  if (!finalize(this,internal,action,transaction)) {
    histories.delete(this);
    reject(internal,"atomic item target disappeared before projection");
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.undoLastResolution=async function undoAtomicItemFromEvents() {
  const internal=this as unknown as AtomicItemAdapterState;
  const history=histories.get(this);
  if (!history||internal.lastResolutionId!==history.resolutionId) return previousUndo.call(this);
  const undone=undoResolutionEvents(internal.scene,history.events,internal.activeCharacter.resources,internal.activeCharacter.items);
  if (undone.status==="rejected") {
    if (internal.resolution) {
      internal.resolution.detail.push(`Event-native Undo 거부: ${undone.error}`);
      internal.resolution.finalOutcome=`Undo 거부: ${undone.error}`;
    }
    return internal.getSnapshot();
  }
  internal.scene=undone.scene;
  internal.activeCharacter.resources=undone.resources.map((resource)=>structuredClone(resource));
  internal.activeCharacter.items=undone.items.map((item)=>structuredClone(item));
  internal.syncChar();
  internal.activity=internal.activity.map((entry)=>entry.id===history.resolutionId ? { ...entry,reversed:true } : entry);
  internal.activity.unshift({
    id:`phase09.item-undo.${Date.now()}.${Math.floor(Math.random()*1000)}`,
    time:"지금",actor:"시스템",title:"Resolution 되돌림",summary:history.resolutionId,
    detail:[`ResolutionEvent ${history.events.length}개 역순 적용`,`Before snapshot 미사용`,`HP/damage + economy + ItemInstance inverse`],
    stateChanges:undone.stateChanges,correction:true,undoOf:history.resolutionId,
  });
  internal.resolution=null;
  internal.lastBefore=null;
  internal.lastResolutionId=null;
  histories.delete(this);
  return internal.getSnapshot();
};
