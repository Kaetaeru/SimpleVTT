import type { CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  projectResolutionCharacterWriteBack,
  type CharacterWriteBackDirection,
} from "./resolutionCharacterDurableProjection";
import { installCharacterResolutionWriteBackGuard } from "./resolutionCharacterWriteBackPort";
import {
  isEphemeralSessionProjectionCharacter,
  projectedCharacterById,
  replaceProjectedCharacterSheet,
} from "./characterSessionProjectionRegistry";
import type { ResolutionEvent } from "../domain/resolutionTypes";

type AdapterState = {
  activeCharacter:CharacterSheet;
  scene:{ entities:Array<{ id:string; runtimeLife?:{ stable:boolean; unconscious:boolean; dead:boolean } }> };
};

export async function persistProjectedCharacterResolutionEvents(
  adapter:MockAdapter,
  events:ResolutionEvent[],
  direction:CharacterWriteBackDirection,
) {
  const state=adapter as unknown as AdapterState;
  const activeIsProjected=isEphemeralSessionProjectionCharacter(adapter,state.activeCharacter.id);
  const projectedTargetIds=[...new Set(events.flatMap((event)=>event.stateChanges.flatMap((change)=>
    change.writeBack==="character"&&isEphemeralSessionProjectionCharacter(adapter,change.targetId)
      ? [change.targetId]
      : [],
  )))];
  if (!activeIsProjected&&projectedTargetIds.length===0) return undefined;
  if (!activeIsProjected&&projectedTargetIds.length>1) {
    return { status:"rejected" as const,error:"Character write-back spans multiple ephemeral SessionProjection owners" };
  }

  const characterId=activeIsProjected ? state.activeCharacter.id : projectedTargetIds[0];
  const sheet=characterId===state.activeCharacter.id
    ? state.activeCharacter
    : projectedCharacterById(adapter,characterId)?.sheet;
  if (!sheet) {
    return { status:"rejected" as const,error:`ephemeral SessionProjection registry lost Character: ${characterId}` };
  }

  const entity=state.scene.entities.find((entry)=>entry.id===characterId);
  const fallbackLife=entity?.runtimeLife ? {
    stable:entity.runtimeLife.stable,
    unconscious:entity.runtimeLife.unconscious,
    dead:entity.runtimeLife.dead,
  } : undefined;
  const projected=projectResolutionCharacterWriteBack(sheet,events,direction,fallbackLife);
  if (projected.status==="rejected") return projected;
  if (!projected.changed) return { status:"committed" as const,changed:false };

  if (characterId===state.activeCharacter.id) state.activeCharacter=structuredClone(projected.sheet);
  if (!replaceProjectedCharacterSheet(adapter,projected.sheet)) {
    return { status:"rejected" as const,error:`ephemeral SessionProjection registry lost Character: ${projected.sheet.id}` };
  }
  return { status:"committed" as const,changed:true };
}

installCharacterResolutionWriteBackGuard(persistProjectedCharacterResolutionEvents);

export function isProjectedCharacterPersistenceGuardInstalledForTests(adapter:MockAdapter) {
  const state=adapter as unknown as AdapterState;
  return isEphemeralSessionProjectionCharacter(adapter,state.activeCharacter.id);
}
