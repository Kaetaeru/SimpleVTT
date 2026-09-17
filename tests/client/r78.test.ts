/**
 * R78 (ROLL20_TABLE_SPEC.md D213): features used when a short rest ends are offered by the rest, and they give back.
 *
 * 비전 회복 and 마력 회복 were buttons on the turn panel; pressing one spent the once-a-day pool and restored nothing
 * (마력 회복's amount even evaluated to a single point). 마법적 책략 spent its pool and left the Pact Magic slots spent.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { activateFeature, usableFeatures } from "../../client/character/activate";
import { usePactSlot, useResource, useSpellSlot } from "../../client/character/play";
import { pickSlots, restFeatures, useRestFeature } from "../../client/character/rest";
import { initialRuntime, type CharacterRuntime } from "../../client/character/runtime";
import { build, catalog } from "./support";

const names = (list: Array<{ feature: { name: string } }>) => list.map((item) => item.feature.name);

test("R78: rest features are not turn buttons (D213)", () => {
  const wizard = build({ classes: "wizard", level: 5 });
  const sorcerer = build({ classes: "sorcerer", level: 5 });
  assert.ok(!names(usableFeatures(wizard.derived, initialRuntime(wizard.derived), catalog())).includes("비전 회복"));
  assert.ok(!names(usableFeatures(sorcerer.derived, initialRuntime(sorcerer.derived), catalog())).includes("마력 회복"));
  assert.ok(names(usableFeatures(sorcerer.derived, initialRuntime(sorcerer.derived), catalog())).includes("마력의 샘"), "a feature used on the turn still is");
});

test("R78: 비전 회복 gives back slots up to half the wizard level, once (D213)", () => {
  const { derived } = build({ classes: "wizard", level: 5 });
  let runtime: CharacterRuntime = initialRuntime(derived);
  const [fresh] = restFeatures(derived, runtime, catalog());
  assert.deepEqual([fresh.name, fresh.slotLevels, fresh.unavailable], ["비전 회복", 3, "되찾을 것이 없습니다"]);
  runtime = useSpellSlot(useSpellSlot(useSpellSlot(runtime, derived, 3), derived, 2), derived, 1);
  const [feature] = restFeatures(derived, runtime, catalog());
  assert.equal(feature.unavailable, undefined);
  assert.deepEqual(pickSlots(derived, runtime, feature.slotLevels!), [3], "highest first, while the budget lasts");
  assert.equal(useRestFeature(runtime, derived, feature, [3, 2]), null, "3 + 2 is more than 3");
  const rested = useRestFeature(runtime, derived, feature, [2, 1])!;
  assert.deepEqual(rested.slotsUsed, { 3: 1 });
  assert.equal(rested.resourcesUsed["resource.wizard.arcane-recovery"], 1);
  assert.equal(restFeatures(derived, rested, catalog())[0].unavailable, "비전 회복을(를) 이미 썼습니다");
});

test("R78: 마력 회복 gives back half the sorcerer level in points (D213)", () => {
  const { derived } = build({ classes: "sorcerer", level: 5 });
  let runtime: CharacterRuntime = initialRuntime(derived);
  for (let n = 0; n < 4; n += 1) runtime = useResource(runtime, derived, "resource.sorcerer.sorcery-points");
  const feature = restFeatures(derived, runtime, catalog()).find((item) => item.name === "마력 회복")!;
  const rested = useRestFeature(runtime, derived, feature)!;
  assert.equal(rested.resourcesUsed["resource.sorcerer.sorcery-points"], 2, "4 spent, 5 // 2 = 2 back");
  assert.equal(rested.resourcesUsed["resource.sorcerer.sorcerous-restoration"], 1);
});

test("R78: 마법적 책략 gives back half the Pact Magic slots (D213)", async () => {
  const made = build({ classes: "warlock", level: 5 });
  let runtime: CharacterRuntime = usePactSlot(usePactSlot(initialRuntime(made.derived), made.derived), made.derived);
  const feature = made.derived.features.find((item) => item.name === "마법적 책략")!;
  await activateFeature(feature, { source: made.source, catalog: catalog(), derived: made.derived, runtime, rollDice: async (spec) => ({ id: "r", at: "", label: spec.label, formula: spec.formula, total: 0, dice: [], modifier: 0 }), save: (update) => { runtime = update(runtime); } });
  assert.equal(made.derived.pactMagic?.count, 2);
  assert.equal(runtime.pactSlotsUsed, 1, "2 spent, half of 2 back");
  assert.equal(runtime.resourcesUsed["resource.warlock.magical-cunning"], 1);
});
