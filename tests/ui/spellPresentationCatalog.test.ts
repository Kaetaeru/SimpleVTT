import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import creationIndexJson from "../../content/indexes/dnd-srd-5.2.1.character-creation.json";
import type { CharacterCreationOptionVm } from "../../src/app/contracts";
import { spellId } from "../../src/app/characterCreationV10Data";
import {
  SPELL_PRESENTATION_COUNT,
  SPELL_PRESENTATION_SOURCE,
  SPELL_PRESENTATIONS,
  decorateSpellOption,
  spellPresentationByEnglish,
  spellPresentationById,
} from "../../src/app/spellPresentation";

type CreationIndex = {
  spellLists: Record<string, Record<"0" | "1", string[]>>;
};

const INDEX = creationIndexJson as unknown as CreationIndex;

function requiredText(value: unknown, label: string) {
  assert.equal(typeof value, "string", `${label} must be text`);
  assert.ok((value as string).trim().length > 0, `${label} must not be empty`);
}

test("SRD spell presentation snapshot contains exactly 339 complete unique spells", () => {
  assert.equal(SPELL_PRESENTATION_COUNT, 339);
  assert.equal(SPELL_PRESENTATIONS.length, 339);
  assert.equal(SPELL_PRESENTATION_SOURCE.revision, "d3d574725e0ecdfd05cb69fa32cf66196e3a8ee4");

  const ids = new Set<string>();
  const namesEn = new Set<string>();
  for (const spell of SPELL_PRESENTATIONS) {
    assert.ok(Number.isInteger(spell.level) && spell.level >= 0 && spell.level <= 9, `${spell.id}: valid level`);
    assert.equal(typeof spell.ritual, "boolean", `${spell.id}: ritual boolean`);
    for (const [field, value] of Object.entries({
      id:spell.id,
      name:spell.name,
      nameEn:spell.nameEn,
      school:spell.school,
      castingTime:spell.castingTime,
      range:spell.range,
      components:spell.components,
      duration:spell.duration,
      summary:spell.summary,
      description:spell.description,
    })) requiredText(value, `${spell.id}.${field}`);
    assert.ok(!ids.has(spell.id), `duplicate id ${spell.id}`);
    assert.ok(!namesEn.has(spell.nameEn), `duplicate English name ${spell.nameEn}`);
    ids.add(spell.id);
    namesEn.add(spell.nameEn);
  }
});

test("representative cantrips and level-1 spells expose Korean labels and actual SRD prose", () => {
  const cases = [
    ["Fire Bolt", "화염 화살", /1d10 화염 피해/],
    ["Magic Missile", "마법 화살", /1d4 \+ 1 역장 피해/],
    ["Vicious Mockery", "잔혹한 모욕", /1d6 정신 피해/],
    ["Hunter's Mark", "사냥꾼의 표식", /1d6 역장 피해/],
    ["Bless", "축복", /1d4를 더한다/],
    ["Shield", "방패", /방어도에 \+5/],
  ] as const;
  for (const [nameEn, nameKo, prose] of cases) {
    const spell = spellPresentationByEnglish(nameEn);
    assert.ok(spell, `${nameEn} must exist`);
    assert.equal(spell?.name, nameKo);
    assert.match(spell?.description ?? "", prose);
    assert.equal(spellPresentationById(spell!.id)?.nameEn, nameEn);
  }
});

test("every class creation cantrip and level-1 spell-list entry resolves to the canonical catalog", () => {
  const seen = new Set<string>();
  for (const [classId, levels] of Object.entries(INDEX.spellLists)) {
    for (const level of ["0", "1"] as const) {
      for (const nameEn of levels[level] ?? []) {
        seen.add(nameEn);
        const presentation = spellPresentationByEnglish(nameEn);
        assert.ok(presentation, `${classId} ${level}: ${nameEn} must resolve`);
        assert.equal(presentation?.id, spellId(nameEn));
        assert.ok(presentation?.description.trim(), `${nameEn} needs description`);
      }
    }
  }
  assert.ok(seen.size > 80, "class creation coverage should span the real 0/1-level catalog subset");
});

test("character creation spell options replace generic metadata with canonical summary and hover detail", () => {
  const raw: CharacterCreationOptionVm = {
    id:"dnd.srd521.spell.magic-missile",
    name:"Magic Missile",
    nameEn:"Magic Missile",
    summary:"SRD 1레벨 주문",
    grants:["SRD 5.2.1 class spell list"],
    choices:[],
    selected:false,
    recommended:false,
    source:"SRD 5.2.1",
  };
  const decorated = decorateSpellOption(raw);
  assert.equal(decorated.name, "마법 화살");
  assert.notEqual(decorated.summary, "SRD 1레벨 주문");
  assert.match(decorated.description ?? "", /1d4 \+ 1 역장 피해/);
  assert.ok(decorated.detailLines?.some((line) => line.startsWith("시전 시간 · ")));
  assert.ok(decorated.detailLines?.some((line) => line.startsWith("사거리 · ")));
  assert.ok(decorated.detailLines?.some((line) => line.startsWith("구성요소 · ")));
  assert.ok(decorated.detailLines?.some((line) => line.startsWith("지속시간 · ")));
});

test("character creation plan decorates every outgoing option through the canonical spell presentation", () => {
  const source = readFileSync(new URL("../../src/app/characterCreationV10Plan.ts", import.meta.url), "utf8");
  assert.match(source, /options:options\.map\(decorateSpellOption\)/);
});
