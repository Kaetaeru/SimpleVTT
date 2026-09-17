/**
 * R39 (ROLL20_TABLE_SPEC.md D179): the three effect operations.
 *
 * R38 made what an effect *does* into data. This one makes what starts it, what ends it and what pauses it into data
 * too. `effect.apply` carries the template and a `lifetime`; only `until-duration` gets a round counter, because the
 * other eight end on something this engine cannot see and a made-up countdown is worse than none.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { addItem, endEffect, startEffect } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { deriveCharacter } from "../../client/character/derive";
import { featureActivation, featureRuleKey } from "../../client/rules/activation";
import { characterScope } from "../../client/rules/contract";
import { contractDurations, contractRemovals, contractSuppressions, featureContract, selectorMatches } from "../../client/rules/contractActivation";
import { applyActiveEffects } from "../../client/rules/effects";
import { build, catalog } from "./support";

const FEATURE_CONTRACTS = [
  ["barbarian", 20, "barbarian.rage"], ["barbarian", 20, "barbarian.reckless-attack"],
  ["sorcerer", 20, "sorcerer.innate-sorcery"], ["sorcerer", 20, "sorcerer.draconic.dragon-wings#while-active"],
  ["monk", 20, "monk.superior-defense"], ["paladin", 20, "paladin.oath-of-devotion.sacred-weapon"], ["paladin", 20, "paladin.oath-of-devotion.holy-nimbus"],
  ["druid", 20, "druid.circle-of-the-land.natures-sanctuary"], ["ranger", 20, "ranger.natures-veil#use"],
] as Array<[string, number, string]>;

test("effects: every authored effect.apply starts exactly the duration the hand-written table started (D179)", () => {
  const cat = catalog();
  const seen = new Set<string>();
  for (const [slug, level, key] of FEATURE_CONTRACTS) {
    const made = build({ name: slug, classes: slug, level });
    const feature = made.derived.features.find((item) => featureRuleKey(item.id) === key);
    assert.ok(feature, `${key}: ${slug} ${level}레벨에 그 특성이 없습니다`);
    const before = featureActivation(feature, made.derived)!.duration!(made.derived);
    const after = featureActivation(feature, made.derived, contractDurations(cat, characterScope(made.derived)))!.duration!(made.derived);
    // An absent `rounds` and an explicit `undefined` mean the same thing to the sheet; compare what it reads.
    const shape = (duration: typeof before) => ({ text: duration.text, rounds: duration.rounds ?? null, concentration: duration.concentration, instantaneous: duration.instantaneous });
    assert.deepEqual(shape(after), shape(before), key);
    assert.ok(featureContract(cat, key), key);
    seen.add(key);
  }
  assert.equal(seen.size, FEATURE_CONTRACTS.length);
});

test("effects: only until-duration gets a counter; the rest print their reason (D179)", () => {
  const cat = catalog();
  const made = build({ name: "r", classes: "ranger", level: 20 });
  const scope = characterScope(made.derived);
  // 마귀의 회복력 lasts until the next rest: a duration the table watches, with no countdown invented for it.
  const resilience = contractDurations(cat, characterScope(build({ name: "w", classes: "warlock", level: 10 }).derived))("warlock.fiend.fiendish-resilience#fire")!.duration!;
  assert.equal(resilience.text, "다음 휴식까지");
  assert.equal(resilience.rounds, undefined);
  // 격노 states its rounds, so it counts.
  const rage = contractDurations(cat, characterScope(build({ name: "b", classes: "barbarian", level: 5 }).derived))("barbarian.rage")!.duration!;
  assert.equal(rage.rounds, 100);
  assert.equal(contractDurations(cat, scope)("없는.특성"), undefined);
});

test("effects: effect.remove ends what it names, effect.suppress pauses it instead (D179)", () => {
  const cat = catalog();
  const made = build({ name: "d", classes: "druid", level: 20 });
  const scope = characterScope(made.derived);
  // 야생 변신 replaces the form you were in rather than stacking with it.
  assert.deepEqual(contractRemovals(featureContract(cat, "druid.wild-shape")!, scope), ["feature:druid.wild-shape"]);
  // 반마법 지대 pauses every spell effect without ending any of them.
  const field = contractSuppressions(cat.contractFor("spell:dnd.srd521.spell.antimagic-field")!, scope)[0];
  assert.deepEqual(field, { selector: "spell:*", suppressed: true, reason: "반마법 지대 안" });
  assert.equal(selectorMatches("spell:*", "spell:bless"), true);
  assert.equal(selectorMatches("spell:*", "feature:barbarian.rage"), false);
  assert.equal(selectorMatches("*", "feature:barbarian.rage"), true);
});

test("effects: a suppressed effect stays on the sheet, changes nothing, and says what is holding it (D179)", () => {
  const cat = catalog();
  const made = build({ name: "w", classes: "wizard", level: 9 });
  let runtime = initialRuntime(made.derived);
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.quarterstaff", name: "육척봉" });
  const derived = deriveCharacter(made.source, cat, { equipped: runtime.equipped, inventory: runtime.inventory });
  const bless = { key: "spell:dnd.srd521.spell.bless", name: "축복", source: "spell" as const, duration: "1분", concentration: false, rounds: 10, elapsed: 0, startedAt: "" };
  const field = { key: "spell:dnd.srd521.spell.antimagic-field", name: "반마법 지대", source: "spell" as const, duration: "1시간", concentration: true, elapsed: 0, startedAt: "" };
  const alone = applyActiveEffects(derived, [bless], cat);
  assert.ok(alone.activeEffects.find((item) => item.name === "축복")?.applied, JSON.stringify(alone.activeEffects));
  const attacked = alone.attacks[0]?.attackTerms.some((term) => term.dice === "1d4");
  assert.equal(attacked, true, "축복 alone adds its die");
  const paused = applyActiveEffects(derived, [bless, field], cat);
  const row = paused.activeEffects.find((item) => item.name === "축복")!;
  assert.equal(row.applied, false);
  assert.deepEqual(row.notes, ["멈춤 — 반마법 지대 안"]);
  assert.equal(paused.attacks[0]?.attackTerms.some((term) => term.dice === "1d4"), false, "and the die is gone while it is paused");
  // The field does not pause itself.
  assert.notEqual(paused.activeEffects.find((item) => item.name === "반마법 지대")?.notes?.[0], "멈춤 — 반마법 지대 안");
  void startEffect; void endEffect;
});
