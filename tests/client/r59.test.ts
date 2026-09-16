/**
 * R59 (ROLL20_TABLE_SPEC.md D194): hit dice a contract can spend, and actions it can move.
 *
 * Two small seams, both with the same shape: the sheet already knew the answer and no contract could say it. Hit dice
 * sit on every character sheet and a rest gives them back, but a feature that spends one (튼튼함's 신속한 회복) had
 * to be read and done by hand. And an official action that a feat lets you take as a bonus action (예리한 정신's
 * 빠른 연구, 관찰력's 빠른 수색) was a sentence next to a menu that did not list it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { emptySource } from "../../client/character/source";
import { initialRuntime } from "../../client/character/runtime";
import { spendableHitDie, useFeature, shortRest } from "../../client/character/play";
import { featureActivation } from "../../client/rules/activation";
import { HIT_DIE_RESOURCE } from "../../client/rules/contractActivation";
import { ids } from "./support";

const CONTRACTS = JSON.parse(readFileSync("content/supplements/phb-2024.feat-common-play/module.json", "utf8"));
const featEntry = (slug: string, name: string) => ({
  id: `phb2024.feat.${slug}`, category: "feat",
  presentation: { defaultLocale: "ko-KR", originalName: name, locales: { "ko-KR": { name } } },
  mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4, abilityIncrease: { any: ["con"], amount: 1, maximum: 20 } } }],
});
const supplement = (slugs: Array<[string, string]>) => ({
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft",
  moduleId: "phb-2024-supplement", moduleVersion: "1", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR", dependencies: [], conflicts: [], capabilities: [], extensionPoints: [], content: slugs.map(([slug, name]) => featEntry(slug, name)),
});

function fighterWith(slug: string, name: string) {
  const catalog = createCatalog([supplement([[slug, name]]), CONTRACTS] as never);
  const base = emptySource({
    name: "전사", origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 15, dex: 12, con: 15, int: 10, wis: 10, cha: 8 } },
    tracks: Array.from({ length: 8 }, () => ({ classId: ids.cls("fighter"), hp: { kind: "fixed" as const } })),
    equipment: { mode: "loadout" },
  });
  const made = autofill(base, catalog, { prefer: { "class.3.asi": [`phb2024.feat.${slug}`] } });
  return { catalog, made, derived: made.derived, runtime: initialRuntime(made.derived) };
}

test("R59: 튼튼함's bonus action really spends a hit die (D194)", () => {
  const { catalog, derived, runtime } = fighterWith("durable", "튼튼함");
  const feature = derived.features.find((item) => item.name === "튼튼함")!;
  const activation = featureActivation(feature, derived)!;
  assert.equal(activation.hitDie, true, JSON.stringify(activation));
  assert.equal(activation.heal?.(derived), "1d10", "the heal is a formula the sheet rolls");
  assert.equal(spendableHitDie(runtime, derived), "d10", "a fighter's own die");

  const used = useFeature(runtime, derived, feature, activation, { healRoll: 7 })!;
  assert.equal(used.hitDiceSpent.d10, 1, JSON.stringify(used.hitDiceSpent));
  assert.ok(used.log.some((line) => line.text.includes("히트 다이스 d10 소비")), JSON.stringify(used.log.slice(-1)));
  void catalog;
});

test("R59: with every hit die spent, the use is refused rather than faked (D194)", () => {
  const { derived, runtime } = fighterWith("durable", "튼튼함");
  const feature = derived.features.find((item) => item.name === "튼튼함")!;
  const activation = featureActivation(feature, derived)!;
  const drained = { ...runtime, hitDiceSpent: { d10: derived.hitDice.d10 } };
  assert.equal(spendableHitDie(drained, derived), undefined);
  assert.equal(useFeature(drained, derived, feature, activation, { healRoll: 7 }), null, "refused, not silently free");
  // A short rest gives them back the way it always has, so the contract inherits the rest rules for free.
  const rested = shortRest(drained, derived);
  assert.ok((rested.hitDiceSpent.d10 ?? 0) <= derived.hitDice.d10);
});

test("R59: the reserved id is what a contract writes, and only that id means a hit die (D194)", () => {
  assert.equal(HIT_DIE_RESOURCE, "resource.hit-die");
  const { derived } = fighterWith("durable", "튼튼함");
  // 재기의 바람 spends an ordinary pool, and is untouched by the reserved id.
  const secondWind = derived.features.find((item) => item.name === "재기의 바람")!;
  const activation = featureActivation(secondWind, derived)!;
  assert.equal(activation.hitDie, undefined);
  assert.equal(activation.resourceId, "resource.fighter.second-wind");
});

test("R59: 예리한 정신 and 관찰력 move an action into the bonus-action menu (D194)", () => {
  const keen = fighterWith("keen-mind", "예리한 정신").derived;
  assert.deepEqual(keen.bonusActions, [{ kind: "study", source: "예리한 정신" }]);
  const observant = fighterWith("observant", "관찰력").derived;
  assert.deepEqual(observant.bonusActions, [{ kind: "search", source: "관찰력" }]);
  // A character with neither has an empty list rather than a missing one.
  const plain = fighterWith("tough", "강인함").derived;
  assert.deepEqual(plain.bonusActions, []);
});
