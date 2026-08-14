import assert from "node:assert/strict";
import test from "node:test";
import { SPELL_PRESENTATIONS } from "../../src/app/spellPresentation";
import { classSpellListAllEntries, stableSpellId } from "../../src/domain/spellListCatalog";

const clericId = "dnd.srd521.class.cleric";
const druidId = "dnd.srd521.class.druid";
const normalizedName = (value: string) => value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();

function assertCanonicalCoverage(classId: string, expectedCount: number) {
  const presentations = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id, spell]));
  const entries = classSpellListAllEntries(classId);
  assert.equal(entries.length, expectedCount);
  for (const entry of entries) {
    assert.equal(entry.id, stableSpellId(entry.nameEn), `${entry.nameEn} must use the shared stable spell ID rule`);
    const presentation = presentations.get(entry.id);
    assert.ok(presentation, `${entry.id} missing from spell presentation catalog`);
    assert.equal(presentation?.level, entry.level, `${entry.id} spell level mismatch`);
    assert.equal(normalizedName(presentation?.nameEn ?? ""), normalizedName(entry.nameEn), `${entry.id} English name mismatch`);
  }
}

test("all 109 canonical Cleric spell-list entries resolve to the 339-spell presentation catalog", () => {
  assertCanonicalCoverage(clericId, 109);
});

test("all 124 canonical Druid spell-list entries resolve to the 339-spell presentation catalog", () => {
  assertCanonicalCoverage(druidId, 124);
});
