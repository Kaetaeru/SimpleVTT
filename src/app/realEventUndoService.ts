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
type ReadValue={ found:boolean;value:unknown };
const missing=():ReadValue=>({ found:false,value:undefined });
const found=(value:unknown):ReadValue=>({ found:true,value });

function itemResource(resourceId:string) {
  if (!resourceId.startsWith(ITEM_PREFIX)) return undefined;
  const rest=resourceId.slice(ITEM_PREFIX.length);
  if (rest.endsWith(":quantity")) return { itemId:rest.slice(0,-":quantity".length),field:"quantity" as const };
  if (rest.endsWith(":charges")) return { itemId:rest.slice(0,-":charges".length),field:"charges" as const };
  return undefined;
}

function deepEquals(left:unknown,right:unknown):boolean {
  if (Object.is(left,right)) return true;
  if (typeof left!=="object" || left===null || typeof right!=="object" || right===null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length!==right.length) return false;
    return left.every((entry,index)=>deepEquals(entry,right[index]));
  }
  const leftRecord=left as Record<string,unknown>;
  const rightRecord=right as Record<string,unknown>;
  const leftKeys=Object.keys(leftRecord).filter((key)=>leftRecord[key]!==undefined).sort();
  const rightKeys=Object.keys(rightRecord).filter((key)=>rightRecord[key]!==undefined).sort();
  if (leftKeys.length!==rightKeys.length || leftKeys.some((key,index)=>key!==rightKeys[index])) return false;
  return leftKeys.every((key)=>deepEquals(leftRecord[key],rightRecord[key]));
}

function appCurrentValue(scene:SceneVm,resources:CharacterResourceVm[],items:ItemInstanceVm[],change:RuntimeStateChange):ReadValue {
  if (change.kind==="hp") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId);
    if (!entity) return missing();
    if (change.field==="current") return found(entity.hp);
    if (change.field==="maximum") return found(entity.maxHp);
    return found(entity.tempHp);
  }
  if (change.kind==="economy") {
    const economy=scene.economyByActor[change.targetId];
    if (!economy) return missing();
    if (change.field==="action") return found(economy.action);
    if (change.field==="bonusAction") return found(economy.bonusAction);
    if (change.field==="reaction") return found(economy.reaction);
    if (change.field==="movement") return found(economy.movement);
    if (change.field==="movementMaximum") return found(economy.movementMax);
    return found(economy[change.field] ?? []);
  }
  if (change.kind==="resource") {
    const item=itemResource(change.resourceId);
    if (item) {
      const instance=items.find((entry)=>entry.id===item.itemId);
      if (!instance) return missing();
      if (item.field==="quantity") return found(instance.quantity);
      return instance.charges ? found(instance.charges.current) : missing();
    }
    const resource=resources.find((entry)=>entry.id===change.resourceId);
    return resource ? found(resource.current) : missing();
  }
  if (change.kind==="life") {
    const life=scene.entities.find((entry)=>entry.id===change.targetId)?.runtimeLife;
    return life ? found(life[change.field]) : missing();
  }
  if (change.kind==="death-save") {
    const life=scene.entities.find((entry)=>entry.id===change.targetId)?.runtimeLife;
    return life ? found(life.deathSaves[change.field]) : missing();
  }
  return missing();
}

function runtimeCurrentValue(runtimeState:RulesRuntimeState,change:RuntimeStateChange):ReadValue {
  if (change.kind==="effect") return found(runtimeState.effects.find((effect)=>effect.id===change.effectId));
  if (change.kind==="artifact") return found(runtimeState.artifacts?.find((artifact)=>artifact.id===change.artifactId));
  if (change.kind==="zone-membership") return found(runtimeState.zoneMemberships?.find((membership)=>membership.artifactId===change.artifactId));
  if (change.kind==="concentration") return found(runtimeState.concentration[change.targetId]);
  if (change.kind==="spellcasting-turn") return found(runtimeState.spellcastingTurn);
  if (change.kind==="turn-clock") return found(runtimeState.clock);
  if (change.kind==="combatant") return found(runtimeState.combatants[change.targetId]);
  const combatant=runtimeState.combatants[change.targetId];
  if (!combatant) return missing();
  if (change.kind==="hp") {
    if (change.field==="current") return found(combatant.life.hp.current);
    if (change.field==="maximum") return found(combatant.life.hp.maximum);
    return found(combatant.life.hp.temporary);
  }
  if (change.kind==="economy") {
    if (change.field==="action") return found(combatant.economy.action);
    if (change.field==="bonusAction") return found(combatant.economy.bonusAction);
    if (change.field==="reaction") return found(combatant.economy.reaction);
    if (change.field==="movement") return found(combatant.economy.movement);
    if (change.field==="movementMaximum") return found(combatant.economy.movementMaximum);
    return found(combatant.economy[change.field] ?? []);
  }
  if (change.kind==="resource") {
    if (itemResource(change.resourceId)) return missing();
    const resource=combatant.resources.find((entry)=>entry.id===change.resourceId);
    return resource ? found(resource.current) : missing();
  }
  if (change.kind==="life") return found(combatant.life[change.field]);
  if (change.kind==="death-save") return found(combatant.life.deathSaves[change.field]);
  return missing();
}

function applyAppChange(scene:SceneVm,resources:CharacterResourceVm[],items:ItemInstanceVm[],change:RuntimeStateChange) {
  if (change.kind==="hp") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId)!;
    if (change.field==="current") entity.hp=change.before;
    else if (change.field==="maximum") entity.maxHp=change.before;
    else entity.tempHp=change.before;
    return;
  }
  if (change.kind==="economy") {
    const economy=scene.economyByActor[change.targetId]!;
    if (change.field==="extraActions"||change.field==="extraAttacks") {
      if (change.before.length) economy[change.field]=structuredClone(change.before) as never;
      else delete economy[change.field];
    }
    else if (change.field==="action") economy.action=Boolean(change.before);
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
  if (change.kind==="death-save") scene.entities.find((entry)=>entry.id===change.targetId)!.runtimeLife!.deathSaves[change.field]=change.before;
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
  if (change.kind==="artifact") {
    const artifacts=runtimeState.artifacts??(runtimeState.artifacts=[]);
    const index=artifacts.findIndex((artifact)=>artifact.id===change.artifactId);
    if (change.before) {
      const restored=structuredClone(change.before);
      if (index>=0) artifacts[index]=restored;
      else artifacts.push(restored);
    } else if (index>=0) artifacts.splice(index,1);
    return;
  }
  if (change.kind==="zone-membership") {
    const memberships=runtimeState.zoneMemberships??(runtimeState.zoneMemberships=[]);
    const index=memberships.findIndex((membership)=>membership.artifactId===change.artifactId);
    if (change.before) {
      const restored=structuredClone(change.before);
      if (index>=0) memberships[index]=restored;
      else memberships.push(restored);
    } else if (index>=0) memberships.splice(index,1);
    return;
  }
  if (change.kind==="concentration") {
    runtimeState.concentration[change.targetId]=change.before ? structuredClone(change.before) : undefined;
    return;
  }
  if (change.kind==="spellcasting-turn") {
    runtimeState.spellcastingTurn=change.before ? structuredClone(change.before) : undefined;
    return;
  }
  if (change.kind==="turn-clock") {
    runtimeState.clock=structuredClone(change.before);
    return;
  }
  if (change.kind==="combatant") {
    if (change.before) runtimeState.combatants[change.targetId]=structuredClone(change.before);
    else delete runtimeState.combatants[change.targetId];
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
    if (change.field==="extraActions"||change.field==="extraAttacks") combatant.economy[change.field]=structuredClone(change.before) as never;
    else if (change.field==="action") combatant.economy.action=Boolean(change.before);
    else if (change.field==="bonusAction") combatant.economy.bonusAction=Boolean(change.before);
    else if (change.field==="reaction") combatant.economy.reaction=Boolean(change.before);
    else if (change.field==="movement") combatant.economy.movement=Number(change.before);
    else if (change.field==="movementMaximum") combatant.economy.movementMaximum=Number(change.before);
    return;
  }
  if (change.kind==="resource") {
    if (itemResource(change.resourceId)) return;
    const resource=runtimeState.combatants[change.targetId]?.resources.find((entry)=>entry.id===change.resourceId);
    if (resource) resource.current=change.before;
    return;
  }
  if (change.kind==="life") combatant.life[change.field]=change.before;
  if (change.kind==="death-save") combatant.life.deathSaves[change.field]=change.before;
}

function runtimeOnly(change:RuntimeStateChange) {
  return change.kind==="effect" || change.kind==="artifact" || change.kind==="zone-membership" || change.kind==="concentration" || change.kind==="spellcasting-turn" || change.kind==="turn-clock" || change.kind==="combatant";
}

function changeField(change:RuntimeStateChange) {
  if (change.kind==="resource") return `resource.${change.resourceId}`;
  if (change.kind==="effect") return `effect.${change.effectId}`;
  if (change.kind==="artifact") return `artifact.${change.artifactId}`;
  if (change.kind==="zone-membership") return `zone-membership.${change.artifactId}`;
  if (change.kind==="concentration") return "concentration";
  if (change.kind==="spellcasting-turn") return "spellcasting-turn";
  if (change.kind==="turn-clock") return "turn-clock";
  if (change.kind==="combatant") return "combatant";
  return `${change.kind}.${change.field}`;
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
    const app=appCurrentValue(probeScene,probeResources,probeItems,change);
    const runtime=probeRuntime ? runtimeCurrentValue(probeRuntime,change) : missing();
    if (runtimeOnly(change) && !probeRuntime) return `event-native undo requires runtime state for ${change.kind}`;
    if (!app.found && !runtime.found) return `event-native undo target is missing: ${change.targetId}/${changeField(change)}`;
    if (app.found && !deepEquals(app.value,change.after)) {
      return `event-native undo drift for ${change.targetId}/${changeField(change)}: expected ${String(change.after)}, current ${String(app.value)}`;
    }
    if (runtime.found && !deepEquals(runtime.value,change.after)) {
      return `event-native undo runtime drift for ${change.targetId}/${changeField(change)}`;
    }
    if (app.found) applyAppChange(probeScene,probeResources,probeItems,change);
    if (probeRuntime && runtime.found) applyRuntimeChange(probeRuntime,change);
  }
  return undefined;
}

function spellcastingTurnLabel(state:Extract<RuntimeStateChange,{kind:"spellcasting-turn"}>["before"]) {
  return state ? `${state.turnId} [${state.slottedCasterIds.join(", ") || "—"}]` : "—";
}

function clockLabel(state:Extract<RuntimeStateChange,{kind:"turn-clock"}>["before"]) {
  return `round ${state.round} · ${state.activeActorId??"—"} · ${state.phase??"—"} · ${state.elapsedSeconds}s`;
}

function undoLabel(change:RuntimeStateChange) {
  if (change.kind==="hp") {
    const field=change.field==="current" ? "HP" : change.field==="maximum" ? "최대 HP" : "임시 HP";
    return `${change.targetId} ${field} ${change.after} → ${change.before}`;
  }
  if (change.kind==="economy") return change.field==="extraActions"||change.field==="extraAttacks"
    ? `${change.targetId} 추가 행동 ${change.after.length} → ${change.before.length}`
    : `${change.targetId} economy.${change.field} ${String(change.after)} → ${String(change.before)}`;
  if (change.kind==="resource") {
    const item=itemResource(change.resourceId);
    if (item) return `${change.targetId} item.${item.itemId}.${item.field} ${change.after} → ${change.before}`;
    return `${change.targetId} resource.${change.resourceId} ${change.after} → ${change.before}`;
  }
  if (change.kind==="life") return `${change.targetId} life.${change.field} ${String(change.after)} → ${String(change.before)}`;
  if (change.kind==="death-save") return `${change.targetId} death-save.${change.field} ${change.after} → ${change.before}`;
  if (change.kind==="effect") {
    const before=change.before ? change.before.id : "없음";
    const after=change.after ? change.after.id : "없음";
    return `${change.targetId} effect.${change.effectId} ${after} → ${before}`;
  }
  if (change.kind==="artifact") return `${change.targetId} artifact.${change.artifactId} undo ${change.operation}`;
  if (change.kind==="zone-membership") return `${change.targetId} zone-membership.${change.artifactId} undo ${change.operation}`;
  if (change.kind==="concentration") {
    const before=change.before ? change.before.groupId : "없음";
    const after=change.after ? change.after.groupId : "없음";
    return `${change.targetId} concentration ${after} → ${before}`;
  }
  if (change.kind==="turn-clock") return `${change.targetId} ${clockLabel(change.after)} → ${clockLabel(change.before)}`;
  if (change.kind==="combatant") return `${change.targetId} combatant undo ${change.operation}`;
  return `${change.targetId} spellcasting-turn ${spellcastingTurnLabel(change.after)} → ${spellcastingTurnLabel(change.before)}`;
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
    const app=appCurrentValue(nextScene,nextResources,nextItems,change);
    const runtime=nextRuntimeState ? runtimeCurrentValue(nextRuntimeState,change) : missing();
    if (app.found) applyAppChange(nextScene,nextResources,nextItems,change);
    if (nextRuntimeState && runtime.found) applyRuntimeChange(nextRuntimeState,change);
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
