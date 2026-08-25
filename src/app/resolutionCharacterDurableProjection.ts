import type { CharacterSheet } from "./contracts";
import type { CharacterDurableLifeFlagsV1 } from "./persistenceContracts";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { ResourceRecoveryLockouts } from "../domain/resources";
import type { DeathSaveStateChange, LifeFlagStateChange, ResourceStateChange, RuntimeStateChange } from "../domain/runtimeStateChange";
import type { HpStateChange } from "../domain/stateChange";

export type CharacterWriteBackDirection = "forward" | "inverse";
export type CharacterWriteBackProjection =
  | { status:"committed"; changed:boolean; sheet:CharacterSheet }
  | { status:"rejected"; error:string };

type CharacterDurableStateChange=HpStateChange|ResourceStateChange|LifeFlagStateChange|DeathSaveStateChange;
type DurableCharacterResource=CharacterSheet["resources"][number]&{recoveryLockouts?:ResourceRecoveryLockouts};

const ITEM_PREFIX="phase09:item:";

function itemResource(resourceId:string) {
  if (!resourceId.startsWith(ITEM_PREFIX)) return undefined;
  const rest=resourceId.slice(ITEM_PREFIX.length);
  if (rest.endsWith(":quantity")) return { itemId:rest.slice(0,-":quantity".length),field:"quantity" as const };
  if (rest.endsWith(":charges")) return { itemId:rest.slice(0,-":charges".length),field:"charges" as const };
  return undefined;
}

function isCharacterDurableChange(change:RuntimeStateChange):change is CharacterDurableStateChange {
  return change.writeBack==="character" && (change.kind==="hp" || change.kind==="resource" || change.kind==="life" || change.kind==="death-save");
}

function label(change:CharacterDurableStateChange) {
  if (change.kind==="hp") return `hp.${change.field}`;
  if (change.kind==="resource") return `resource.${change.resourceId}`;
  if (change.kind==="death-save") return `death-save.${change.field}`;
  return `life.${change.field}`;
}

function lifeFlags(sheet:CharacterSheet,fallback?:CharacterDurableLifeFlagsV1):CharacterDurableLifeFlagsV1 {
  return structuredClone(sheet.durableLifeFlags ?? fallback ?? { stable:false,unconscious:false,dead:false });
}

function lockoutSnapshot(value:ResourceRecoveryLockouts|undefined):ResourceRecoveryLockouts|null {
  return value ? structuredClone(value) : null;
}

function sameLockouts(left:ResourceRecoveryLockouts|null,right:ResourceRecoveryLockouts|null) {
  return left?.shortRest===right?.shortRest&&left?.longRest===right?.longRest;
}

function applyChange(
  sheet:CharacterSheet,
  change:CharacterDurableStateChange,
  direction:CharacterWriteBackDirection,
  fallbackLife?:CharacterDurableLifeFlagsV1,
):string|undefined {
  if (change.kind==="hp") {
    if (change.field==="maximum") return "Character write-back for maximum HP requires an explicit source-model contract";
    const before=direction==="forward" ? change.before : change.after;
    const after=direction==="forward" ? change.after : change.before;
    const current=change.field==="current" ? sheet.hp : sheet.tempHp;
    if (current!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${before}, current ${current}`;
    if (change.field==="current") sheet.hp=after;
    else sheet.tempHp=after;
    return;
  }
  if (change.kind==="resource") {
    const before=direction==="forward" ? change.before : change.after;
    const after=direction==="forward" ? change.after : change.before;
    const pseudo=itemResource(change.resourceId);
    if (pseudo) {
      if (change.recoveryLockouts) return `Character write-back item resource cannot carry recovery lockouts: ${change.resourceId}`;
      const item=sheet.items.find((entry)=>entry.id===pseudo.itemId);
      if (!item) return `Character write-back item is missing: ${pseudo.itemId}`;
      const current=pseudo.field==="quantity" ? item.quantity : item.charges?.current;
      if (current===undefined) return `Character write-back item field is missing: ${pseudo.itemId}/${pseudo.field}`;
      if (current!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${before}, current ${current}`;
      if (pseudo.field==="quantity") item.quantity=after;
      else if (item.charges) item.charges.current=after;
      return;
    }
    const resource=sheet.resources.find((entry)=>entry.id===change.resourceId) as DurableCharacterResource|undefined;
    if (!resource) return `Character write-back resource is missing: ${change.resourceId}`;
    if (resource.current!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${before}, current ${resource.current}`;
    if (change.recoveryLockouts) {
      const expected=direction==="forward" ? change.recoveryLockouts.before : change.recoveryLockouts.after;
      const next=direction==="forward" ? change.recoveryLockouts.after : change.recoveryLockouts.before;
      const current=lockoutSnapshot(resource.recoveryLockouts);
      if (!sameLockouts(current,expected)) {
        return `Character write-back drift for ${change.targetId}/${label(change)}.recoveryLockouts`;
      }
      if (next) resource.recoveryLockouts=structuredClone(next);
      else delete resource.recoveryLockouts;
    }
    resource.current=after;
    return;
  }
  if (change.kind==="death-save") {
    const before=direction==="forward"?change.before:change.after;
    const after=direction==="forward"?change.after:change.before;
    const flags=lifeFlags(sheet,fallbackLife);
    const deathSaves=flags.deathSaves??{successes:0,failures:0};
    if (deathSaves[change.field]!==before) return `Character write-back drift for ${change.targetId}/${label(change)}: expected ${before}, current ${deathSaves[change.field]}`;
    deathSaves[change.field]=after;
    flags.deathSaves=deathSaves;
    sheet.durableLifeFlags=flags;
    return;
  }
  const before=direction==="forward" ? change.before : change.after;
  const after=direction==="forward" ? change.after : change.before;
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
    .filter((change):change is CharacterDurableStateChange=>isCharacterDurableChange(change) && change.targetId===sheet.id);
  if (!changes.length) return { status:"committed",changed:false,sheet:structuredClone(sheet) };
  const next=structuredClone(sheet);
  const ordered=direction==="forward" ? changes : [...changes].reverse();
  for (const change of ordered) {
    const error=applyChange(next,change,direction,fallbackLife);
    if (error) return { status:"rejected",error };
  }
  return { status:"committed",changed:true,sheet:next };
}
