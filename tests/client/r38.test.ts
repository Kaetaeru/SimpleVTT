/**
 * R38 (ROLL20_TABLE_SPEC.md D178): a standing effect, read out of its contract.
 *
 * `effects.ts` holds 63 hand-written functions saying what Bless, Shield, Haste and the rest do to a sheet — the
 * largest block of rules in the client that lives as code. This slice adds `property.modify` and a content module
 * that expresses fourteen of those effects as data, and the test that matters asserts the two paths produce the
 * *same* application for every one of them. Nothing is swapped over on faith.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { characterScope } from "../../client/rules/contract";
import { contractEffect } from "../../client/rules/contractEffects";
import { effectApplication, type EffectApplication } from "../../client/rules/effects";
import { build, catalog } from "./support";

const fighter = () => build({ name: "f", classes: "fighter", level: 5 }).derived;
/** Filters are functions; compare them by what they say about the sheet's own attacks instead of by identity. */
function comparable(application: EffectApplication | undefined, attacks: ReturnType<typeof fighter>["attacks"]) {
  if (!application) return application;
  const shape = (part?: { value?: number; dice?: string; filter?: (attack: never) => boolean }) =>
    part && { value: part.value, dice: part.dice, matches: part.filter ? attacks.map((attack) => part.filter!(attack as never)) : null };
  return { ...application, attack: shape(application.attack), damage: shape(application.damage) };
}

test("effects: every authored effect contract names only properties the sheet knows (D178, D247)", () => {
  const cat = catalog();
  const derived = fighter();
  const scope = characterScope(derived);
  // Contracts that say what an effect *does*; the ones that only say when it ends (R39) are a different question.
  const keys = [...cat.contracts.keys()].filter((key) => (key.startsWith("spell:") || key.startsWith("feature:")) && contractEffect(cat.contractFor(key)!, scope).hasProperties);
  assert.ok(keys.length >= 14, `${keys.length} effect contracts`);
  // R49 (D184): the hand-written table is nearly empty now, so most contracts have nothing left to compare against.
  // What this test still guards is the ones that do: where both paths exist, they must agree exactly.
  // R43: some contracts are for rules that never had a hand-written function (향상된 치명타); there is nothing to
  // compare those against, and the point of this test is that where both exist they agree.
  // H5d (D247): the hand-written table is gone; every effect contract still names only properties the engine knows.
  for (const key of keys) {
    // A reaction window runs its own properties (기묘한 회피); the sheet executor only answers for standing ones.
    if (cat.contractFor(key)!.interceptors.length) continue;
    const { application, unknown } = contractEffect(cat.contractFor(key)!, scope);
    assert.deepEqual(unknown, [], `${key}: 실행기가 모르는 property`);
    assert.ok(comparable(application, derived.attacks), key);
  }
});

test("effects: the sheet reads the contract, and an effect with no contract still reads its rule (D178)", () => {
  const cat = catalog();
  const derived = fighter();
  const applied = (key: string, name: string) => effectApplication({ key, name, source: key.startsWith("spell:") ? "spell" : "feature", duration: "1분", startedRound: 0 } as never, derived, cat);
  // 축복 has a contract; the number the sheet gets comes from the module now.
  assert.deepEqual(applied("spell:dnd.srd521.spell.bless", "축복")?.attack, { dice: "1d4" });
  // 흐릿함 has none, and its note still arrives from the hand-written table.
  assert.deepEqual(applied("spell:dnd.srd521.spell.blur", "흐릿함")?.notes, ["당신을 공격하는 명중 굴림 불리"]);
  // Something with neither is still nothing, not a silent empty application.
  assert.equal(applied("spell:dnd.srd521.spell.fireball", "화염구"), undefined);
});

test("effects: a contract naming a property this engine does not know is reported, not dropped (D178)", () => {
  const made = contractEffect({
    id: "spell:made-up", ruleKey: "spell:made-up", entryId: "x", payments: [], interceptors: [], unsupported: [],
    entryPoints: [{ id: "while-active", invocation: "manual", operations: [
      { kind: "property.modify", property: "ac.bonus", operation: "add", value: { value: 3 } },
      { kind: "property.modify", property: "존재하지-않는.값", operation: "add", value: { value: 1 } },
    ] }],
  }, characterScope(fighter()));
  assert.deepEqual(made.application.ac, { add: 3 }, "what it does understand still lands");
  assert.deepEqual(made.unknown, ["존재하지-않는.값"], "and what it does not is named");
});
