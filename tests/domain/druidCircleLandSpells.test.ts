import assert from "node:assert/strict";
import test from "node:test";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../../src/domain/druidCircleLand";
import {
  circleLandSpellPackage,
  circleLandSpellView,
  resolveCircleLandSpellRest,
} from "../../src/domain/druidCircleLandSpells";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const id = stableSpellId;

test("Circle of the Land prepares the exact current-land package for the Druid level", () => {
  const level3 = circleLandSpellPackage(3,DRUID_CIRCLE_LAND_SUBCLASS_ID,"arid");
  assert.deepEqual(level3.cantripIds,[id("Fire Bolt")]);
  assert.deepEqual(level3.preparedSpellIds,[id("Blur"),id("Burning Hands")]);

  const level9 = circleLandSpellPackage(9,DRUID_CIRCLE_LAND_SUBCLASS_ID,"tropical");
  assert.deepEqual(level9.cantripIds,[id("Acid Splash")]);
  assert.deepEqual(level9.preparedSpellIds,[
    id("Ray of Sickness"),
    id("Web"),
    id("Stinking Cloud"),
    id("Polymorph"),
    id("Insect Plague"),
  ]);
  for (const spellId of [...level9.cantripIds,...level9.preparedSpellIds]) {
    assert.match(level9.sources[spellId],/circle-of-the-land\.circle-spells:tropical/);
  }
});

test("a Long-Rest land change replaces only the Circle package atomically", () => {
  const arid = circleLandSpellPackage(5,DRUID_CIRCLE_LAND_SUBCLASS_ID,"arid");
  const input = {
    revision:7,
    circleLandType:"arid" as const,
    circleLandCantripIds:[...arid.cantripIds],
    circleLandPreparedSpellIds:[...arid.preparedSpellIds],
    circleLandSpellSources:{ ...arid.sources },
    unrelated:"preserved",
  };
  const result = resolveCircleLandSpellRest(input,{
    expectedRevision:7,
    druidLevel:5,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    landType:"polar",
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.revision,8);
  assert.equal(result.state.circleLandType,"polar");
  assert.deepEqual(result.state.circleLandCantripIds,[id("Ray of Frost")]);
  assert.deepEqual(result.state.circleLandPreparedSpellIds,[id("Fog Cloud"),id("Hold Person"),id("Sleet Storm")]);
  assert.equal(result.state.unrelated,"preserved");
  assert.equal(input.revision,7,"input state remains immutable");
  assert.equal(input.circleLandType,"arid");
});

test("Circle spell rest selection rejects stale revisions or a non-Land subclass", () => {
  const state = { revision:2 };
  const stale = resolveCircleLandSpellRest(state,{
    expectedRevision:1,
    druidLevel:3,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    landType:"temperate",
  });
  assert.equal(stale.status,"rejected");
  assert.equal(stale.state,state);
  assert.match(stale.status === "rejected" ? stale.error : "",/revision mismatch/);

  const wrongSubclass = resolveCircleLandSpellRest(state,{
    expectedRevision:2,
    druidLevel:3,
    subclassId:"dnd.srd521.subclass.druid.other",
    landType:"temperate",
  });
  assert.equal(wrongSubclass.status,"rejected");
  assert.equal(wrongSubclass.state,state);
  assert.match(wrongSubclass.status === "rejected" ? wrongSubclass.error : "",/Circle of the Land/);
});

test("Circle spell view composes with base spell state without duplicates", () => {
  const fireBolt = id("Fire Bolt");
  const blur = id("Blur");
  const view = circleLandSpellView({
    baseCantripIds:[fireBolt,id("Guidance")],
    basePreparedSpellIds:[blur,id("Cure Wounds")],
    circleLandCantripIds:[fireBolt],
    circleLandPreparedSpellIds:[blur,id("Burning Hands")],
  });
  assert.deepEqual(view.cantripIds,[fireBolt,id("Guidance")]);
  assert.deepEqual(view.preparedSpellIds,[blur,id("Cure Wounds"),id("Burning Hands")]);
});
