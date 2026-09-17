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
  keyBranches: 54,
  /** A branch on a class slug or a picked option id. */
  slugBranches: 16,
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
