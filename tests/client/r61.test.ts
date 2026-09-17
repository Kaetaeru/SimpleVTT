/**
 * R61 (ROLL20_TABLE_SPEC.md D196): the other two kinds of d20 test, and one more swing.
 *
 * R55 opened attack rolls to a contract's advantage. Ability checks and saving throws were still hardcoded: 배우's
 * disguise, 잠행자's stealth, 튼튼함's death saves and 전투 시전자's concentration were sentences the player had to
 * remember and declare. And a feat that buys one more swing as a bonus action (쌍수 사용자, 장병기 달인, 대형 무기
 * 달인's 베어 넘기기) handed the turn a bonus action back with no attack behind it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { emptySource } from "../../client/character/source";
import { deriveCharacter } from "../../client/character/derive";
import { initialRuntime } from "../../client/character/runtime";
import { addItem } from "../../client/character/play";
import { advantageFor, pcStats, resolveAction } from "../../client/rules/actions";
import { ids } from "./support";

const CONTRACTS = JSON.parse(readFileSync("content/supplements/phb-2024.feat-common-play/module.json", "utf8"));
const featEntry = (slug: string, name: string) => ({
  id: `phb2024.feat.${slug}`, category: "feat",
  presentation: { defaultLocale: "ko-KR", originalName: name, locales: { "ko-KR": { name } } },
  mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4, abilityIncrease: { any: ["dex"], amount: 1, maximum: 20 } } }],
});
const supplement = (slug: string, name: string) => ({
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft",
  moduleId: "phb-2024-supplement", moduleVersion: "1", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR", dependencies: [], conflicts: [], capabilities: [], extensionPoints: [], content: [featEntry(slug, name)],
});

function rogueWith(slug: string, name: string, weapon = "shortsword") {
  const catalog = createCatalog([supplement(slug, name), CONTRACTS] as never);
  const base = emptySource({
    name: "도적", origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 12, dex: 17, con: 14, int: 10, wis: 10, cha: 12 } },
    tracks: Array.from({ length: 8 }, () => ({ classId: ids.cls("rogue"), hp: { kind: "fixed" as const } })),
    equipment: { mode: "loadout" },
  });
  const made = autofill(base, catalog, { prefer: { "class.3.asi": [`phb2024.feat.${slug}`] } });
  const runtime = addItem(initialRuntime(made.derived), { itemId: `dnd.srd521.item.weapon.${weapon}`, name: weapon });
  const derived = deriveCharacter(made.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory });
  return { catalog, runtime, derived };
}

/** Dice that walk a fixed list, so "was a second die rolled" is not a matter of luck. */
const scripted = (...values: number[]) => { let at = 0; return () => { const value = values[at] ?? values[values.length - 1]; at += 1; return (value - 0.5) / 20; }; };

test("R61: 잠행자's stealth is advantage the app rolls, not a line to remember (D196)", () => {
  const { derived } = rogueWith("skulker", "잠행자");
  const stats = pcStats(derived);
  const found = advantageFor(stats, "ability-check", { skill: "stealth" });
  assert.ok(found, JSON.stringify(derived.rollAdvantage));
  assert.ok(found!.reason.startsWith("잠행자"), found!.reason);
  assert.equal(advantageFor(stats, "ability-check", { skill: "athletics" }), undefined, "one skill, not every skill");
  assert.equal(advantageFor(stats, "saving-throw", { ability: "dex" }), undefined, "and not a saving throw");

  // Hiding really rolls two dice and keeps the better, and the card says why.
  const result = resolveAction({ kind: "hide", actor: { name: "도적", stats, conditions: [] }, random: scripted(4, 17) });
  assert.equal(result.check!.d20, 17);
  assert.equal(result.check!.dropped, 4);
  assert.ok(result.check!.reason?.includes("잠행자"), result.check!.reason);
});

test("R61: a character without the feat still rolls one die (D196)", () => {
  const { derived } = rogueWith("tough", "강인함");
  const stats = pcStats(derived);
  assert.equal(advantageFor(stats, "ability-check", { skill: "stealth" }), undefined);
  const result = resolveAction({ kind: "hide", actor: { name: "도적", stats, conditions: [] }, random: scripted(4, 17) });
  // V3c (D257): a rogue of 7+ has 믿음직한 재능, so a proficient Stealth d20 below 10 counts as 10.
  assert.equal(result.check!.d20, stats.checkMinimum?.skills.includes("stealth") ? Math.max(4, stats.checkMinimum.value) : 4, "the first die stands");
  assert.equal(result.check!.dropped, undefined);
});

test("R61: 배우 narrows itself to the two skills it names (D196)", () => {
  const { derived } = rogueWith("actor", "배우");
  const stats = pcStats(derived);
  for (const skill of ["deception", "performance"]) assert.ok(advantageFor(stats, "ability-check", { skill }), skill);
  assert.equal(advantageFor(stats, "ability-check", { skill: "persuasion" }), undefined);
});

test("R61: 튼튼함 on death saves and 전투 시전자 on Constitution saves (D196, D257)", () => {
  const durable = pcStats(rogueWith("durable", "튼튼함").derived);
  // V3c (D257): 튼튼함 is advantage on death saves, not on every Constitution save.
  assert.ok(advantageFor(durable, "death-save"), JSON.stringify(durable.advantage));
  assert.equal(advantageFor(durable, "saving-throw", { ability: "con" }), undefined, "a Constitution save is not a death save");
  assert.equal(advantageFor(durable, "ability-check", { ability: "con" }), undefined, "a save is not a check");
  const caster = pcStats(rogueWith("war-caster", "전투 시전자").derived);
  assert.ok(advantageFor(caster, "saving-throw", { ability: "con" }), JSON.stringify(caster.advantage));
});

test("R61: a feat that buys one more swing offers it as a real attack (D196)", () => {
  const dual = rogueWith("dual-wielder", "쌍수 사용자").derived;
  assert.deepEqual(dual.bonusActions?.filter((item) => item.kind === "attack"), [{ kind: "attack", source: "쌍수 사용자", attackScope: "one-handed-melee" }]);
  const polearm = rogueWith("polearm-master", "장병기 달인").derived;
  assert.deepEqual(polearm.bonusActions?.filter((item) => item.kind === "attack"), [{ kind: "attack", source: "장병기 달인", attackScope: "two-handed" }]);
  // 대형 무기 달인's extra swing is conditional — it is bought by a critical or a kill — so it is not a standing
  // menu entry. R53's aftermath hands the bonus action back at the moment it is earned and says so in the log.
  const gwm = rogueWith("great-weapon-master", "대형 무기 달인").derived;
  assert.deepEqual(gwm.bonusActions?.filter((item) => item.kind === "attack"), [], "a conditional swing does not sit in the menu all turn");
  // A feat with neither kind of clause leaves the menu alone.
  // V3e (D259): the rogue base has 교활한 행동's bonus actions; the feat adds no swing.
  assert.deepEqual(rogueWith("tough", "강인함").derived.bonusActions?.filter((item) => item.kind === "attack"), []);
});
