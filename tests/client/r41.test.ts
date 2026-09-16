/**
 * R41 (ROLL20_TABLE_SPEC.md D181): the rest of the vocabulary.
 *
 * Twenty-six operation definitions, all of them read now. Sixteen land somewhere — a sheet or an NPC's own turn —
 * and the other ten need a table-level entry point that does not exist yet, so they are carried as lines on the log
 * rather than dropped. The plan's two counts exist precisely so that difference cannot be papered over.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { activateFeature } from "../../client/character/activate";
import { toggleCondition } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { APPLIED_OPERATIONS, COMPUTED_OPERATIONS, characterScope, parseContract } from "../../client/rules/contract";
import { contractOutcome, emptyOutcome, featureContract } from "../../client/rules/contractActivation";
import { featureRuleKey } from "../../client/rules/activation";
import { build, catalog } from "./support";

test("operations: all twenty-seven kinds are read (D181)", () => {
  // 27 kinds from the grammar's 26 definitions: condition.apply and condition.remove share one.
  assert.equal(COMPUTED_OPERATIONS.length, 27, "every operation kind the grammar defines");
  // R42 gave the last eleven a table-level entry point, so nothing is left computed-only.
  for (const computed of COMPUTED_OPERATIONS) assert.ok((APPLIED_OPERATIONS as readonly string[]).includes(computed), `${computed}: 닿는 자리가 없습니다`);
});

test("operations: each new kind parses into something the engine can act on (D181)", () => {
  const contract = parseContract({
    id: "test:everything", schemaVersion: "0.2-draft",
    entryPoints: [{ id: "use", invocation: "manual", operations: [
      { kind: "condition.remove", condition: "공포", target: "self" },
      { kind: "hp.maximum.change", amount: 5, target: "self" },
      { kind: "life.stabilize", target: "self" },
      { kind: "life.death-save" },
      { kind: "movement.stand", target: "self" },
      { kind: "movement.grant", target: "self", distance: 30, note: "질주" },
      { kind: "movement.relocate", mode: "teleport", target: "self", distance: 60 },
      { kind: "content.grant", contentId: "dnd.srd521.item.gear.rope-hempen", target: "self" },
      { kind: "adjudication.request", question: "DM이 정합니다" },
      { kind: "resource.recharge", resource: "resource:npc.breath", die: "1d6", succeedsOn: [5, 6] },
      { kind: "artifact.spawn", template: { monsterId: "dnd.srd521.monster.wolf", count: 2 } },
      { kind: "artifact.remove", artifact: "summon" },
    ] }],
  }, "test");
  assert.deepEqual(contract.unsupported, []);
  const outcome = contractOutcome(contract, characterScope(build({ name: "f", classes: "fighter", level: 5 }).derived));
  assert.deepEqual(outcome.conditionsRemoved, ["공포"]);
  assert.equal(outcome.hpMaximumDelta, 5);
  assert.equal(outcome.stabilize, true);
  assert.equal(outcome.deathSave, true);
  assert.equal(outcome.stand, true);
  assert.deepEqual(outcome.grants, ["dnd.srd521.item.gear.rope-hempen"]);
  assert.deepEqual(outcome.notes, ["질주", "teleport 60피트", "DM이 정합니다"]);
  assert.deepEqual(outcome.recharges, [{ resourceId: "resource.npc.breath", die: "1d6", succeedsOn: [5, 6] }]);
  assert.deepEqual(outcome.artifacts.map((item) => item.kind), ["artifact.spawn", "artifact.remove"]);
  assert.equal(emptyOutcome(outcome), false);
});

test("operations: 자기 회복 takes the conditions off the sheet, from its contract (D181)", async () => {
  const cat = catalog();
  const made = build({ name: "m", classes: "monk", level: 14 });
  const feature = made.derived.features.find((item) => featureRuleKey(item.id) === "monk.self-restoration")!;
  assert.ok(feature, made.derived.features.map((item) => featureRuleKey(item.id)).join(","));
  assert.deepEqual(contractOutcome(featureContract(cat, "monk.self-restoration")!, characterScope(made.derived)).conditionsRemoved, ["매혹", "공포", "중독"]);
  let runtime = ["매혹", "공포", "중독"].reduce((acc, condition) => toggleCondition(acc, condition), initialRuntime(made.derived));
  assert.deepEqual(runtime.conditions.filter((item) => ["매혹", "공포", "중독"].includes(item)), ["매혹", "공포", "중독"]);
  const outcome = await activateFeature(feature, {
    source: made.source, catalog: cat, derived: made.derived, runtime,
    rollDice: async (spec) => ({ id: "r", at: "", label: spec.label, formula: spec.formula, total: 0, dice: [], modifier: 0 }), save: (update) => { runtime = update(runtime); },
  });
  assert.equal(outcome, "done");
  assert.deepEqual(runtime.conditions.filter((item) => ["매혹", "공포", "중독"].includes(item)), [], JSON.stringify(runtime.conditions));
});

test("operations: what the table has to decide is written on the log, not dropped (D181)", async () => {
  const cat = catalog();
  const made = build({ name: "b", classes: "barbarian", level: 11 });
  const feature = made.derived.features.find((item) => featureRuleKey(item.id) === "barbarian.relentless-rage")!;
  assert.ok(feature, made.derived.features.map((item) => featureRuleKey(item.id)).join(","));
  let runtime = initialRuntime(made.derived);
  await activateFeature(feature, { source: made.source, catalog: cat, derived: made.derived, runtime, rollDice: async (spec) => ({ id: "r", at: "", label: spec.label, formula: spec.formula, total: 0, dice: [], modifier: 0 }), save: (update) => { runtime = update(runtime); } });
  assert.ok((runtime.log ?? []).some((line) => line.text.includes("건강 내성 DC 10")), JSON.stringify(runtime.log?.slice(-4)));
  assert.ok((runtime.log ?? []).some((line) => line.text.includes("안정")), JSON.stringify(runtime.log?.slice(-4)));
});
