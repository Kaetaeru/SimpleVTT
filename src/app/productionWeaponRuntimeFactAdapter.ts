import type { AbilityKey, AppSnapshot, CharacterSheet, SceneVm } from "./contracts";
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

function abilityMod(score:number) {
  return Math.floor((score-10)/2);
}

function attackAbility(character:CharacterSheet,def:WeaponDef):AbilityKey|undefined {
  if (def.mode === "ranged") return "dex";
  if (!def.properties?.includes("finesse")) return "str";
  const strength=abilityMod(character.abilities.str);
  const dexterity=abilityMod(character.abilities.dex);
  if (strength===dexterity) return undefined;
  return strength>dexterity ? "str" : "dex";
}

function weaponFactsByAttackId(character: CharacterSheet) {
  const facts = new Map<string, {rangeFeet:number;ability?:AbilityKey}>();
  for (const attack of character.attacks) {
    const item = character.items.find((candidate) =>
      candidate.name === attack.name || candidate.nameEn === attack.name,
    );
    if (!item) continue;
    const entry = itemEntryById(item.definitionId);
    if (!entry || entry.category !== "weapon") continue;
    const def = itemMechanic(entry, "weapon-definition") as WeaponDef | undefined;
    if (!def) continue;
    const ability=attackAbility(character,def);
    facts.set(attack.id, {
      rangeFeet:canonicalRangeFeet(def),
      ...(ability?{ability}:{}),
    });
  }
  return facts;
}

function reconcileWeaponRuntimeFacts(scene: SceneVm, character: CharacterSheet) {
  const facts = weaponFactsByAttackId(character);
  if (!facts.size) return;
  for (const action of scene.actionsByActor[character.id] ?? []) {
    const fact = facts.get(action.id);
    if (!fact || !action.runtimeAttack) continue;
    const { ability: _previousAbility, ...runtimeAttack }=action.runtimeAttack;
    action.runtimeAttack = {
      ...runtimeAttack,
      rangeFeet:fact.rangeFeet,
      ...(fact.ability?{ability:fact.ability}:{}),
    };
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
