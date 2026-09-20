/**
 * V0.9 D342 (SRD_MODULE_PLAN.md §33): two swings for the one bonus action.
 *
 * A spell may hand its caster attacks rather than a roll of its own (신속한 화살통: as a bonus action, two attacks
 * with a weapon that fires ammunition). The grammar already had `bonus-action.attack:<weapons>`, but it only ever
 * offered a single swing — the `amount` was read for the free-swing bucket and dropped for this one. It is now the
 * number of attacks that bonus action is worth, which is what the spell says.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { contractBonusActions } from "../../client/rules/contractActivation";
import { characterScope } from "../../client/rules/contract";
import { sourceOf } from "./support";

const SPELL = "test.d342.spell.quiver";
const ONE = "test.d342.spell.single";

const effectEntry = (id: string, name: string, amount: number) => ({
  id: `effect.spell.${id}`, category: "option",
  presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } },
  mechanics: [{ kind: "common-play", config: { id: `spell:${id}`, entryPoints: [
    { id: "while-active", invocation: "manual", operations: [
      { kind: "economy.modify", bucket: "bonus-action.attack:ammunition", amount: { value: amount } },
    ] },
  ] } }],
});

const MODULE = { moduleId: "test.d342", moduleVersion: "1", content: [effectEntry(SPELL, "빠른 화살", 2), effectEntry(ONE, "한 발", 1)] } as unknown as RuleModuleJson;

function offers(spellId: string) {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "레인저", classes: "ranger", level: 9, abilities: { dex: 16, wis: 14 } }), cat);
  const features = [...made.derived.features, { id: `spell:${spellId}`, name: spellId === SPELL ? "빠른 화살" : "한 발" }];
  return contractBonusActions({ features }, cat, characterScope(made.derived)).filter((item) => item.attackScope === "ammunition");
}

test("D342: the bonus action may be worth two swings", () => {
  const two = offers(SPELL);
  assert.equal(two.length, 1, JSON.stringify(two));
  assert.equal(two[0].count, 2, "the amount is how many attacks it gives");
  assert.equal(two[0].kind, "attack");
});

test("D342: one swing is still written without a count", () => {
  const one = offers(ONE);
  assert.equal(one.length, 1, JSON.stringify(one));
  assert.equal(one[0].count, undefined, "nothing changes for the rules that give a single attack");
});
