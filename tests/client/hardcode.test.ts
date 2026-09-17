/**
 * V0.9 guard (CLAUDE.md §2): content names, ids and feature keys do not belong in client code. This counts the
 * shapes that betray them and fails when any count grows. Moving one to JSON lowers its ceiling here; the ceilings
 * only ever go down, and V0.9 ends with them at the exceptions HARDCODE_AUDIT.md §4 records.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const CEILINGS = {
  /** A content id literal. */
  contentIds: 20,
  /** A branch on a feature, option or event key. */
  keyBranches: 33,
  /** A branch on a class slug or a picked option id. */
  slugBranches: 2,
  /** A regex run over a name or a description. */
  nameRegex: 4,
};

const PATTERNS: Record<keyof typeof CEILINGS, RegExp> = {
  contentIds: /"dnd\.srd521\./,
  keyBranches: /key === "/,
  slugBranches: /(slug|picked) === "/,
  nameRegex: /\.test\([^)]*(nameEn|\.name\b|\.text\b)/,
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "data" ? [] : files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("V0.9: hardcoded content in client code never grows (CLAUDE.md §2)", () => {
  const lines = files("client").flatMap((path) => readFileSync(path, "utf8").split("\n").map((line, index) => ({ at: `${path}:${index + 1}`, line })));
  for (const [kind, pattern] of Object.entries(PATTERNS) as Array<[keyof typeof CEILINGS, RegExp]>) {
    const hits = lines.filter((item) => pattern.test(item.line));
    assert.ok(hits.length <= CEILINGS[kind], `${kind}: ${hits.length} > ${CEILINGS[kind]} — move the new one to JSON (CLAUDE.md §2)\n${hits.map((item) => item.at).join("\n")}`);
    if (hits.length < CEILINGS[kind]) console.log(`hardcode ${kind}: ${hits.length} — lower the ceiling from ${CEILINGS[kind]}`);
  }
});

test("H2: the combat grammar takes its content as data — a module spell id works like the SRD one (D239)", async () => {
  const { parseContract } = await import("../../client/rules/contract");
  const { contractEffect } = await import("../../client/rules/contractEffects");
  const contract = parseContract({ id: "feature:module.stalker", entryPoints: [{ id: "rule", invocation: "manual", operations: [
    { kind: "property.modify", property: "marked-spell.die", operation: "set", value: { value: 12 }, spell: "module.spell.hunters-brand" },
    { kind: "property.modify", property: "marked-spell.advantage", operation: "set", value: { value: 1 }, spell: "module.spell.hunters-brand" },
    { kind: "property.modify", property: "spell.damage.ability-modifier", operation: "add", value: { ref: "effect.target" } },
    { kind: "property.modify", property: "spell.school-damage.ability-modifier", operation: "set", value: { value: "sorcerer" }, school: "necromancy" },
  ] }] } as never, "module.stalker");
  const { application } = contractEffect(contract, (ref) => (ref === "effect.target" ? "module.spell.void-bolt" : undefined));
  assert.deepEqual(application.markedSpellDice, { "module.spell.hunters-brand": 12 });
  assert.deepEqual(application.markedSpellAdvantage, ["module.spell.hunters-brand"]);
  assert.deepEqual(application.spellDamageModifier, ["module.spell.void-bolt"]);
  assert.deepEqual(application.schoolDamageModifier, [{ school: "necromancy", classSlug: "sorcerer" }]);
});

test("H3: a gain entry point is creation grammar, not a standing property, and the SRD features read it (D240)", async () => {
  const { parseContract } = await import("../../client/rules/contract");
  const { contractEffect } = await import("../../client/rules/contractEffects");
  const { pcStats } = await import("../../client/rules/actions");
  const { build } = await import("./support");
  const contract = parseContract({ id: "feature:module.sage", entryPoints: [{ id: "gain", invocation: "gain", operations: [
    { kind: "property.modify", property: "choice.skills", operation: "set", value: { value: 2 }, params: { id: "sage-skills", mode: "expertise", from: ["arcana", "history"] } },
    { kind: "property.modify", property: "grant.ability", operation: "set", value: { value: 2 }, params: { abilities: ["int"], cap: 22 } },
  ] }] } as never, "module.sage");
  assert.deepEqual(contract.unsupported, []);
  assert.equal(contract.entryPoints[0].operations[0].kind === "property.modify" && contract.entryPoints[0].operations[0].params?.id, "sage-skills");
  assert.equal(contractEffect(contract, () => undefined).hasProperties, false, "gained once, not a sheet property");
  // The SRD features that used to be branches in tracks.ts now come from their gain contracts.
  const monk = build({ name: "몽크", classes: "monk", level: 14 }).derived;
  assert.ok(["str", "dex", "con", "int", "wis", "cha"].every((key) => monk.saves[key as "str"].terms.some((term) => term.label.includes("단련된 생존자"))), "단련된 생존자: every save");
  const barbarian = build({ name: "바바리안", classes: "barbarian", level: 18 }).derived;
  assert.equal(pcStats(barbarian).minimumScore?.str, barbarian.abilities.str.score, "불굴의 힘: a Strength save totals at least the score");
  const rogue = build({ name: "로그", classes: "rogue", level: 1 });
  assert.equal(rogue.source.choices["class.0.expertise"]?.length, 2, "rogue expertise asked from its contract");
  assert.ok(rogue.derived.proficiencies.languages.includes("도둑 은어"));
});

test("H3c: armour, speed and saves come from gain contracts — and 보호의 오라 is counted once (D241)", async () => {
  const { build } = await import("./support");
  const paladin = build({ name: "팔라딘", classes: "paladin", level: 6, abilities: { cha: 16 } }).derived;
  assert.equal(paladin.saves.str.terms.filter((term) => term.label.includes("보호의 오라")).length, 1, JSON.stringify(paladin.saves.str.terms));
  const monk = build({ name: "몽크", classes: "monk", level: 6, abilities: { dex: 16, wis: 14 } }).derived;
  assert.equal(monk.ac.value, 10 + monk.abilities.dex.modifier + monk.abilities.wis.modifier, monk.ac.source);
  assert.ok(monk.speed.terms.some((term) => term.label.includes("비무장 이동") && term.value > 0), JSON.stringify(monk.speed.terms));
  const ranger = build({ name: "레인저", classes: "ranger", level: 6 }).derived;
  assert.equal(ranger.speed.climb, ranger.speed.walk, "방랑자 gives climb and swim at walking speed");
  const sorcerer = build({ name: "소서러", classes: "sorcerer", level: 5 }).derived;
  assert.ok(sorcerer.hp.terms.some((term) => term.label.includes("용의 회복력") && term.value === 5), JSON.stringify(sorcerer.hp.terms));
});

test("H3d: option choices grant through contracts at their own level — 대지 유형 at 10, 원소의 친화력 at 6 (D242)", async () => {
  const { build } = await import("./support");
  const land9 = build({ name: "드루이드", classes: "druid", level: 9 }, { "class.0.subclass": ["dnd.srd521.subclass.druid.circle-of-the-land"], "class.2.subclass.land-type": ["polar"] }).derived;
  const land10 = build({ name: "드루이드", classes: "druid", level: 10 }, { "class.0.subclass": ["dnd.srd521.subclass.druid.circle-of-the-land"], "class.2.subclass.land-type": ["polar"] }).derived;
  assert.ok(!JSON.stringify(land9.defenses.resistances).includes("냉기") && !land9.defenses.resistances.includes("cold"), JSON.stringify(land9.defenses));
  assert.ok(JSON.stringify(land10.defenses.resistances).includes("냉기") || land10.defenses.resistances.includes("cold"), JSON.stringify(land10.defenses));
  const sorcerer = build({ name: "소서러", classes: "sorcerer", level: 6 }, { "class.5.subclass.elemental-affinity": ["fire"] }).derived;
  assert.ok(sorcerer.damageTypeModifier?.includes("fire"), JSON.stringify(sorcerer.damageTypeModifier));
  const warden = build({ name: "드루이드", classes: "druid", level: 1 }, { "class.0.primal-order": ["warden"] }).derived;
  assert.ok(warden.proficiencies.armor.some((item) => item.includes("평장")), JSON.stringify(warden.proficiencies.armor));
});
