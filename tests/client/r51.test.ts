/**
 * R51 (ROLL20_TABLE_SPEC.md D186): the critical hit that was only a word, and the feats that could not speak.
 *
 * Two things measured in play and found broken. The DM palette's 치명타 relabelled a card and left the damage alone,
 * because every re-resolution handed the first roll's dice to a branch that skipped the crit logic. And a feat could
 * never meet a contract: its feature id carried the slot it was picked in, so `feat.background.dnd.srd521.feat.alert`
 * could only ever match a key nobody would write. Both are one line of cause each, and both are fixed here.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { applyDamage, diceFrom, type Combatant, type DamagePart } from "../../client/rules/resolve";
import { featureRuleKey, qualifyRuleKey } from "../../client/rules/activation";
import { featureContract } from "../../client/rules/contractActivation";
import { characterScope, planRollModify } from "../../client/rules/contract";
import { contractEffect } from "../../client/rules/contractEffects";
import { pcRescues } from "../../client/rules/contractUse";
import { initialRuntime } from "../../client/character/runtime";
import { build, catalog, ids } from "./support";
import type { JournalCharacter } from "../../client/campaign/journal";

const target = (extra: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 60, max: 60, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [], ...extra });
const maxDice = diceFrom(() => 0.999);
const axe: DamagePart[] = [{ formula: "1d12+5", type: "참격", label: "대도끼" }];

test("R51: the palette's 치명타 doubles the dice it did not have, and keeps the ones it did (D186)", () => {
  const hit = applyDamage(target(), axe, maxDice, {});
  assert.deepEqual(hit.damage[0].dice, [12], "one die on a hit");
  assert.equal(hit.damageTotal, 17);

  // The palette re-resolves with the card's own dice and the new outcome. Before R51 this returned 17.
  const promoted = applyDamage(target(), axe, maxDice, { crit: true, fixed: hit.damage.map((part) => part.dice) });
  assert.deepEqual(promoted.damage[0].dice, [12, 12], "the die already shown is kept; the second is rolled");
  assert.equal(promoted.damageTotal, 29, "1d12 doubled + 5");

  // And the other way: a critical the DM takes back drops the extra die instead of keeping both.
  const demoted = applyDamage(target(), axe, maxDice, { fixed: promoted.damage.map((part) => part.dice) });
  assert.deepEqual(demoted.damage[0].dice, [12], "back to one die");
  assert.equal(demoted.damageTotal, 17);
});

test("R51: a flat rider still never doubles, and reused dice do not reroll 야만적 공격자 (D186)", () => {
  const parts: DamagePart[] = [{ formula: "1d6", type: "참격", label: "무기" }, { formula: "2", type: "화염", label: "리본", critDoubles: false }];
  const crit = applyDamage(target(), parts, maxDice, { crit: true });
  assert.deepEqual(crit.damage[0].dice, [6, 6], "the weapon's dice double");
  assert.deepEqual(crit.damage[1].dice, [], "the flat rider has no dice to double");
  assert.equal(crit.damageTotal, 14);
  // A savage reroll on a re-resolution would silently change a number the player already saw.
  const again = applyDamage(target(), parts, { d: () => 1 }, { crit: true, savage: true, fixed: crit.damage.map((part) => part.dice) });
  assert.deepEqual(again.damage[0].dice, [6, 6], "the dice handed in are the dice used");
});

test("R51: 중갑 달인's flat reduction lands after resistance and cannot go below zero (D186)", () => {
  const armoured = target({ reduction: [{ types: ["타격", "관통", "참격"], amount: 4, source: "중갑 달인" }] });
  const hit = applyDamage(armoured, axe, maxDice, {});
  assert.equal(hit.damageTotal, 13, "17 − 4");
  assert.equal(hit.damage[0].adjustment, "−4 중갑 달인");
  const resistant = target({ reduction: [{ types: ["참격"], amount: 4, source: "중갑 달인" }], defenses: { resistances: ["참격"], immunities: [], vulnerabilities: [] } });
  assert.equal(applyDamage(resistant, axe, maxDice, {}).damageTotal, 4, "halved to 8 first, then −4");
  const tiny = applyDamage(target({ reduction: [{ types: ["참격"], amount: 40, source: "중갑 달인" }] }), axe, maxDice, {});
  assert.equal(tiny.damageTotal, 0, "never negative");
});

test("R51: a feat's rule key names the feat, not the slot it was picked in (D186)", () => {
  assert.equal(featureRuleKey("feat.background.dnd.srd521.feat.savage-attacker"), "feat:savage-attacker");
  assert.equal(featureRuleKey("feat.class.3.asi.dnd.srd521.feat.ability-score-improvement"), "feat:ability-score-improvement");
  // The supplement's own ids land on the same key, which is the whole point: one contract serves both.
  assert.equal(featureRuleKey("feat.class.4.asi.phb2024.feat.great-weapon-master"), "feat:great-weapon-master");
  assert.equal(featureRuleKey("feat.class.18.epic-boon.dnd.srd521.feat.epic.fate"), "feat:epic.fate");
  // A class feature is untouched, and a key that already names its namespace is not given a second one.
  assert.equal(featureRuleKey("barbarian.1.barbarian.rage"), "barbarian.rage");
  assert.equal(qualifyRuleKey("barbarian.rage"), "feature:barbarian.rage");
  assert.equal(qualifyRuleKey("feat:epic.combat-prowess"), "feat:epic.combat-prowess");
  assert.ok(featureContract(catalog(), "feat:epic.combat-prowess"), "and the contract is found through it");
});

test("R51: 저항할 수 없는 공격의 은총 reaches the sheet as a rule, not as prose (D186)", () => {
  const made = build({ name: "용사", classes: "fighter", level: 19 }, { "class.18.epic-boon": [ids.feat("epic.irresistible-offense")] });
  const boon = made.derived.features.find((feature) => feature.name.includes("저항할 수 없는"));
  assert.ok(boon, made.derived.features.filter((feature) => feature.source === "feat").map((feature) => feature.name).join(", "));
  assert.deepEqual(made.derived.ignoresResistance, ["타격", "관통", "참격"]);
  assert.equal(boon!.execution, "derived", `${boon!.name}: ${JSON.stringify(boon!.rules)}`);
  // The half the app cannot see is still said out loud rather than dropped.
  assert.ok(boon!.rules?.some((line) => line.includes("20이 나오면")), JSON.stringify(boon!.rules));
});

test("R51: 전투 기량의 은총 offers itself on a miss, and its 20 is a natural 20 (D186)", () => {
  const made = build({ name: "용사", classes: "fighter", level: 19 }, { "class.18.epic-boon": [ids.feat("epic.combat-prowess")] });
  const entry = { id: "pc", runtime: initialRuntime(made.derived) } as unknown as JournalCharacter;
  const offers = pcRescues(entry, made.derived, catalog(), "attack-roll", "failure");
  assert.deepEqual(offers.map((offer) => offer.feature), ["전투 기량의 은총"]);
  // A failed ability check is not what this boon fixes — 전술적 사고 answers that one, and the boon stays out of it.
  const checks = pcRescues(entry, made.derived, catalog(), "ability-check", "failure").map((offer) => offer.feature);
  assert.ok(!checks.includes("전투 기량의 은총"), checks.join(", "));
  const plan = planRollModify(offers[0].interceptor.operations, characterScope(made.derived), { d: () => 1 });
  assert.equal(plan.d20, 20, "the d20 is replaced, so the resolver reads it as a natural 20 and crits");
  assert.equal(plan.delta, 0);
});

test("R51: a contract may read what is worn, and 운명의 은총 has a pool to spend (D186)", () => {
  const made = build({ name: "용사", classes: "fighter", level: 19 }, { "class.18.epic-boon": [ids.feat("epic.fate")] });
  const pool = made.derived.resources.find((resource) => resource.id === "resource.feat.fate");
  assert.ok(pool, made.derived.resources.map((resource) => resource.id).join(", "));
  assert.equal(pool!.max, 1);
  assert.equal(pool!.restore.short, "all", "짧은 휴식 또는 긴 휴식");
  // The armour refs the PHB feats are written against.
  const scope = characterScope(made.derived);
  assert.equal(typeof scope("armor.training"), "string");
  assert.equal(scope("actor.level"), 19);
  assert.equal(typeof scope("equipment.shield"), "boolean");
});

test("R51: the new attack scopes narrow a contract to a weapon property (D186)", () => {
  const made = build({ name: "전사", classes: "fighter", level: 4 });
  const contract = {
    id: "test", ruleKey: "test", entryId: "test", payments: [], entryPoints: [{ id: "rule", invocation: "manual", operations: [
      { kind: "property.modify" as const, property: "damage.bonus", operation: "add", value: { value: 2 }, scope: "heavy" },
    ] }], interceptors: [], unsupported: [],
  };
  const { application, unknown } = contractEffect(contract, characterScope(made.derived));
  assert.deepEqual(unknown, [], "heavy is a scope this engine knows now");
  assert.ok(application.damage?.filter, "and it became a filter");
  assert.equal(application.damage!.filter!({ properties: ["heavy", "two-handed"], itemId: "x" } as never), true);
  assert.equal(application.damage!.filter!({ properties: ["light"], itemId: "x" } as never), false);
});
