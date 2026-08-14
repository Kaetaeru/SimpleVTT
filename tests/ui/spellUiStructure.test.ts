import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SPELL_PRESENTATIONS, spellMatchesFilter, spellVisual } from "../../src/app/spellPresentation";

test("every SRD spell resolves to a property icon or a school fallback", () => {
  assert.equal(SPELL_PRESENTATIONS.length, 339);
  const propertySpells = SPELL_PRESENTATIONS.filter((spell) => spellVisual(spell).source === "property");
  const schoolSpells = SPELL_PRESENTATIONS.filter((spell) => spellVisual(spell).source === "school");
  assert.ok(propertySpells.length > 0, "expected at least one property-classified spell");
  assert.ok(schoolSpells.length > 0, "expected at least one school-fallback spell");
  for (const spell of SPELL_PRESENTATIONS) {
    const visual = spellVisual(spell);
    assert.ok(visual.key.length > 0, `${spell.id}: icon key missing`);
    assert.ok(visual.label.length > 0, `${spell.id}: icon label missing`);
    if (visual.source === "school") assert.match(visual.key, /^school:/, `${spell.id}: school fallback must use school key`);
  }
});

test("property classification recognizes real SRD damage or healing prose", () => {
  const fire = SPELL_PRESENTATIONS.find((spell) => /화염 피해/.test(`${spell.summary}\n${spell.description}`));
  assert.ok(fire, "expected a fire-damage spell in the SRD catalog");
  assert.equal(spellVisual(fire).key, "fire");
  const healing = SPELL_PRESENTATIONS.find((spell) => /히트 포인트[^.\n]{0,60}회복|회복[^.\n]{0,60}히트 포인트/.test(`${spell.summary}\n${spell.description}`));
  assert.ok(healing, "expected a healing spell in the SRD catalog");
  assert.equal(spellVisual(healing).key, "healing");
});

test("spell behavior filters are driven by canonical presentation metadata", () => {
  const concentration = SPELL_PRESENTATIONS.find((spell) => /집중/.test(spell.duration));
  assert.ok(concentration);
  assert.equal(spellMatchesFilter(concentration, "concentration"), true);
  const ritual = SPELL_PRESENTATIONS.find((spell) => spell.ritual);
  assert.ok(ritual);
  assert.equal(spellMatchesFilter(ritual, "ritual"), true);
});

test("creation and character sheet expose BG3-style spell hierarchy", () => {
  const root = process.cwd();
  const creation = readFileSync(join(root, "src/character-create/V10Sections.tsx"), "utf8");
  const sheet = readFileSync(join(root, "src/CharacterSheetV10.tsx"), "utf8");
  const shared = readFileSync(join(root, "src/SpellUi.tsx"), "utf8");
  const css = readFileSync(join(root, "src/spell-ui.css"), "utf8");

  assert.match(creation, /SpellChoiceSection/);
  assert.match(creation, /spell-selected-strip/);
  assert.match(creation, /spell-filter-chips/);
  assert.match(sheet, /SpellbookPanel/);
  assert.match(sheet, /spellbook-prepared-strip/);
  assert.match(sheet, /spellbook-level-tabs/);
  assert.match(shared, /SpellGlyph/);
  assert.match(shared, /spell-rule-tooltip/);
  assert.match(css, /visual-fire/);
  assert.match(css, /visual-school-abjuration/);
});
