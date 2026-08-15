import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionCharacterState } from "../../src/domain/progression";
import { classSpellListEntries } from "../../src/domain/spellListCatalog";
import { WIZARD_ID } from "../../src/domain/wizardProgressionChoices";
import {
  resolveWizardLongRestPreparation,
  wizardNormalPreparedSpellCount,
} from "../../src/domain/wizardLongRestPreparation";

const wizardEntries = classSpellListEntries(WIZARD_ID,9);
const level1 = wizardEntries.filter((entry) => entry.level === 1);
const level2 = wizardEntries.filter((entry) => entry.level === 2);
const level3 = wizardEntries.filter((entry) => entry.level === 3);

const mastery1Old = level1[0].id;
const mastery1New = level1[1].id;
const mastery2 = level2[0].id;
const mastery2Bad = level2[1].id;
const signatures = level3.slice(0,2).map((entry) => entry.id);

function baseState():ProgressionCharacterState {
  const spellbookSpellIds = wizardEntries.slice(0,60).map((entry) => entry.id);
  for (const spellId of [mastery1Old,mastery1New,mastery2,mastery2Bad,...signatures]) {
    if (!spellbookSpellIds.includes(spellId)) spellbookSpellIds.push(spellId);
  }
  const excluded = new Set([mastery1Old,mastery1New,mastery2,...signatures]);
  const ordinary = spellbookSpellIds.filter((spellId) => !excluded.has(spellId)).slice(0,wizardNormalPreparedSpellCount(18));
  assert.equal(ordinary.length,23);
  return {
    revision:4,
    id:"wizard",
    name:"Wizard",
    totalLevel:18,
    abilities:{ str:8, dex:14, con:14, int:20, wis:12, cha:10 },
    hpCurrent:100,
    hpMaximum:100,
    proficiencyBonus:6,
    classTracks:[{ classId:WIZARD_ID, className:"위저드", level:18 }],
    hitDiceByDie:{ d6:18 },
    features:["주문 숙련"],
    preparedSpellIds:[
      ...ordinary,
      `always:${mastery1Old}`,
      `always:${mastery2}`,
      ...signatures.map((spellId) => `always:${spellId}`),
    ],
    preparedSpellSources:Object.fromEntries([
      ...ordinary.map((spellId) => [spellId,"Wizard prepared spell"] as const),
      [mastery1Old,"위저드 18레벨 · 주문 숙련"],
      [mastery2,"위저드 18레벨 · 주문 숙련"],
      ...signatures.map((spellId) => [spellId,"위저드 대표 주문"] as const),
    ]),
    spellbookSpellIds,
    spellbookSpellSources:Object.fromEntries(spellbookSpellIds.map((spellId) => [spellId,"Wizard spellbook"])),
    spellMasterySpellIds:{ 1:mastery1Old, 2:mastery2 },
    spellMasterySources:{ 1:"위저드 18레벨 · 주문 숙련", 2:"위저드 18레벨 · 주문 숙련" },
    signatureSpellIds:signatures,
    signatureSpellSources:Object.fromEntries(signatures.map((spellId) => [spellId,"위저드 20레벨 · 대표 주문"])),
  };
}

function ordinaryPrepared(state:ProgressionCharacterState,extraExcluded:string[] = []) {
  const always = new Set([
    ...Object.values(state.spellMasterySpellIds ?? {}),
    ...(state.signatureSpellIds ?? []),
    ...extraExcluded,
  ]);
  return (state.spellbookSpellIds ?? [])
    .filter((spellId) => !always.has(spellId))
    .slice(0,wizardNormalPreparedSpellCount(18));
}

test("Wizard level 18 Long Rest requires exactly 23 ordinary prepared spells and keeps always-prepared features outside that count", () => {
  assert.equal(wizardNormalPreparedSpellCount(18),23);
  const state = baseState();
  const normal = ordinaryPrepared(state,[mastery1New]);
  assert.equal(normal.length,23);
  const result = resolveWizardLongRestPreparation(state,{
    expectedRevision:4,
    normalPreparedSpellIds:normal,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.revision,5);
  assert.equal(result.state.preparedSpellIds?.filter((id) => !id.startsWith("always:")).length,23);
  assert.ok(result.state.preparedSpellIds?.includes(`always:${mastery1Old}`));
  assert.ok(result.state.preparedSpellIds?.includes(`always:${mastery2}`));
  for (const spellId of signatures) assert.ok(result.state.preparedSpellIds?.includes(`always:${spellId}`));
});

test("Spell Mastery replaces at most the one requested level and the old spell leaves always-prepared status", () => {
  const state = baseState();
  const normal = ordinaryPrepared(state,[mastery1New]);
  const result = resolveWizardLongRestPreparation(state,{
    expectedRevision:4,
    normalPreparedSpellIds:normal,
    spellMasteryReplacement:{ spellLevel:1, spellId:mastery1New },
    spellOptions:[{ id:mastery1New, label:"replacement", level:1, castingTime:"행동" }],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.replacedSpellLevel,1);
  assert.equal(result.state.spellMasterySpellIds?.[1],mastery1New);
  assert.equal(result.state.spellMasterySpellIds?.[2],mastery2,"the level-2 mastery remains unchanged on the same Long Rest");
  assert.ok(result.state.preparedSpellIds?.includes(`always:${mastery1New}`));
  assert.equal(result.state.preparedSpellIds?.includes(`always:${mastery1Old}`),false);
  assert.equal(result.state.preparedSpellIds?.includes(mastery1Old),false,"old mastery is not guessed back into the ordinary prepared list");
});

test("an old Spell Mastery spell can remain as an ordinary prepared spell when explicitly selected in the new Long-Rest list", () => {
  const state = baseState();
  const normal = ordinaryPrepared(state,[mastery1New]);
  normal[0] = mastery1Old;
  assert.equal(new Set(normal).size,normal.length);
  const result = resolveWizardLongRestPreparation(state,{
    expectedRevision:4,
    normalPreparedSpellIds:normal,
    spellMasteryReplacement:{ spellLevel:1, spellId:mastery1New },
    spellOptions:[{ id:mastery1New, label:"replacement", level:1, castingTime:"행동" }],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.preparedSpellIds?.includes(mastery1Old));
  assert.equal(result.state.preparedSpellIds?.includes(`always:${mastery1Old}`),false);
  assert.match(result.state.preparedSpellSources?.[mastery1Old] ?? "",/Long-Rest prepared spell/);
});

test("Spell Mastery replacement rejects a non-Action spell before changing preparation state", () => {
  const state = baseState();
  const normal = ordinaryPrepared(state,[mastery2Bad]);
  const result = resolveWizardLongRestPreparation(state,{
    expectedRevision:4,
    normalPreparedSpellIds:normal,
    spellMasteryReplacement:{ spellLevel:2, spellId:mastery2Bad },
    spellOptions:[{ id:mastery2Bad, label:"non-action", level:2, castingTime:"보너스 행동" }],
  });
  assert.equal(result.status,"rejected");
  assert.match(result.status === "rejected" ? result.error : "",/시전 시간이 행동인 주문만/);
  assert.equal(result.state,state);
});

test("Wizard Long-Rest preparation rejects duplicates, spells outside the spellbook, and always-prepared spells consuming ordinary slots", () => {
  const state = baseState();
  const normal = ordinaryPrepared(state,[mastery1New]);

  const duplicate = [...normal];
  duplicate[1] = duplicate[0];
  const duplicateResult = resolveWizardLongRestPreparation(state,{
    expectedRevision:4,
    normalPreparedSpellIds:duplicate,
  });
  assert.equal(duplicateResult.status,"rejected");
  assert.match(duplicateResult.status === "rejected" ? duplicateResult.error : "",/duplicate spells/);

  const outside = [...normal];
  outside[0] = "dnd.srd521.spell.not-in-book";
  const outsideResult = resolveWizardLongRestPreparation(state,{
    expectedRevision:4,
    normalPreparedSpellIds:outside,
  });
  assert.equal(outsideResult.status,"rejected");
  assert.match(outsideResult.status === "rejected" ? outsideResult.error : "",/must be in the spellbook/);

  const consumesAlways = [...normal];
  consumesAlways[0] = mastery2;
  const alwaysResult = resolveWizardLongRestPreparation(state,{
    expectedRevision:4,
    normalPreparedSpellIds:consumesAlways,
  });
  assert.equal(alwaysResult.status,"rejected");
  assert.match(alwaysResult.status === "rejected" ? alwaysResult.error : "",/always-prepared spell cannot consume/);
});
