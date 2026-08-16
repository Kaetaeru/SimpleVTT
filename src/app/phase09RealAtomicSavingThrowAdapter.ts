import "./phase09RealAtomicItemAdapter";
import type {
  ActionVm,
  ActivityEntry,
  AppSnapshot,
  CharacterSheet,
  CharacterSummary,
  CombatantDefinitionVm,
  ResolutionView,
  SceneEntity,
  SessionMode,
} from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveAtomicSavingThrowTransaction } from "./realAtomicSavingThrowTransactionService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { undoResolutionEvents } from "./realEventUndoService";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import type { ResolutionEvent } from "../domain/resolutionTypes";

interface BeforeState {
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
}

interface AtomicSavingThrowAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  syncChar():void;
  resolution:ResolutionView|null;
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  combatantDefinitions:CombatantDefinitionVm[];
  sessionMode:SessionMode;
  activity:ActivityEntry[];
  before:BeforeState|null;
  lastBefore:BeforeState|null;
  lastResolutionId:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

interface SavingThrowEventHistory {
  resolutionId:string;
  events:ResolutionEvent[];
}

const histories=new WeakMap<MockAdapter,SavingThrowEventHistory>();
const previousAdvance=MockAdapter.prototype.advanceResolution;
const previousUndo=MockAdapter.prototype.undoLastResolution;

function isAtomicThunderwave(action:ActionVm|undefined) {
  return action?.id==="action.thunderwave"
    && action.resolutionKind==="saving-throw"
    && action.target==="multi-enemy"
    && Boolean(action.damage?.length);
}

function beforeEntity(before:BeforeState,id:string) {
  return before.scene.entities.find((entry)=>entry.id===id);
}

function reject(internal:AtomicSavingThrowAdapterState,error:string) {
  const resolution=internal.resolution;
  if (!resolution) return;
  if (internal.before) {
    internal.scene=structuredClone(internal.before.scene);
    internal.activeCharacter=structuredClone(internal.before.activeCharacter);
    internal.characters=structuredClone(internal.before.characters);
  }
  resolution.stateChanges=[];
  resolution.detail.push(`atomic saving-throw transaction 거부: ${error}`);
  resolution.finalOutcome=`적용 거부: ${error}`;
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.before=null;
}

MockAdapter.prototype.advanceResolution=async function advanceResolutionWithAtomicSavingThrow() {
  const internal=this as unknown as AtomicSavingThrowAdapterState;
  const resolution=internal.resolution;
  const action=resolution ? internal.action(resolution.actionId) : undefined;
  if (!resolution||!isAtomicThunderwave(action)||resolution.adjudicated||resolution.stage!=="damage-animation") {
    return previousAdvance.call(this);
  }

  const before=internal.before;
  if (!before) {
    histories.delete(this);
    reject(internal,"missing before-state for atomic saving throw");
    return internal.getSnapshot();
  }
  const actor=beforeEntity(before,action!.actorId);
  const actorEconomy=before.scene.economyByActor[action!.actorId];
  if (!actor||!actorEconomy) {
    histories.delete(this);
    reject(internal,"atomic saving-throw actor/economy state is missing");
    return internal.getSnapshot();
  }

  let targets;
  try {
    targets=resolution.saveResults.map((preview)=>{
      const entity=beforeEntity(before,preview.targetId);
      const economy=before.scene.economyByActor[preview.targetId];
      if (!entity||!economy) throw new Error(`atomic saving-throw target/economy state is missing: ${preview.targetId}`);
      const stat=resolveRuntimeSaveModifier(
        entity,
        before.activeCharacter,
        action!.saveAbility ?? "내성",
        internal.combatantDefinitions,
      );
      return {
        entity,
        economy,
        modifier:stat.modifier,
        modifierSource:stat.source,
        d20:preview.d20,
        expectedTotal:preview.total,
        expectedOutcome:preview.outcome,
      };
    });
  } catch(error) {
    histories.delete(this);
    reject(internal,error instanceof Error ? error.message : String(error));
    return internal.getSnapshot();
  }

  const transaction=resolveAtomicSavingThrowTransaction({
    resolutionId:resolution.id,
    action:action!,
    actor,
    actorEconomy,
    targets,
    initiativeMode:internal.sessionMode==="initiative",
  });
  if (transaction.status==="rejected") {
    histories.delete(this);
    reject(internal,transaction.error);
    return internal.getSnapshot();
  }
  const writeBack=await persistCharacterResolutionEvents(this,transaction.events,"forward");
  if (writeBack.status==="rejected") {
    histories.delete(this);
    reject(internal,`Character write-back 실패: ${writeBack.error}`);
    return internal.getSnapshot();
  }

  for (const projected of transaction.targets) {
    const target=internal.entity(projected.id);
    if (!target) {
      if (writeBack.changed) await persistCharacterResolutionEvents(this,transaction.events,"inverse");
      histories.delete(this);
      reject(internal,`atomic saving-throw target disappeared before projection: ${projected.id}`);
      return internal.getSnapshot();
    }
    target.hp=projected.hp;
    target.tempHp=projected.tempHp;
    const save=resolution.saveResults.find((entry)=>entry.targetId===projected.id);
    if (save) {
      save.d20=projected.d20;
      save.total=projected.total;
      save.outcome=projected.outcome;
      save.finalDamage=projected.finalDamage;
    }
  }
  internal.scene.economyByActor[action!.actorId]={ ...transaction.actorEconomy };
  resolution.damageComponents=transaction.damageComponents.map((component)=>({ ...component }));
  resolution.stateChanges.push(...transaction.stateChanges);
  resolution.provenance.push(...transaction.provenance.filter((entry)=>!resolution.provenance.includes(entry)));
  resolution.compact=resolution.saveResults
    .map((save)=>`${save.targetName} ${save.outcome}${save.finalDamage!==undefined ? ` · ${save.finalDamage} 피해` : ""}`)
    .join(" / ");
  resolution.calculatedOutcome=resolution.compact;
  if (!resolution.adjudicated) resolution.finalOutcome=resolution.compact;
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.syncChar();
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events:transaction.events,
    actorName:internal.entity(action!.actorId)?.name ?? action!.actorId,
    targetNames:resolution.targetIds.map((id)=>internal.entity(id)?.name ?? id),
  }));
  histories.set(this,{ resolutionId:resolution.id,events:transaction.events.map((event)=>structuredClone(event)) });
  internal.lastBefore=null;
  internal.lastResolutionId=resolution.id;
  internal.before=null;
  return internal.getSnapshot();
};

MockAdapter.prototype.undoLastResolution=async function undoAtomicSavingThrowFromEvents() {
  const internal=this as unknown as AtomicSavingThrowAdapterState;
  const history=histories.get(this);
  if (!history||internal.lastResolutionId!==history.resolutionId) return previousUndo.call(this);
  const undone=undoResolutionEvents(
    internal.scene,
    history.events,
    internal.activeCharacter.resources,
    internal.activeCharacter.items,
  );
  if (undone.status==="rejected") {
    if (internal.resolution) {
      internal.resolution.detail.push(`Event-native Undo 거부: ${undone.error}`);
      internal.resolution.finalOutcome=`Undo 거부: ${undone.error}`;
    }
    return internal.getSnapshot();
  }
  const writeBack=await persistCharacterResolutionEvents(this,history.events,"inverse");
  if (writeBack.status==="rejected") {
    if (internal.resolution) {
      internal.resolution.detail.push(`Event-native Undo 거부: Character write-back 실패: ${writeBack.error}`);
      internal.resolution.finalOutcome=`Undo 거부: Character write-back 실패: ${writeBack.error}`;
    }
    return internal.getSnapshot();
  }
  internal.scene=undone.scene;
  internal.activeCharacter.resources=undone.resources.map((resource)=>structuredClone(resource));
  internal.activeCharacter.items=undone.items.map((item)=>structuredClone(item));
  internal.syncChar();
  internal.activity=internal.activity.map((entry)=>entry.id===history.resolutionId ? { ...entry,reversed:true } : entry);
  internal.activity.unshift({
    id:`phase09.saving-throw-undo.${Date.now()}.${Math.floor(Math.random()*1000)}`,
    time:"지금",
    actor:"시스템",
    title:"Resolution 되돌림",
    summary:history.resolutionId,
    detail:[
      `ResolutionEvent ${history.events.length}개 역순 적용`,
      "Before snapshot 미사용",
      "multi-target HP/Temp HP + economy inverse",
    ],
    stateChanges:undone.stateChanges,
    correction:true,
    undoOf:history.resolutionId,
  });
  internal.resolution=null;
  internal.lastBefore=null;
  internal.lastResolutionId=null;
  histories.delete(this);
  return internal.getSnapshot();
};
