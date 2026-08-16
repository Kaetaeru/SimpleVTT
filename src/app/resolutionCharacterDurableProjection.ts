import type { CharacterSheet } from "./contracts";
import type { CharacterDurableLifeFlagsV1 } from "./persistenceContracts";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";

export type CharacterWriteBackDirection = "forward" | "inverse";
export type CharacterWriteBackProjection =
  | { status:"committed"; changed:boolean; sheet:CharacterSheet }
  | { status:"rejected"; error:string };

const ITEM_PREFIX="phase09:item:";

function itemResource(resourceId:string) {
  if (!resourceId.startsWith(ITEM_PREFIX)) return undefined;
  const rest=resourceId.slice(ITEM_PREFIX.length);
  if (rest.endsWith(":quantity")) return { itemId:rest.slice(0,-":quantity".length),field:"quantity" as const };
  if (rest.endsWith(":charges")) return { itemId:rest.slice(0,-":charges".length),field:"charges" as const };
  return undefined;
}

function expected(change:Extract<RuntimeStateChange,{writeBack:"character"}>,direction:CharacterWriteBackDirection) {
  return direction==="forward" ? change.before : change.after;
}

function nextValue(change:Extract<RuntimeStateChange,{writeBack:"character"}>,direction:CharacterWriteBackDirection) {
  return direction==="forward" ? change.after : change.before;
}

function label(change:Extract<RuntimeStateChange,{writeBack:"character"}>) {
  if (change.kind==="hp") return `hp.${change.field}`;
  if (change.kind==="resource") return `resource.${change.resourceId}`;
  return `life.${change.field}`;
}

function lifeFlags(sheet:CharacterSheet,fallback?:CharacterDurableLifeFlagsV1):CharacterDurableLifeFlagsV1 {
  return structuredClone(sheet.durableLifeFlags ?? fallback ?? { stable:false,unconscious:false,dead:false });
}

function applyChange(
  sheet:CharacterSheet,
  change:Extract<RuntimeStateChange,{writeBack:"character"}>,
  direction:CharacterWriteBackDirection,
  fallbackLife?:CharacterDurableLifeFlagsV1,
):string|undefined {
  const before=expected(change,direction);
  const after=nextValue(change,direction);
  if (change.kind==="hp") {
    if (change.field==="maximum") return "Character write-back for maximum HP requires an explicit source-model contract";
    const current=change.field==="current" ? sheet.hp : sheet.tempHp;
    if (current!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${String(before)}, current ${String(current)}`;
    if (change.field==="current") sheet.hp=after;
    else sheet.tempHp=after;
    return;
  }
  if (change.kind==="resource") {
    const pseudo=itemResource(change.resourceId);
    if (pseudo) {
      const item=sheet.items.find((entry)=>entry.id===pseudo.itemId);
      if (!item) return `Character write-back item is missing: ${pseudo.itemId}`;
      const current=pseudo.field==="quantity" ? item.quantity : item.charges?.current;
      if (current===undefined) return `Character write-back item field is missing: ${pseudo.itemId}/${pseudo.field}`;
      if (current!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${before}, current ${current}`;
      if (pseudo.field==="quantity") item.quantity=after;
      else if (item.charges) item.charges.current=after;
      return;
    }
    const resource=sheet.resources.find((entry)=>entry.id===change.resourceId);
    if (!resource) return `Character write-back resource is missing: ${change.resourceId}`;
    if (resource.current!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${before}, current ${resource.current}`;
    resource.current=after;
    return;
  }
  const flags=lifeFlags(sheet,fallbackLife);
  if (flags[change.field]!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${String(before)}, current ${String(flags[change.field])}`;
  flags[change.field]=after;
  sheet.durableLifeFlags=flags;
}

export function projectResolutionCharacterWriteBack(
  sheet:CharacterSheet,
  events:ResolutionEvent[],
  direction:CharacterWriteBackDirection,
  fallbackLife?:CharacterDurableLifeFlagsV1,
):CharacterWriteBackProjection {
  const changes=events
    .flatMap((event)=>event.stateChanges)
    .filter((change):change is Extract<RuntimeStateChange,{writeBack:"character"}>=>change.writeBack==="character" && change.targetId===sheet.id);
  if (!changes.length) return { status:"committed",changed:false,sheet:structuredClone(sheet) };
  const next=structuredClone(sheet);
  const ordered=direction==="forward" ? changes : [...changes].reverse();
  for (const change of ordered) {
    const error=applyChange(next,change,direction,fallbackLife);
    if (error) return { status:"rejected",error };
  }
  return { status:"committed",changed:true,sheet:next };
}
