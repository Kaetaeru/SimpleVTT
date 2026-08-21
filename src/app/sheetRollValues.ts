import type { AbilityKey, CharacterSheet } from "./contracts";
import type { OfficialSheetProjection } from "./characterSheetV10Projection";

export function sheetAbilityModifier(character:CharacterSheet, ability:AbilityKey) {
  return Math.floor((character.abilities[ability]-10)/2);
}

export function sheetSaveBonus(character:CharacterSheet, view:OfficialSheetProjection, ability:AbilityKey) {
  return sheetAbilityModifier(character,ability)+(view.saveProficiencies.has(ability)?character.proficiencyBonus:0);
}
