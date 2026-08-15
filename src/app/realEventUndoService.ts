import type { SceneVm } from "./contracts";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";

export type ResolutionEventUndoResult =
  | { status:"committed"; scene:SceneVm; stateChanges:string[] }
  | { status:"rejected"; error:string };

function valueEquals(left:boolean|number,right:boolean|number) {
  return left === right;
}

function currentValue(scene:SceneVm,change:RuntimeStateChange):boolean|number|undefined {
  if (change.kind === "hp") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId);
    if (!entity) return undefined;
    if (change.field === "current") return entity.hp;
    if (change.field === "maximum") return entity.maxHp;
    return entity.tempHp;
  }
  if (change.kind === "economy") {
    const economy=scene.economyByActor[change.targetId];
    if (!economy) return undefined;
    if (change.field === "action") return economy.action;
    if (change.field === "bonusAction") return economy.bonusAction;
    if (change.field === "reaction") return economy.reaction;
    if (change.field === "movement") return economy.movement;
    if (change.field === "movementMaximum") return economy.movementMax;
    return undefined;
  }
  return undefined;
}

function validate(scene:SceneVm,changes:RuntimeStateChange[]) {
  const probe=structuredClone(scene);
  for (const change of [...changes].reverse()) {
    if (change.kind !== "hp" && change.kind !== "economy") {
      return `event-native scene undo does not support ${change.kind} yet`;
    }
    if (change.kind === "economy" && change.field === "extraActions") {
      return "event-native scene undo does not support economy.extraActions yet";
    }
    const current=currentValue(probe,change);
    if (current === undefined) return `event-native scene undo target is missing: ${change.targetId}`;
    if (!valueEquals(current,change.after)) {
      return `event-native scene undo drift for ${change.targetId}/${change.kind}.${change.field}: expected ${String(change.after)}, current ${String(current)}`;
    }
    applyChange(probe,change);
  }
  return undefined;
}

function applyChange(scene:SceneVm,change:RuntimeStateChange) {
  if (change.kind === "hp") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId)!;
    if (change.field === "current") entity.hp=change.before;
    else if (change.field === "maximum") entity.maxHp=change.before;
    else entity.tempHp=change.before;
    return;
  }
  if (change.kind !== "economy") return;
  const economy=scene.economyByActor[change.targetId]!;
  if (change.field === "action") economy.action=Boolean(change.before);
  else if (change.field === "bonusAction") economy.bonusAction=Boolean(change.before);
  else if (change.field === "reaction") economy.reaction=Boolean(change.before);
  else if (change.field === "movement") economy.movement=Number(change.before);
  else if (change.field === "movementMaximum") economy.movementMax=Number(change.before);
}

function undoLabel(change:RuntimeStateChange) {
  if (change.kind === "hp") {
    const field=change.field === "current" ? "HP" : change.field === "maximum" ? "최대 HP" : "임시 HP";
    return `${change.targetId} ${field} ${change.after} → ${change.before}`;
  }
  if (change.kind === "economy") {
    return `${change.targetId} economy.${change.field} ${String(change.after)} → ${String(change.before)}`;
  }
  return `${change.targetId} ${change.kind} 역적용`;
}

export function undoResolutionEvents(scene:SceneVm,events:ResolutionEvent[]):ResolutionEventUndoResult {
  const changes=events.flatMap((event)=>event.stateChanges);
  const error=validate(scene,changes);
  if (error) return { status:"rejected", error };
  const next=structuredClone(scene);
  const labels:string[]=[];
  for (const change of [...changes].reverse()) {
    applyChange(next,change);
    labels.push(undoLabel(change));
  }
  return { status:"committed", scene:next, stateChanges:labels };
}
