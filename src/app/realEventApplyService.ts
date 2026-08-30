import "./lifeRuntimeContracts";
import type { CharacterResourceVm, ItemInstanceVm, SceneVm } from "./contracts";
import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";

export type ResolutionEventApplyResult =
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
    if (change.field==="current") entity.hp=change.after;
    else if (change.field==="maximum") entity.maxHp=change.after;
    else entity.tempHp=change.after;
    return;
  }
  if (change.kind==="economy") {
    const economy=scene.economyByActor[change.targetId]!;
    if (change.field==="extraActions"||change.field==="extraAttacks") {
      if (change.after.length) economy[change.field]=structuredClone(change.after) as never;
      else delete economy[change.field];
    }
    else if (change.field==="action") economy.action=Boolean(change.after);
    else if (change.field==="bonusAction") economy.bonusAction=Boolean(change.after);
    else if (change.field==="reaction") economy.reaction=Boolean(change.after);
    else if (change.field==="movement") economy.movement=Number(change.after);
    else if (change.field==="movementMaximum") economy.movementMax=Number(change.after);
    return;
  }
  if (change.kind==="resource") {
    const item=itemResource(change.resourceId);
    if (item) {
      const instance=items.find((entry)=>entry.id===item.itemId)!;
      if (item.field==="quantity") instance.quantity=change.after;
      else if (instance.charges) instance.charges.current=change.after;
      return;
    }
    const resource=resources.find((entry)=>entry.id===change.resourceId)!;
    resource.current=change.after;
    if (change.capacity) resource.max=change.capacity.after.maximum;
    return;
  }
  if (change.kind==="life") {
    const entity=scene.entities.find((entry)=>entry.id===change.targetId)!;
    entity.runtimeLife![change.field]=change.after;
  }
  if (change.kind==="death-save") scene.entities.find((entry)=>entry.id===change.targetId)!.runtimeLife!.deathSaves[change.field]=change.after;
}

function applyRuntimeChange(runtimeState:RulesRuntimeState,change:RuntimeStateChange) {
  if (change.kind==="effect") {
    const index=runtimeState.effects.findIndex((effect)=>effect.id===change.effectId);
    if (change.after) {
      const next=structuredClone(change.after);
      if (index>=0) runtimeState.effects[index]=next;
      else runtimeState.effects.push(next);
    } else if (index>=0) runtimeState.effects.splice(index,1);
    return;
  }
  if (change.kind==="artifact") {
    const artifacts=runtimeState.artifacts??(runtimeState.artifacts=[]);
    const index=artifacts.findIndex((artifact)=>artifact.id===change.artifactId);
    if (change.after) {
      const next=structuredClone(change.after);
      if (index>=0) artifacts[index]=next;
      else artifacts.push(next);
    } else if (index>=0) artifacts.splice(index,1);
    return;
  }
  if (change.kind==="zone-membership") {
    const memberships=runtimeState.zoneMemberships??(runtimeState.zoneMemberships=[]);
    const index=memberships.findIndex((membership)=>membership.artifactId===change.artifactId);
    if (change.after) {
      const next=structuredClone(change.after);
      if (index>=0) memberships[index]=next;
      else memberships.push(next);
    } else if (index>=0) memberships.splice(index,1);
    return;
  }
  if (change.kind==="concentration") {
    runtimeState.concentration[change.targetId]=change.after ? structuredClone(change.after) : undefined;
    return;
  }
  if (change.kind==="spellcasting-turn") {
    runtimeState.spellcastingTurn=change.after ? structuredClone(change.after) : undefined;
    return;
  }
  if (change.kind==="turn-clock") {
    runtimeState.clock=structuredClone(change.after);
    return;
  }
  if (change.kind==="combatant") {
    if (change.after) runtimeState.combatants[change.targetId]=structuredClone(change.after);
    else delete runtimeState.combatants[change.targetId];
    return;
  }
  const combatant=runtimeState.combatants[change.targetId];
  if (!combatant) return;
  if (change.kind==="hp") {
    if (change.field==="current") combatant.life.hp.current=change.after;
    else if (change.field==="maximum") combatant.life.hp.maximum=change.after;
    else combatant.life.hp.temporary=change.after;
    return;
  }
  if (change.kind==="economy") {
    if (change.field==="extraActions"||change.field==="extraAttacks") combatant.economy[change.field]=structuredClone(change.after) as never;
    else if (change.field==="action") combatant.economy.action=Boolean(change.after);
    else if (change.field==="bonusAction") combatant.economy.bonusAction=Boolean(change.after);
    else if (change.field==="reaction") combatant.economy.reaction=Boolean(change.after);
    else if (change.field==="movement") combatant.economy.movement=Number(change.after);
    else if (change.field==="movementMaximum") combatant.economy.movementMaximum=Number(change.after);
    return;
  }
  if (change.kind==="resource") {
    if (itemResource(change.resourceId)) return;
    const resource=combatant.resources.find((entry)=>entry.id===change.resourceId);
    if (resource) {
      resource.current=change.after;
      if (change.capacity) {
        resource.maximum=change.capacity.after.maximum;
        if (change.capacity.after.maximumAfterLongRest===null) delete resource.maximumAfterLongRest;
        else resource.maximumAfterLongRest=change.capacity.after.maximumAfterLongRest;
      }
    }
    return;
  }
  if (change.kind==="life") combatant.life[change.field]=change.after;
  if (change.kind==="death-save") combatant.life.deathSaves[change.field]=change.after;
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
  for (const change of changes) {
    const app=appCurrentValue(probeScene,probeResources,probeItems,change);
    const runtime=probeRuntime ? runtimeCurrentValue(probeRuntime,change) : missing();
    if (runtimeOnly(change) && !probeRuntime) return `event-native apply requires runtime state for ${change.kind}`;
    if (!app.found && !runtime.found) return `event-native apply target is missing: ${change.targetId}/${changeField(change)}`;
    if (app.found && !deepEquals(app.value,change.before)) {
      return `event-native apply drift for ${change.targetId}/${changeField(change)}: expected ${String(change.before)}, current ${String(app.value)}`;
    }
    if (runtime.found && !deepEquals(runtime.value,change.before)) {
      return `event-native apply runtime drift for ${change.targetId}/${changeField(change)}`;
    }
    if (change.kind==="resource" && change.capacity && !itemResource(change.resourceId)) {
      const appResource=probeResources.find((entry)=>entry.id===change.resourceId);
      if (appResource && appResource.max!==change.capacity.before.maximum) {
        return `event-native apply capacity drift for ${change.targetId}/${changeField(change)}`;
      }
      const runtimeResource=probeRuntime?.combatants[change.targetId]?.resources.find((entry)=>entry.id===change.resourceId);
      if (runtimeResource && (
        runtimeResource.maximum!==change.capacity.before.maximum ||
        (runtimeResource.maximumAfterLongRest??null)!==change.capacity.before.maximumAfterLongRest
      )) {
        return `event-native apply runtime capacity drift for ${change.targetId}/${changeField(change)}`;
      }
    }
    if (app.found) applyAppChange(probeScene,probeResources,probeItems,change);
    if (probeRuntime && runtime.found) applyRuntimeChange(probeRuntime,change);
  }
  return undefined;
}

function spellcastingTurnLabel(state:Extract<RuntimeStateChange,{kind:"spellcasting-turn"}>["after"]) {
  return state ? `${state.turnId} [${state.slottedCasterIds.join(", ") || "—"}]` : "—";
}

function clockLabel(state:Extract<RuntimeStateChange,{kind:"turn-clock"}>["after"]) {
  return `round ${state.round} · ${state.activeActorId??"—"} · ${state.phase??"—"} · ${state.elapsedSeconds}s`;
}

function applyLabel(change:RuntimeStateChange) {
  if (change.kind==="hp") {
    const field=change.field==="current" ? "HP" : change.field==="maximum" ? "최대 HP" : "임시 HP";
    return `${change.targetId} ${field} ${change.before} → ${change.after}`;
  }
  if (change.kind==="economy") return change.field==="extraActions"||change.field==="extraAttacks"
    ? `${change.targetId} 추가 행동 ${change.before.length} → ${change.after.length}`
    : `${change.targetId} economy.${change.field} ${String(change.before)} → ${String(change.after)}`;
  if (change.kind==="resource") {
    const item=itemResource(change.resourceId);
    if (item) return `${change.targetId} item.${item.itemId}.${item.field} ${change.before} → ${change.after}`;
    return `${change.targetId} resource.${change.resourceId} ${change.before} → ${change.after}`;
  }
  if (change.kind==="life") return `${change.targetId} life.${change.field} ${String(change.before)} → ${String(change.after)}`;
  if (change.kind==="death-save") return `${change.targetId} death-save.${change.field} ${change.before} → ${change.after}`;
  if (change.kind==="effect") {
    const before=change.before ? change.before.id : "없음";
    const after=change.after ? change.after.id : "없음";
    return `${change.targetId} effect.${change.effectId} ${before} → ${after}`;
  }
  if (change.kind==="artifact") return `${change.targetId} artifact.${change.artifactId} ${change.operation}`;
  if (change.kind==="zone-membership") return `${change.targetId} zone-membership.${change.artifactId} ${change.operation}`;
  if (change.kind==="concentration") {
    const before=change.before ? change.before.groupId : "없음";
    const after=change.after ? change.after.groupId : "없음";
    return `${change.targetId} concentration ${before} → ${after}`;
  }
  if (change.kind==="combatant") return `${change.targetId} combatant ${change.operation}`;
  if (change.kind==="turn-clock") return `${change.targetId} ${clockLabel(change.before)} → ${clockLabel(change.after)}`;
  return `${change.targetId} spellcasting-turn ${spellcastingTurnLabel(change.before)} → ${spellcastingTurnLabel(change.after)}`;
}

export function applyResolutionEvents(
  scene:SceneVm,
  events:ResolutionEvent[],
  resources:CharacterResourceVm[] = [],
  items:ItemInstanceVm[] = [],
  runtimeState?:RulesRuntimeState,
):ResolutionEventApplyResult {
  const changes=events.flatMap((event)=>event.stateChanges);
  const error=validate(scene,resources,items,changes,runtimeState);
  if (error) return { status:"rejected",error };
  const nextScene=structuredClone(scene);
  const nextResources=structuredClone(resources);
  const nextItems=structuredClone(items);
  const nextRuntimeState=runtimeState ? cloneRuntimeState(runtimeState) : undefined;
  const labels:string[]=[];
  for (const change of changes) {
    const app=appCurrentValue(nextScene,nextResources,nextItems,change);
    const runtime=nextRuntimeState ? runtimeCurrentValue(nextRuntimeState,change) : missing();
    if (app.found) applyAppChange(nextScene,nextResources,nextItems,change);
    if (nextRuntimeState && runtime.found) applyRuntimeChange(nextRuntimeState,change);
    labels.push(applyLabel(change));
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
