/**
 * V0.9 D344 (SRD_MODULE_PLAN.md §35): spending several dice at once.
 *
 * Some uses spend as many of their own dice as the player likes for one action (천상체의 치유의 빛). D332 stopped
 * the action being charged once per press, but the player still had to press once per die, because the number they
 * chose was known only to the payment — the dice of the use were fixed before the question was asked.
 *
 * The pool a player spends by a chosen number already writes that number as `use.points`; the rest of the use now
 * reads it too. The activation is worked out again once the answer is in, so a use whose healing is written as
 * `use.points` dice of a d4 rolls that many.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { activateFeature } from "../../client/character/activate";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { sourceOf } from "./support";

const FEAT = "test.d344.feat.healing-light";
const POOL = "resource.test.d344.light";

const MODULE = {
  moduleId: "test.d344", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Healing Light", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "치유의 빛", description: "원하는 만큼 주사위를 쓴다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: { id: "feat:healing-light", entryPoints: [
          { id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.resource", operation: "add", value: { value: 6 }, params: { id: POOL, label: "치유의 빛", recovery: "long-rest" } }] },
          { id: "use", invocation: "manual", label: "빛 쓰기", operations: [
            { kind: "resource.change", resource: "resource:test.d344.light", amount: { ref: "use.points" }, target: "self" },
            { kind: "healing.apply", target: "self", diceCount: { ref: "use.points" }, diceSides: { value: 4 } },
          ] },
        ] } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

function healer() {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "워락", classes: "warlock", level: 4, abilities: { cha: 16 }, choices: prefer }), cat, { prefer });
  return { cat, made };
}

async function spend(count: number) {
  const { cat, made } = healer();
  const feature = made.derived.features.find((item) => item.name === "빛 쓰기")!;
  const rolled: string[] = [];
  let saved: CharacterRuntime = initialRuntime(made.derived);
  const outcome = await activateFeature(feature, {
    source: made.source, catalog: cat, derived: made.derived, runtime: saved,
    rollDice: async (spec) => { rolled.push(spec.formula); return { ...spec, id: "r", dice: [], modifier: 0, total: 9, at: "" }; },
    save: (updater) => { saved = updater(saved); },
    askPoints: () => count,
    confirmSelfHeal: () => false,
  });
  return { outcome, rolled, saved };
}

test("D344: the dice of the use are the number the player chose", async () => {
  const three = await spend(3);
  assert.equal(three.outcome, "done");
  assert.deepEqual(three.rolled, ["3d4"], "three dice for three points");
  assert.equal(three.saved.resourcesUsed[POOL], 3, "and three came out of the pool");
});

test("D344: one is still one, and the pool is charged once", async () => {
  const one = await spend(1);
  assert.deepEqual(one.rolled, ["1d4"]);
  assert.equal(one.saved.resourcesUsed[POOL], 1);
});
