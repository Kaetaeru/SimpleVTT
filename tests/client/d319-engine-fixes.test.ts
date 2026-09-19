/**
 * V0.9 D319: three engine faults the PHB module review found, each on a synthetic module (CLAUDE.md §1.6).
 *
 * - `ability-check.bonus` with `abilities` added its bonus to every check and every skill; it now stays on the named
 *   abilities' checks and on the skills that use them.
 * - A feature resource recovering on `short-or-long-rest` never came back on a short rest (the value was unknown).
 * - `grant.spells` written as one id instead of a list granted nothing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { deriveCharacter } from "../../client/character/derive";
import { emptySource } from "../../client/character/source";

const SUBCLASS = "test.d319.subclass.lore";
const FEATURE = `${SUBCLASS}.feature.3-1`;
const FIREBALL = "dnd.srd521.spell.fireball";

const MODULE = {
  moduleId: "test.d319", moduleVersion: "1",
  content: [
    {
      id: SUBCLASS, category: "subclass",
      presentation: { originalName: "Lore", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "지식의 권역" } } },
      relationships: [{ kind: "parent", target: "dnd.srd521.class.cleric" }],
      progressionContributions: [{ track: "dnd.srd521.class.cleric", threshold: 3, grants: [FEATURE] }],
      mechanics: [{ kind: "subclass-definition", config: {} }],
    },
    {
      id: FEATURE, category: "option",
      presentation: { originalName: "Lore Keeper", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "지식 수호" } } },
      mechanics: [{
        kind: "common-play",
        config: {
          id: FEATURE,
          entryPoints: [
            { id: "gain", invocation: "gain", operations: [
              { kind: "property.modify", property: "grant.resource", operation: "add", value: { value: 2 }, params: { id: "resource.test.d319.lore", label: "지식", recovery: "short-or-long-rest" } },
              { kind: "property.modify", property: "grant.spells", operation: "add", params: { spells: FIREBALL } },
            ] },
            { id: "rule", invocation: "manual", operations: [{ kind: "property.modify", property: "ability-check.bonus", operation: "add", value: { value: 2 }, abilities: ["int"] }] },
          ],
        },
      }],
    },
  ],
} as unknown as RuleModuleJson;

function cleric() {
  const catalog = createCatalog([MODULE]);
  const source = emptySource({
    name: "학자", origin: { speciesId: "dnd.srd521.species.human", backgroundId: "dnd.srd521.background.soldier" },
    abilities: { method: "manual", base: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 12 } },
    tracks: Array.from({ length: 3 }, () => ({ classId: "dnd.srd521.class.cleric", hp: { kind: "fixed" as const } })),
    choices: { "class.2.subclass": [SUBCLASS] },
    equipment: { mode: "loadout" },
  });
  const filled = autofill(source, catalog, { prefer: { "class.2.subclass": [SUBCLASS] } });
  return deriveCharacter(filled.source, catalog);
}

test("D319: a check bonus for named abilities stays on those checks", () => {
  const derived = cleric();
  const skill = (id: string) => derived.skills.find((entry) => entry.id === id)!;
  assert.ok(skill("arcana").terms.some((term) => term.label.includes("지식 수호")), JSON.stringify(skill("arcana").terms));
  assert.ok(!skill("athletics").terms.some((term) => term.label.includes("지식 수호")), "근력 기술에는 붙지 않는다");
  assert.deepEqual(derived.checkTerms.map((term) => term.abilities), [["int"]]);
});

test("D319: short-or-long-rest recovers on a short rest; one spell id is a list of one", () => {
  const derived = cleric();
  const pool = derived.resources.find((entry) => entry.id === "resource.test.d319.lore");
  assert.equal(pool?.recovery, "짧은 휴식", JSON.stringify(pool));
  assert.ok(derived.spellcasting.some((entry) => entry.alwaysPrepared.includes(FIREBALL)), JSON.stringify(derived.spellcasting.map((entry) => entry.alwaysPrepared)));
});
