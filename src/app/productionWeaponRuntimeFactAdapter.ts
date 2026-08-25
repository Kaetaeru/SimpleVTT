import type { AppSnapshot, CharacterSheet, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { itemEntryById, itemMechanic } from "./characterCreationV10Data";
import { BARBARIAN_RAGE_RESOURCE_ID, barbarianRageDamageBonus } from "../domain/barbarianBerserker";

type WeaponDef = {
  mode?: "melee" | "ranged";
  properties?: string[];
};

type State = {
  activeCharacter: CharacterSheet;
  scene: SceneVm;
};

const abilityMod = (score:number) => Math.floor((score - 10) / 2);

function canonicalRangeFeet(def: WeaponDef) {
  for (const property of def.properties ?? []) {
    const match = property.match(/^(?:ammunition|thrown):(\d+)(?:\/\d+)?$/i);
    if (match) return Number(match[1]);
  }
  return 5;
}

function canonicalAttackAbility(character:CharacterSheet,def:WeaponDef) {
  if (def.mode === "ranged") return "dex" as const;
  if (!def.properties?.includes("finesse")) return "str" as const;
  return abilityMod(character.abilities.dex) > abilityMod(character.abilities.str) ? "dex" as const : "str" as const;
}

function weaponFactsByAttackId(character: CharacterSheet) {
  const facts = new Map<string, { rangeFeet:number; attackAbility:"str"|"dex" }>();
  for (const attack of character.attacks) {
    const item = character.items.find((candidate) =>
      candidate.name === attack.name || candidate.nameEn === attack.name,
    );
    if (!item) continue;
    const entry = itemEntryById(item.definitionId);
    if (!entry || entry.category !== "weapon") continue;
    const def = itemMechanic(entry, "weapon-definition") as WeaponDef | undefined;
    if (!def) continue;
    facts.set(attack.id, {
      rangeFeet:canonicalRangeFeet(def),
      attackAbility:canonicalAttackAbility(character,def),
    });
  }
  return facts;
}

function reconcileWeaponRuntimeFacts(scene: SceneVm, character: CharacterSheet) {
  const facts = weaponFactsByAttackId(character);
  const rageDamageBonus = character.resources.some((resource) => resource.id === BARBARIAN_RAGE_RESOURCE_ID)
    ? barbarianRageDamageBonus(character.level)
    : undefined;
  for (const action of scene.actionsByActor[character.id] ?? []) {
    if (action.runtimeAttack?.sourceKind === "unarmed") {
      action.attackAbility = "str";
      action.rageDamageBonus = rageDamageBonus;
      continue;
    }
    const fact = facts.get(action.id);
    if (!fact || !action.runtimeAttack) continue;
    action.runtimeAttack = { ...action.runtimeAttack, rangeFeet:fact.rangeFeet };
    action.attackAbility = fact.attackAbility;
    action.rageDamageBonus = rageDamageBonus;
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