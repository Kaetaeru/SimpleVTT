import "./characterCreationV10Adapter";
import type { AppSnapshot, CharacterCreateDraft, CharacterSheet, CharacterSummary, ItemInstanceVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { itemEntryById, itemMechanic } from "./characterCreationV10Data";

type State = {
  createDraft: CharacterCreateDraft | null;
  activeCharacter: CharacterSheet;
  characters: CharacterSummary[];
  getSnapshot(): Promise<AppSnapshot>;
};

type WeaponDef = {
  mode?: "melee" | "ranged";
  properties?: string[];
  damage?: string;
  damageType?: string;
};

const abilityMod = (score: number) => Math.floor((score - 10) / 2);
const cp = <T,>(value: T): T => structuredClone(value);

function attackBonus(character: CharacterSheet, def: WeaponDef) {
  const strength = abilityMod(character.abilities.str);
  const dexterity = abilityMod(character.abilities.dex);
  const modifier = def.mode === "ranged"
    ? dexterity
    : def.properties?.includes("finesse")
      ? Math.max(strength, dexterity)
      : strength;
  return character.proficiencyBonus + modifier;
}

function attackId(item: ItemInstanceVm, index: number) {
  if (index === 0) return "action.starter";
  const suffix = item.definitionId
    .replace(/^dnd\.srd521\.item\.weapon\./, "")
    .replace(/[^a-z0-9.-]+/gi, "-");
  return `action.starter.${index}.${suffix || "weapon"}`;
}

export function materializeCreatedWeaponAttacks(character: CharacterSheet): CharacterSheet["attacks"] {
  const weapons = character.items.flatMap((item) => {
    const entry = itemEntryById(item.definitionId);
    if (!entry || entry.category !== "weapon") return [];
    const def = itemMechanic(entry, "weapon-definition") as WeaponDef | undefined;
    if (!def) return [];
    return [{ item, def }];
  });

  return weapons.map(({ item, def }, index) => ({
    id: attackId(item, index),
    name: item.name,
    bonus: attackBonus(character, def),
    damage: def.damage ? `${def.damage} ${def.damageType ?? ""}`.trim() : "시작 무기 피해",
  }));
}

const previousFinalize = MockAdapter.prototype.finalizeCharacterDraft;

MockAdapter.prototype.finalizeCharacterDraft = async function finalizeCharacterDraftWithWeaponAttacks() {
  const state = this as unknown as State;
  const hadDraft = Boolean(state.createDraft);
  const snapshot = await previousFinalize.call(this);
  if (!hadDraft || state.createDraft) return snapshot;

  state.activeCharacter.attacks = materializeCreatedWeaponAttacks(state.activeCharacter);
  state.characters = state.characters.map((character) =>
    character.id === state.activeCharacter.id ? cp(state.activeCharacter) : character,
  );
  return state.getSnapshot();
};
