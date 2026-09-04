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

/**
 * Every projected (ephemeral) Character the events touch gets its own sheet written back: the acting Character (the
 * Host activates its projection context for a remote action) and every projected target. Reproduced on real Windows
 * (W9-02 family C, MP-C03 → MP-C29): P1's attack on P2 only projected the write-back onto the attacker's sheet, so P2's
 * projected sheet kept its full HP; the goblin's later hit on P2 was then refused with
 * "Character write-back drift for <P2>/hp.current: expected 4, current 10".
 */
installCharacterResolutionWriteBackGuard(async (adapter,events,direction) => {
  const state=adapter as unknown as AdapterState;
  const characterIds=new Set<string>();
  if (isEphemeralSessionProjectionCharacter(adapter,state.activeCharacter.id)) characterIds.add(state.activeCharacter.id);
  for (const event of events) {
    for (const targetId of new Set([event.targetId,...event.stateChanges.map((change)=>change.targetId)])) {
      if (targetId!==undefined&&isEphemeralSessionProjectionCharacter(adapter,targetId)) characterIds.add(targetId);
    }
  }
  if (!characterIds.size) return undefined;

  let changed=false;
  for (const characterId of characterIds) {
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
    if (!projected.changed) continue;

    if (state.activeCharacter.id===characterId) state.activeCharacter=structuredClone(projected.sheet);
    if (!replaceProjectedCharacterSheet(adapter,projected.sheet)) {
      return { status:"rejected" as const,error:`ephemeral SessionProjection registry lost Character: ${projected.sheet.id}` };
    }
    changed=true;
  }
  return { status:"committed" as const,changed };
});

export function isProjectedCharacterPersistenceGuardInstalledForTests(adapter:MockAdapter) {
  const state=adapter as unknown as AdapterState;
  return isEphemeralSessionProjectionCharacter(adapter,state.activeCharacter.id);
}
