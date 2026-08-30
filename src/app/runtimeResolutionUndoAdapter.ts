import type { CharacterSheet, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";
import { applyResolutionEvents } from "./realEventApplyService";
import {
  clearRuntimeResolutionEventHistory,
  runtimeResolutionEventHistory,
} from "./runtimeResolutionEventHistory";
import {
  commitAdapterTurnRuntimeState,
  snapshotAdapterTurnRuntimeState,
} from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";

interface AdapterState {
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:unknown|null;
  activity:Array<{ id:string }>;
  lastResolutionId:string|null;
  syncChar():void;
}

type ReversibleStateChange = RuntimeStateChange & {
  before:unknown;
  after:unknown;
  operation?:"added"|"updated"|"removed";
};

function inverseOperation(operation:ReversibleStateChange["operation"]) {
  if (operation==="added") return "removed" as const;
  if (operation==="removed") return "added" as const;
  return operation;
}

function invertStateChange(change:RuntimeStateChange):RuntimeStateChange {
  const inverted=structuredClone(change) as ReversibleStateChange;
  inverted.before=structuredClone((change as ReversibleStateChange).after);
  inverted.after=structuredClone((change as ReversibleStateChange).before);
  if (inverted.operation) inverted.operation=inverseOperation(inverted.operation);
  return inverted;
}

function invertResolutionEvents(events:ResolutionEvent[]):ResolutionEvent[] {
  return [...events].reverse().map((event)=>({
    ...structuredClone(event),
    stateChanges:[...event.stateChanges].reverse().map(invertStateChange),
  }));
}

const oldUndoLastResolution=MockAdapter.prototype.undoLastResolution;

MockAdapter.prototype.undoLastResolution=async function undoRuntimeResolution():Promise<boolean> {
  const history=runtimeResolutionEventHistory(this);
  if (!history) return oldUndoLastResolution.call(this);

  const internal=this as unknown as AdapterState;
  const runtimeState=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const inverseEvents=invertResolutionEvents(history.events);
  const projected=applyResolutionEvents(
    internal.scene,
    inverseEvents,
    internal.activeCharacter.resources,
    internal.activeCharacter.items,
    runtimeState,
  );
  if (projected.status==="rejected") return false;

  const writeBack=await persistCharacterResolutionEvents(this,history.events,"inverse");
  if (writeBack.status==="rejected") return false;

  if (runtimeState && projected.runtimeState) {
    const committed=commitAdapterTurnRuntimeState(
      this,
      projected.scene,
      runtimeState.revision,
      projected.runtimeState,
    );
    if (!committed) {
      if (writeBack.changed) await persistCharacterResolutionEvents(this,history.events,"forward");
      return false;
    }
  }

  const durableResources=structuredClone(internal.activeCharacter.resources);
  const durableItems=structuredClone(internal.activeCharacter.items);
  internal.scene=projected.scene;
  internal.activeCharacter.resources=durableResources;
  internal.activeCharacter.items=durableItems;
  internal.resolution=null;
  internal.activity=internal.activity.filter((entry)=>entry.id!==history.resolutionId);
  internal.lastResolutionId=null;
  clearRuntimeResolutionEventHistory(this);
  internal.syncChar();
  return true;
};
