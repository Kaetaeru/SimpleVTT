/**
 * V0.9 D305: `grant.spell-lists` opens other classes' lists to a class's prepared spells (마법의 비밀). The operation
 * was named in the gain switch but fell through to "unknown", so a 10th-level bard warned and kept only its own list.
 * Checked on the SRD bard and on a synthetic module feature that grants the same operation (CLAUDE.md §1.6).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { build, choice, ids, sourceOf } from "./support";

const wizardOnly = (catalog: ReturnType<typeof createCatalog>, level: number) =>
  catalog.spells.find((spell) => spell.level === level && spell.classes.includes(ids.cls("wizard")) && !spell.classes.includes(ids.cls("bard")))!;

test("D305: a 10th-level bard prepares from the cleric, druid and wizard lists, without a warning", () => {
  const catalog = createCatalog();
  const derived = build({ classes: "bard", level: 10 }).derived;
  assert.deepEqual(derived.validation.warnings.filter((line) => line.includes("획득 연산")), []);
  const options = choice(derived, "class.0.spells")?.options.map((option) => option.id) ?? [];
  assert.ok(options.includes(wizardOnly(catalog, 3).id), "a wizard-only spell is offered");
  // Before 10th level the other lists stay closed.
  const ninth = choice(build({ classes: "bard", level: 9 }).derived, "class.0.spells")?.options.map((option) => option.id) ?? [];
  assert.ok(!ninth.includes(wizardOnly(catalog, 3).id));
});

test("D305: a module feature granting another class's list opens it the same way", () => {
  const SUBCLASS = "test.d305.subclass.sorcerer.scholar";
  const FEATURE = `${SUBCLASS}.feature.3-1`;
  const module = {
    moduleId: "test.d305", moduleVersion: "1",
    content: [
      { id: SUBCLASS, category: "subclass", presentation: { originalName: "Scholar", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "학자" } } }, relationships: [{ kind: "parent", target: ids.cls("sorcerer") }], progressionContributions: [{ track: ids.cls("sorcerer"), threshold: 3, grants: [FEATURE] }], mechanics: [] },
      { id: FEATURE, category: "option", presentation: { originalName: "Borrowed Lore", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "빌린 지식" } } }, mechanics: [{ kind: "common-play", config: { id: FEATURE, entryPoints: [{ id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.spell-lists", operation: "set", value: { value: 1 }, params: { classes: ["cleric"] } }] }] } }] },
    ],
  } as unknown as RuleModuleJson;
  const catalog = createCatalog([module]);
  const derived = autofill(sourceOf({ classes: "sorcerer", level: 3, choices: { "class.2.subclass": [SUBCLASS] } }), catalog, { prefer: { "class.2.subclass": [SUBCLASS] } }).derived;
  assert.deepEqual(derived.validation.warnings.filter((line) => line.includes("획득 연산")), []);
  const clericOnly = catalog.spells.find((spell) => spell.level === 1 && spell.classes.includes(ids.cls("cleric")) && !spell.classes.includes(ids.cls("sorcerer")))!;
  const options = choice(derived, "class.0.spells")?.options.map((option) => option.id) ?? [];
  assert.ok(options.includes(clericOnly.id), `${clericOnly.id} is offered`);
});
