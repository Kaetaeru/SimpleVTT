import type { AppSnapshot, CharacterSheet, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { itemEntryById, itemMechanic } from "./characterCreationV10Data";

type WeaponDef = {
  mode?: "melee" | "ranged";
  properties?: string[];
};

type State = {
  activeCharacter: CharacterSheet;
  scene: SceneVm;
};

function canonicalRangeFeet(def: WeaponDef) {
  for (const property of def.properties ?? []) {
    const match = property.match(/^(?:ammunition|thrown):(\d+)(?:\/\d+)?$/i);
    if (match) return Number(match[1]);
  }
  return 5;
}

function weaponRangeByAttackId(character: CharacterSheet) {
  const ranges = new Map<string, number>();
  for (const attack of character.attacks) {
    const item = character.items.find((candidate) =>
      candidate.name === attack.name || candidate.nameEn === attack.name,
    );
    if (!item) continue;
    const entry = itemEntryById(item.definitionId);
    if (!entry || entry.category !== "weapon") continue;
    const def = itemMechanic(entry, "weapon-definition") as WeaponDef | undefined;
    if (!def) continue;
    ranges.set(attack.id, canonicalRangeFeet(def));
  }
  return ranges;
}

function reconcileWeaponRuntimeFacts(scene: SceneVm, character: CharacterSheet) {
  const ranges = weaponRangeByAttackId(character);
  if (!ranges.size) return;
  for (const action of scene.actionsByActor[character.id] ?? []) {
    const rangeFeet = ranges.get(action.id);
    if (rangeFeet === undefined || !action.runtimeAttack) continue;
    action.runtimeAttack = { ...action.runtimeAttack, rangeFeet };
  }
}

const previousGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithCanonicalWeaponRuntimeFacts() {
  const snapshot = await previousGetSnapshot.call(this);
  const state = this as unknown as State;
  reconcileWeaponRuntimeFacts(state.scene, state.activeCharacter);
  reconcileWeaponRuntimeFacts(snapshot.scene, snapshot.activeCharacter);
  return snapshot;
};
