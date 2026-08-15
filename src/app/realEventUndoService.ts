import "./lifeRuntimeContracts";
import type { CharacterResourceVm, ItemInstanceVm, SceneVm } from "./contracts";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";

export type ResolutionEventUndoResult =
  | { status:"committed"; scene:SceneVm; resources:CharacterResourceVm[]; items:ItemInstanceVm[]; stateChanges:string[] }
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

function validate(scene:SceneVm,resources:CharacterResourceVm[],items:ItemInstanceVm[],changes:RuntimeStateChange[]) {
  const probeScene=structuredClone(scene);
  const probeResources=structuredClone(resources);
  const probeItems=structuredClone(items);
  for (const change of [...changes].reverse()) {
    if (change.kind!=="hp"&&change.kind!=="economy"&&change.kind!=="resource"&&change.kind!=="life") {
      return `event-native undo does not support ${change.kind} yet`;
    }
    if (change.kind==="economy"&&change.field==="extraActions") return "event-native undo does not support economy.extraActions yet";
    const current=currentValue(probeScene,probeResources,probeItems,change);
    if (current===undefined) return `event-native undo target is missing: ${change.targetId}`;
    if (!valueEquals(current,change.after)) {
      const field=change.kind==="resource" ? `resource.${change.resourceId}` : `${change.kind}.${change.field}`;
      return `event-native undo drift for ${change.targetId}/${field}: expected ${String(change.after)}, current ${String(current)}`;
    }
    applyChange(probeScene,probeResources,probeItems,change);
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
  return `${change.targetId} ${change.kind} 역적용`;
}

export function undoResolutionEvents(
  scene:SceneVm,
  events:ResolutionEvent[],
  resources:CharacterResourceVm[] = [],
  items:ItemInstanceVm[] = [],
):ResolutionEventUndoResult {
  const changes=events.flatMap((event)=>event.stateChanges);
  const error=validate(scene,resources,items,changes);
  if (error) return { status:"rejected",error };
  const nextScene=structuredClone(scene);
  const nextResources=structuredClone(resources);
  const nextItems=structuredClone(items);
  const labels:string[]=[];
  for (const change of [...changes].reverse()) {
    applyChange(nextScene,nextResources,nextItems,change);
    labels.push(undoLabel(change));
  }
  return { status:"committed",scene:nextScene,resources:nextResources,items:nextItems,stateChanges:labels };
}
