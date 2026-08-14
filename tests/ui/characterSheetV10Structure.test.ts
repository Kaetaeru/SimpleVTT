import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CharacterSheet } from "../../src/app/contracts";
import { projectOfficialSheet } from "../../src/app/characterSheetV10Projection";
import { featDescription } from "../../src/app/rulePresentation";

const SHEET: CharacterSheet = {
  id:"char.sheet-gate",
  name:"Sheet Gate",
  className:"파이터",
  level:1,
  species:"인간",
  background:"군인",
  hp:12,
  maxHp:12,
  tempHp:0,
  ac:18,
  speed:30,
  proficiencyBonus:2,
  saveState:"saved",
  abilities:{ str:16, dex:14, con:14, int:10, wis:12, cha:8 },
  saves:["STR +5","CON +4"],
  skills:["운동","지각"],
  features:["fighter.second-wind","경계","인간의 융통성"],
  equipment:["롱소드","방패"],
  items:[],
  resources:[],
  attacks:[{ id:"attack.longsword", name:"롱소드", bonus:5, damage:"1d8 + 3 참격" }],
  size:"medium",
  languages:["공용어","엘프어","드워프어"],
  toolProficiencies:["주사위 세트"],
  cantrips:[],
  preparedSpells:[],
  spellbookSpells:[],
  masteryWeapons:["dnd.srd521.item.weapon.longsword"],
  goldGp:12,
  creationSelections:{
    "class.fighting-style":["dnd.srd521.feat.fighting-style.defense"],
    "class.weapon-mastery":["dnd.srd521.item.weapon.longsword"],
    "species.originFeat":["dnd.srd521.feat.alert"],
    "background.gaming-set":["gaming-set.dice"],
  },
};

test("official-style projection keeps class, species, feats and other traits physically distinct", () => {
  const projected = projectOfficialSheet(SHEET);
  assert.ok(projected.classFeatures.length > 0, "class feature block should have entries");
  assert.ok(projected.speciesTraits.length > 0, "species trait block should have entries");
  assert.ok(projected.feats.some((feat) => feat.name === "경계"), "feat block should recognize the Origin Feat");
  assert.ok(projected.otherTraits.some((trait) => trait.source === "background"), "background choices should live in other traits instead of class/species blocks");
  assert.ok(projected.classFeatures.every((trait) => trait.source === "class"));
  assert.ok(projected.speciesTraits.every((trait) => trait.source === "species"));
  assert.ok(projected.feats.every((trait) => trait.source === "feat"));
});

test("official-style ability blocks own their saves and associated skills", () => {
  const projected = projectOfficialSheet(SHEET);
  assert.deepEqual(projected.skillsByAbility.str, ["운동"]);
  assert.ok(projected.skillsByAbility.dex.includes("곡예"));
  assert.ok(projected.skillsByAbility.int.includes("비전"));
  assert.ok(projected.skillsByAbility.wis.includes("지각"));
  assert.ok(projected.skillsByAbility.cha.includes("설득"));
  assert.equal(projected.skillBonus("운동", "str"), 5);
  assert.equal(projected.passivePerception, 13);
});

test("feat hover presentation has real SRD-derived descriptions", () => {
  assert.match(featDescription("dnd.srd521.feat.alert") ?? "", /우선권/);
  assert.match(featDescription("dnd.srd521.feat.magic-initiate") ?? "", /소마법 2개/);
  assert.match(featDescription("dnd.srd521.feat.fighting-style.defense") ?? "", /AC에 \+1/);
});

test("compact creation choices and official sheet chrome remain structurally present", () => {
  const compact = readFileSync(new URL("../../src/compact-options.css", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("../../src/character-sheet-v10.css", import.meta.url), "utf8");
  assert.match(compact, /\.create-option-card\.compact/);
  assert.match(compact, /min-height:\s*72px/);
  assert.match(compact, /\.option-detail-popover\.portal/);
  assert.match(sheet, /\.official-identity-strip/);
  assert.match(sheet, /\.official-abilities-grid/);
  assert.match(sheet, /\.official-class-features/);
  assert.match(sheet, /\.official-bottom-traits/);
  assert.match(sheet, /\.official-spell-list/);
});
