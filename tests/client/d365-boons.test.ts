/**
 * V0.9 D365 (ITEM_GRAMMAR_V2_PLAN.md IG-9): a boon — a custom feature given as item JSON.
 *
 * A campaign reward (a blessing, a pact) is the same JSON a magic item is, given as a boon: it is not in the bag and
 * needs no attunement; it is a line in the sheet's "은혜·보상" features with its text, and whatever its JSON says —
 * a resistance, a button with its own pool — works like an item's. Taking it away is the ✕ on its line.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import { activateFeature, usableFeatures } from "../../client/character/activate";
import { autofill } from "../../client/character/autofill";
import { parseCustomItem } from "../../client/character/customItem";
import { addItem, removeItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { sourceOf } from "./support";

const BLESSING = { name: "숲의 축복", type: "wondrous", attunement: true, description: "숲의 정령이 지켜 준다", resistances: ["poison"], uses: [{ id: "call", label: "정령 부르기", max: 1, recharge: "long-rest" }],
  contract: { entryPoints: [{ id: "call", label: "정령 부르기", invocation: "manual", payments: [{ kind: "economy", bucket: "action", amount: { value: 1 }, consumeAt: "commit" }], operations: [
    { kind: "resource.change", resource: "resource:self.call", amount: -1, target: "self" },
    { kind: "temp-hp.grant", dice: "2d6", target: "self" },
  ] }] } };
const MARK = { name: "악마의 표식", type: "wondrous", notes: ["악마가 부르면 거역할 수 없다"] };

test("D365: a boon is a feature, not a thing in the bag, and works without attunement", async () => {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "순례자", classes: "fighter", level: 3 }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const read = (json: object) => { const parsed = parseCustomItem(JSON.stringify(json), cat); if ("error" in parsed) throw new Error(parsed.error); return parsed.item; };
  let runtime = addItem(initialRuntime(made.derived), { name: BLESSING.name, custom: read(BLESSING), boon: true });
  runtime = addItem(runtime, { name: MARK.name, custom: read(MARK), boon: true });
  const sheet = derive(runtime);
  const boons = sheet.features.filter((feature) => feature.source === "boon");
  assert.deepEqual(boons.map((feature) => feature.name).sort(), ["숲의 축복", "악마의 표식", "정령 부르기"].sort(), JSON.stringify(boons.map((feature) => feature.name)));
  assert.ok(boons.find((feature) => feature.name === "악마의 표식")?.description?.includes("거역"), "a boon without a contract still shows what the table settles");
  assert.ok(sheet.defenses.resistances.some((line) => line.startsWith("독")), "works though its JSON says attunement");
  const button = usableFeatures(sheet, runtime, cat).find((use) => use.feature.name === "정령 부르기")!;
  assert.ok(button, "its button");
  let saved = runtime;
  const outcome = await activateFeature(button.feature, { source: made.source, catalog: cat, derived: sheet, runtime: saved, rollDice: async (spec) => ({ ...spec, id: "r", dice: [], modifier: 0, total: 7, at: "" }), save: (updater) => { saved = updater(saved); } });
  assert.equal(outcome, "done");
  assert.equal(saved.resourcesUsed[button.pool!.id], 1, "its own pool");
  assert.equal(saved.hp.temp, 7);
  const mark = boons.find((feature) => feature.name === "악마의 표식")!;
  const gone = derive(removeItem(saved, sheet, mark.itemInstanceId!));
  assert.ok(!gone.features.some((feature) => feature.name === "악마의 표식"), "taken away");
});
