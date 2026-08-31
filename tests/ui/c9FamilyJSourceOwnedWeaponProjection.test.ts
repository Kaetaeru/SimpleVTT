import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
import { deriveProductionCharacterActions } from "../../src/app/productionPlayRuntimeAdapter";
import type { CharacterSheet, ItemInstanceVm } from "../../src/app/contracts";

function sourceOwnedWeaponCharacter(
  base: CharacterSheet,
  characterId: string,
  itemId: string,
  itemName: string,
  strength: number,
) {
  const reference = base.items.find((item) => item.definitionId === "dnd.srd521.item.weapon.longsword");
  assert.ok(reference, "reference Character must expose the canonical longsword definition");

  const weapon: ItemInstanceVm = {
    ...structuredClone(reference),
    id: itemId,
    name: itemName,
    nameEn: itemName,
    grantedActionIds: [],
  };
  const character: CharacterSheet = {
    ...structuredClone(base),
    id: characterId,
    name: `Source Owned ${characterId}`,
    proficiencyBonus: 2,
    abilities: { ...base.abilities, str: strength, dex: 7 },
    equipment: [itemName],
    items: [weapon],
    attacks: [],
  };
  character.attacks = materializeCreatedWeaponAttacks(character);
  assert.equal(character.attacks.length, 1);
  character.attacks[0].id = `action.external.${itemId}`;
  return character;
}

function projectedWeapon(character: CharacterSheet) {
  const action = deriveProductionCharacterActions(character).find(
    (candidate) => candidate.category === "weapon" && candidate.name === character.attacks[0]?.name,
  );
  assert.ok(action, "source-owned Character attack must project into a production weapon action");
  assert.ok(action.runtimeAttack, "projected weapon must carry structural runtimeAttack facts");
  return action;
}

test("Family J source-owned weapon projection derives execution facts from equipment and stats without instance/name dispatch", async () => {
  const baseline = (await new MockAdapter().getSnapshot()).activeCharacter;
  const first = sourceOwnedWeaponCharacter(
    baseline,
    "char.external.alpha",
    "item.external.alpha",
    "Unrelated Alpha Blade",
    18,
  );
  const renamed = sourceOwnedWeaponCharacter(
    baseline,
    "char.external.beta",
    "item.external.beta",
    "Completely Renamed Beta Tool",
    18,
  );
  const weaker = sourceOwnedWeaponCharacter(
    baseline,
    "char.external.gamma",
    "item.external.gamma",
    "Gamma Implement",
    12,
  );

  const firstAction = projectedWeapon(first);
  const renamedAction = projectedWeapon(renamed);
  const weakerAction = projectedWeapon(weaker);

  assert.equal(first.attacks[0].bonus, 6, "STR 18 plus proficiency 2 must own the attack bonus");
  assert.equal(weaker.attacks[0].bonus, 3, "changing only source-owned STR must change the attack bonus");
  assert.equal(firstAction.attackBonus, first.attacks[0].bonus);
  assert.equal(weakerAction.attackBonus, weaker.attacks[0].bonus);

  assert.equal(firstAction.runtimeAttack?.sourceKind, "weapon");
  assert.equal(firstAction.runtimeAttack?.rangeFeet, 5);
  assert.equal(firstAction.runtimeAttack?.ability, "str");
  assert.equal(firstAction.runtimeAttack?.diceSides, 8);
  assert.equal(firstAction.runtimeAttack?.diceCount, 1);

  assert.equal(renamedAction.attackBonus, firstAction.attackBonus);
  assert.deepEqual(renamedAction.damage, firstAction.damage);
  assert.deepEqual(
    {
      sourceKind: renamedAction.runtimeAttack?.sourceKind,
      ability: renamedAction.runtimeAttack?.ability,
      rangeFeet: renamedAction.runtimeAttack?.rangeFeet,
      diceSides: renamedAction.runtimeAttack?.diceSides,
      diceCount: renamedAction.runtimeAttack?.diceCount,
    },
    {
      sourceKind: firstAction.runtimeAttack?.sourceKind,
      ability: firstAction.runtimeAttack?.ability,
      rangeFeet: firstAction.runtimeAttack?.rangeFeet,
      diceSides: firstAction.runtimeAttack?.diceSides,
      diceCount: firstAction.runtimeAttack?.diceCount,
    },
    "renaming Character/item/action identities and display names must not change execution facts",
  );
});
