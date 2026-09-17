/**
 * R97 (ROLL20_TABLE_SPEC.md D232): features that change the sheet itself, which used to ask the player to edit it by
 * hand — 몸과 마음, 미끄러운 정신, 학자, 전승 학파의 추가 숙련, 기적술사·마법사의 지혜 판정 보너스.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { build } from "./support";

test("R97: 몸과 마음 raises Dexterity and Wisdom by 4 up to 25 (D232)", () => {
  const before = build({ name: "몽크", classes: "monk", level: 19 }).derived;
  const after = build({ name: "몽크", classes: "monk", level: 20 }).derived;
  assert.equal(after.abilities.dex.score, Math.min(25, before.abilities.dex.score + 4));
  assert.equal(after.abilities.wis.score, Math.min(25, before.abilities.wis.score + 4));
});

test("R97: 미끄러운 정신 makes the rogue proficient in Wisdom and Charisma saves (D232)", () => {
  const rogue = build({ name: "로그", classes: "rogue", level: 15 }).derived;
  assert.ok(rogue.saves.wis.terms.some((term) => term.label.includes("미끄러운 정신")), JSON.stringify(rogue.saves.wis.terms));
  assert.ok(rogue.saves.cha.terms.some((term) => term.label.includes("미끄러운 정신")));
});

test("R97: 학자 asks for one expertise among the wizard's knowledge skills (D232)", () => {
  const wizard = build({ name: "위저드", classes: "wizard", level: 2 });
  const choice = wizard.derived.choices.find((item) => item.id === "class.1.scholar");
  assert.ok(choice, wizard.derived.choices.map((item) => item.id).join(", "));
  const picked = wizard.source.choices["class.1.scholar"]?.[0];
  assert.ok(picked && wizard.derived.skills.find((skill) => skill.id === picked)?.expertise, JSON.stringify(wizard.source.choices["class.1.scholar"]));
});

test("R97: 전승 학파 asks for three skills, and 기적술사 adds Wisdom to Arcana and Religion (D232)", () => {
  const bard = build({ name: "바드", classes: "bard", level: 3 }, { "class.0.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] });
  assert.equal(bard.source.choices["class.2.lore-skills"]?.length, 3, JSON.stringify(bard.derived.choices.map((item) => item.id)));
  const cleric = build({ name: "클레릭", classes: "cleric", level: 1, abilities: { wis: 16 } }, { "class.0.divine-order": ["thaumaturge"] });
  const religion = cleric.derived.skills.find((skill) => skill.id === "religion")!;
  assert.ok(religion.terms.some((term) => term.label.includes("질서") && term.value === 3), JSON.stringify(religion.terms));
});
