import type { CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectResolutionCharacterWriteBack } from "./resolutionCharacterDurableProjection";
import { installCharacterResolutionWriteBackGuard } from "./resolutionCharacterWriteBackPort";
import {
  isEphemeralSessionProjectionCharacter,
  projectedCharacterById,
  replaceProjectedCharacterSheet,
} from "./characterSessionProjectionRegistry";

type AdapterState = {
  activeCharacter:CharacterSheet;
  scene:{ entities:Array<{ id:string; runtimeLife?:{ stable:boolean; unconscious:boolean; dead:boolean } }> };
};

installCharacterResolutionWriteBackGuard(async (adapter,events,direction) => {
  const state=adapter as unknown as AdapterState;
  const characterId=isEphemeralSessionProjectionCharacter(adapter,state.activeCharacter.id)
    ?state.activeCharacter.id
    :events.map((event)=>event.targetId).find((targetId):targetId is string=>targetId!==undefined&&isEphemeralSessionProjectionCharacter(adapter,targetId));
  if (!characterId) return undefined;

  const sheet=characterId===state.activeCharacter.id
    ?state.activeCharacter
    :projectedCharacterById(adapter,characterId)?.sheet;
  if (!sheet) return { status:"rejected" as const,error:`ephemeral SessionProjection registry lost Character: ${characterId}` };
  const entity=state.scene.entities.find((entry)=>entry.id===characterId);
  const fallbackLife=entity?.runtimeLife ? {
    stable:entity.runtimeLife.stable,
    unconscious:entity.runtimeLife.unconscious,
    dead:entity.runtimeLife.dead,
  } : undefined;
  const projected=projectResolutionCharacterWriteBack(sheet,events,direction,fallbackLife);
  if (projected.status==="rejected") return projected;
  if (!projected.changed) return { status:"committed" as const,changed:false };

  if (state.activeCharacter.id===characterId) state.activeCharacter=structuredClone(projected.sheet);
  if (!replaceProjectedCharacterSheet(adapter,projected.sheet)) {
    return { status:"rejected" as const,error:`ephemeral SessionProjection registry lost Character: ${projected.sheet.id}` };
  }
  return { status:"committed" as const,changed:true };
});

export function isProjectedCharacterPersistenceGuardInstalledForTests(adapter:MockAdapter) {
  const state=adapter as unknown as AdapterState;
  return isEphemeralSessionProjectionCharacter(adapter,state.activeCharacter.id);
}
