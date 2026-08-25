import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet } from "../../src/app/contracts";

type Internal = {
  activeCharacter: CharacterSheet;
};

test("production snapshot projects weapon ability and Rage damage metadata", async () => {
  const adapter = new MockAdapter();
  const state = adapter as unknown as Internal;
  const resourceTemplate = state.activeCharacter.resources[0];
  assert.ok(resourceTemplate, "fixture Character must expose a resource template");
  state.activeCharacter.resources.push({
    ...structuredClone(resourceTemplate),
    id: BARBARIAN_RAGE_RESOURCE_ID,
  });

  const snapshot = await adapter.startProductionLocalPlay("player");
  const actions = snapshot.scene.actionsByActor[snapshot.activeCharacter.id] ?? [];
  const longsword = actions.find((action) => action.id === "action.longsword");

  assert.ok(longsword?.runtimeAttack, "production Longsword action must expose runtime attack facts");
  assert.equal(longsword.attackAbility, "str");
  assert.equal(longsword.rageDamageBonus, 2);
});
