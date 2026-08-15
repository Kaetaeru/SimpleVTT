import "./lifeRuntimeContracts";
import type { CharacterResourceVm, ItemInstanceVm, SceneVm } from "./contracts";
import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";

export type ResolutionEventUndoResult =
  | {
      status:"committed";
      scene:SceneVm;
      resources:CharacterResourceVm[];
      items:ItemInstanceVm[];
      runtimeState?:RulesRuntimeState;
      stateChanges:string[];
    }
  | { status:"rejected"; error:string };

const ITEM_PREFIX="phase09:item:";

function itemResource(resourceId:string) {
  if (!resourceId.startsWith(ITEM_PREFIX)) return undefined;
  const rest=resourceId.slice(ITEM_PREFIX.length);
  if (rest.endsWith(":quantity")) return { itemId:rest.slice(0,-":quantity".length),field:"quantity" as const };
  if (rest.endsWith(":charges")) return { itemId:rest.slice(0,-":charges".length),field:"charges" as const };
  return undefined;
}

function valueEquals(left:boolean|number,right:boolean|number) { return left===right; }

function deepEquals(left:unknown,right:unknown):boolean {
  if (Object.is(left,right)) return true;
  if (typeof left!=="object" || left===null || typeof right!=="object" || right===null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length!==right.length) return false;
    return left.every((entry,index)=>deepEquals(entry,right[index]));
  }
  const leftRecord=left as Record<string,unknown>;
  const rightRecord=right as Record<string,unknown>;
  const leftKeys=Object.keys(leftRecord).sort();
  const rightKeys=Object.keys(rightRecord).sort();
  if (leftKeys.length!==rightKeys.length || leftKeys.some((key,index)=>key!==rightKeys[index])) return false;
  return leftKeys.every((key)=>deepEquals(leftRecord[key],rightRecord[key]));
}

function currentValue(scene:SceneVm,resources:CharacterResourceVm[],items:ItemInstanceVm[],change:RuntimeStateChange):boolean|number|undefined {
  if (change.kind==="hp") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId);
    if (!entity) return undefined;
    if (change.field==="current") return entity.hp;
    if (change.field==="maximum") return entity.maxHp;
    return entity.tempHp;
  }
  if (change.kind==="economy") {
    const economy=scene.economyByActor[change.targetId];
    if (!economy) return undefined;
    if (change.field==="action") return economy.action;
    if (change.field==="bonusAction") return economy.bonusAction;
    if (change.field==="reaction") return economy.reaction;
    if (change.field==="movement") return economy.movement;
    if (change.field==="movementMaximum") return economy.movementMax;
    return undefined;
  }
  if (change.kind==="resource") {
    const item=itemResource(change.resourceId);
    if (item) {
      const instance=items.find((entry)=>entry.id===item.itemId);
      if (!instance) return undefined;
      return item.field==="quantity" ? instance.quantity : instance.charges?.current;
    }
    return resources.find((resource)=>resource.id===change.resourceId)?.current;
  }
  if (change.kind==="life") {
    const life=scene.entities.find((entry)=>entry.id===change.targetId)?.runtimeLife;
    return life?.[change.field];
  }
  return undefined;
}

function runtimeCurrentValue(runtimeState:RulesRuntimeState,change:RuntimeStateChange) {
  if (change.kind==="effect") return runtimeState.effects.find((effect)=>effect.id===change.effectId);
  if (change.kind==="concentration") return runtimeState.concentration[change.targetId];
  return undefined;
}

function applyChange(scene:SceneVm,resources:CharacterResourceVm[],items:ItemInstanceVm[],change:RuntimeStateChange) {
  if (change.kind==="hp") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId)!;
    if (change.field==="current") entity.hp=change.before;
    else if (change.field==="maximum") entity.maxHp=change.before;
    else entity.tempHp=change.before;
    return;
  }
  if (change.kind==="economy") {
    const economy=scene.economyByActor[change.targetId]!;
    if (change.field==="action") economy.action=Boolean(change.before);
    else if (change.field==="bonusAction") economy.bonusAction=Boolean(change.before);
    else if (change.field==="reaction") economy.reaction=Boolean(change.before);
    else if (change.field==="movement") economy.movement=Number(change.before);
    else if (change.field==="movementMaximum") economy.movementMax=Number(change.before);
    return;
  }
  if (change.kind==="resource") {
    const item=itemResource(change.resourceId);
    if (item) {
      const instance=items.find((entry)=>entry.id===item.itemId)!;
      if (item.field==="quantity") instance.quantity=change.before;
      else if (instance.charges) instance.charges.current=change.before;
      return;
    }
    const resource=resources.find((entry)=>entry.id===change.resourceId)!;
    resource.current=change.before;
    return;
  }
  if (change.kind==="life") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId)!;
    entity.runtimeLife![change.field]=change.before;
  }
}

function applyRuntimeChange(runtimeState:RulesRuntimeState,change:RuntimeStateChange) {
  if (change.kind==="effect") {
    const index=runtimeState.effects.findIndex((effect)=>effect.id===change.effectId);
    if (change.before) {
      const restored=structuredClone(change.before);
      if (index>=0) runtimeState.effects[index]=restored;
      else runtimeState.effects.push(restored);
    } else if (index>=0) runtimeState.effects.splice(index,1);
    return;
  }
  if (change.kind==="concentration") {
    runtimeState.concentration[change.targetId]=change.before ? structuredClone(change.before) : undefined;
    return;
  }
  const combatant=runtimeState.combatants[change.targetId];
  if (!combatant) return;
  if (change.kind==="hp") {
    if (change.field==="current") combatant.life.hp.current=change.before;
    else if (change.field==="maximum") combatant.life.hp.maximum=change.before;
    else combatant.life.hp.temporary=change.before;
    return;
  }
  if (change.kind==="economy") {
    if (change.field==="action") combatant.economy.action=Boolean(change.before);
    else if (change.field==="bonusAction") combatant.economy.bonusAction=Boolean(change.before);
    else if (change.field==="reaction") combatant.economy.reaction=Boolean(change.before);
    else if (change.field==="movement") combatant.economy.movement=Number(change.before);
    else if (change.field==="movementMaximum") combatant.economy.movementMaximum=Number(change.before);
    return;
  }
  if (change.kind==="resource") {
    if (itemResource(change.resourceId)) return;
    const resource=combatant.resources.find((entry)=>entry.id===change.resourceId);
    if (resource) resource.current=change.before;
    return;
  }
  if (change.kind==="life") combatant.life[change.field]=change.before;
}

function validate(
  scene:SceneVm,
  resources:CharacterResourceVm[],
  items:ItemInstanceVm[],
  changes:RuntimeStateChange[],
  runtimeState?:RulesRuntimeState,
) {
  const probeScene=structuredClone(scene);
  const probeResources=structuredClone(resources);
  const probeItems=structuredClone(items);
  const probeRuntime=runtimeState ? cloneRuntimeState(runtimeState) : undefined;
  for (const change of [...changes].reverse()) {
    if (change.kind==="effect" || change.kind==="concentration") {
      if (!probeRuntime) return `event-native undo requires runtime state for ${change.kind}`;
      const current=runtimeCurrentValue(probeRuntime,change);
      if (!deepEquals(current,change.after)) {
        const field=change.kind==="effect" ? `effect.${change.effectId}` : "concentration";
        return `event-native undo drift for ${change.targetId}/${field}`;
      }
      applyRuntimeChange(probeRuntime,change);
      continue;
    }
    if (change.kind==="economy"&&change.field==="extraActions") return "event-native undo does not support economy.extraActions yet";
    const current=currentValue(probeScene,probeResources,probeItems,change);
    if (current===undefined) return `event-native undo target is missing: ${change.targetId}`;
    if (!valueEquals(current,change.after)) {
      const field=change.kind==="resource" ? `resource.${change.resourceId}` : `${change.kind}.${change.field}`;
      return `event-native undo drift for ${change.targetId}/${field}: expected ${String(change.after)}, current ${String(current)}`;
    }
    applyChange(probeScene,probeResources,probeItems,change);
    if (probeRuntime) applyRuntimeChange(probeRuntime,change);
  }
  return undefined;
}

function undoLabel(change:RuntimeStateChange) {
  if (change.kind==="hp") {
    const field=change.field==="current" ? "HP" : change.field==="maximum" ? "최대 HP" : "임시 HP";
    return `${change.targetId} ${field} ${change.after} → ${change.before}`;
  }
  if (change.kind==="economy") return `${change.targetId} economy.${change.field} ${String(change.after)} → ${String(change.before)}`;
  if (change.kind==="resource") {
    const item=itemResource(change.resourceId);
    if (item) return `${change.targetId} item.${item.itemId}.${item.field} ${change.after} → ${change.before}`;
    return `${change.targetId} resource.${change.resourceId} ${change.after} → ${change.before}`;
  }
  if (change.kind==="life") return `${change.targetId} life.${change.field} ${String(change.after)} → ${String(change.before)}`;
  if (change.kind==="effect") {
    const before=change.before ? change.before.id : "없음";
    const after=change.after ? change.after.id : "없음";
    return `${change.targetId} effect.${change.effectId} ${after} → ${before}`;
  }
  const before=change.before ? change.before.groupId : "없음";
  const after=change.after ? change.after.groupId : "없음";
  return `${change.targetId} concentration ${after} → ${before}`;
}

export function undoResolutionEvents(
  scene:SceneVm,
  events:ResolutionEvent[],
  resources:CharacterResourceVm[] = [],
  items:ItemInstanceVm[] = [],
  runtimeState?:RulesRuntimeState,
):ResolutionEventUndoResult {
  const changes=events.flatMap((event)=>event.stateChanges);
  const error=validate(scene,resources,items,changes,runtimeState);
  if (error) return { status:"rejected",error };
  const nextScene=structuredClone(scene);
  const nextResources=structuredClone(resources);
  const nextItems=structuredClone(items);
  const nextRuntimeState=runtimeState ? cloneRuntimeState(runtimeState) : undefined;
  const labels:string[]=[];
  for (const change of [...changes].reverse()) {
    if (change.kind==="effect" || change.kind==="concentration") {
      if (nextRuntimeState) applyRuntimeChange(nextRuntimeState,change);
    } else {
      applyChange(nextScene,nextResources,nextItems,change);
      if (nextRuntimeState) applyRuntimeChange(nextRuntimeState,change);
    }
    labels.push(undoLabel(change));
  }
  if (nextRuntimeState && changes.length) nextRuntimeState.revision+=1;
  return {
    status:"committed",
    scene:nextScene,
    resources:nextResources,
    items:nextItems,
    runtimeState:nextRuntimeState,
    stateChanges:labels,
  };
}
