import assert from "node:assert/strict";
import test from "node:test";
import { PROGRESSION_CATALOG, multiclassEligibility, multiclassSpellSlots } from "../../src/domain/progressionCatalog";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";

function fighter(level = 5, overrides: Partial<ProgressionCharacterState> = {}): ProgressionCharacterState {
  return {
    revision:0,
    id:"hero",
    name:"Aelar",
    totalLevel:level,
    abilities:{ str:18, dex:14, con:16, int:10, wis:12, cha:8 },
    hpCurrent:31,
    hpMaximum:42,
    proficiencyBonus:level >= 5 ? 3 : 2,
    classTracks:[{ classId:"dnd.srd521.class.fighter", className:"파이터", level, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:level },
    features:["추가 공격"],
    ...overrides,
  };
}

const asi = (ability: "str" | "dex" | "con" | "int" | "wis" | "cha") => ({
  kind:"asi" as const, mode:"plus-two" as const, primary:ability,
});

test("Phase 07 snapshot is complete for 12 classes x 20 levels with SRD subclasses", () => {
  assert.equal(PROGRESSION_CATALOG.classes.length, 12);
  assert.equal(PROGRESSION_CATALOG.classes.reduce((sum, entry) => sum + entry.progression.length, 0), 240);
  assert.equal(PROGRESSION_CATALOG.multiclass.prerequisites.length, 12);
  assert.equal(PROGRESSION_CATALOG.multiclass.spellSlots.rows.length, 20);
  for (const entry of PROGRESSION_CATALOG.classes) {
    assert.equal(entry.progression.length, 20);
    assert.ok(entry.srdSubclassName.length > 0, entry.id);
  }
});

test("Fighter 5 -> 6 exposes only the real ASI choice and commits fixed HP / Hit Die / class track atomically", () => {
  const state = fighter();
  const choiceId = "progression.dnd.srd521.class.fighter.6.asi";
  const request = { expectedRevision:0, targetClassId:"dnd.srd521.class.fighter", hpMethod:"fixed" as const, selections:{ [choiceId]:asi("str") } };
  const plan = buildProgressionPlan(state, request);
  assert.deepEqual(plan.automaticGrants, []);
  assert.equal(plan.choices.length, 1);
  assert.equal(plan.choices[0].kind, "asi-or-feat");
  assert.equal(plan.hp.gainBeforeConRetroactive, 9, "Fighter fixed HP is 6 + CON +3");
  assert.equal(plan.proficiencyAfter, 3);
  assert.equal(plan.blocking.length, 0);
  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 6);
  assert.equal(result.state.classTracks[0].level, 6);
  assert.equal(result.state.hitDiceByDie.d10, 6);
  assert.equal(result.state.hpMaximum, 51);
  assert.equal(result.state.hpCurrent, 31, "level advancement increases maximum HP, not current HP");
  assert.equal(result.state.abilities.str, 20);
});

test("CON increase applies the SRD retroactive max-HP adjustment to every new total level", () => {
  const state = fighter();
  const choiceId = "progression.dnd.srd521.class.fighter.6.asi";
  const plan = buildProgressionPlan(state, { expectedRevision:0, targetClassId:"dnd.srd521.class.fighter", hpMethod:"fixed", selections:{ [choiceId]:asi("con") } });
  assert.equal(plan.hp.gainBeforeConRetroactive, 9);
  assert.equal(plan.hp.retroactiveConstitutionGain, 6, "CON modifier +1 x new total level 6");
  assert.equal(plan.hp.totalGain, 15);
});

test("new multiclass validates current and target class prerequisites and a qualifying Monk level creates a second track", () => {
  const state = fighter();
  const blocked = multiclassEligibility(state.abilities, state.classTracks, "dnd.srd521.class.monk");
  assert.equal(blocked.eligible, false);
  assert.match(blocked.reason, /몽크/);

  const qualifying = fighter(5, { abilities:{ str:18, dex:14, con:16, int:10, wis:14, cha:8 } });
  const result = resolveProgression(qualifying, { expectedRevision:0, targetClassId:"dnd.srd521.class.monk", hpMethod:"fixed", selections:{} });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 6);
  assert.deepEqual(result.state.classTracks.map((track) => [track.className, track.level]), [["파이터",5],["몽크",1]]);
  assert.equal(result.state.hitDiceByDie.d10, 5);
  assert.equal(result.state.hitDiceByDie.d8, 1);
  assert.equal(result.state.proficiencyBonus, 3);
});

test("multiclass spellcaster level uses full levels plus ceil of each half-caster class and keeps Pact Magic separate", () => {
  const rangerSorcerer = multiclassSpellSlots([
    { classId:"dnd.srd521.class.ranger", level:4 },
    { classId:"dnd.srd521.class.sorcerer", level:3 },
  ]);
  assert.equal(rangerSorcerer.casterLevel, 5);
  assert.deepEqual(Object.fromEntries(Object.entries(rangerSorcerer.slots).filter(([,count]) => count > 0)), { 1:4, 2:3, 3:2 });
  const withWarlock = multiclassSpellSlots([
    { classId:"dnd.srd521.class.ranger", level:4 },
    { classId:"dnd.srd521.class.sorcerer", level:3 },
    { classId:"dnd.srd521.class.warlock", level:5 },
  ]);
  assert.equal(withWarlock.casterLevel, 5, "Warlock Pact Magic levels are not merged into multiclass Spellcasting slots");
});

test("a level that needs a not-yet-materialized spell choice rejects atomically instead of approximating", () => {
  const state: ProgressionCharacterState = {
    revision:3, id:"bard", name:"Bard", totalLevel:4,
    abilities:{ str:8,dex:14,con:14,int:12,wis:10,cha:18 }, hpCurrent:20,hpMaximum:28,proficiencyBonus:2,
    classTracks:[{ classId:"dnd.srd521.class.bard", className:"바드", level:4, subclassName:"전승 학파" }], hitDiceByDie:{ d8:4 }, features:[],
  };
  const request = { expectedRevision:3, targetClassId:"dnd.srd521.class.bard", hpMethod:"fixed" as const, selections:{} };
  const plan = buildProgressionPlan(state, request);
  assert.ok(plan.choices.some((choice) => choice.kind === "spell" && choice.status === "catalog-pending"));
  const result = resolveProgression(state, request);
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.revision, 3);
});

test("a no-choice Fighter 8 -> 9 level commits automatic grants without manufacturing a decision", () => {
  const state = fighter(8, { hpMaximum:70, hpCurrent:50, proficiencyBonus:3, hitDiceByDie:{d10:8} });
  const result = resolveProgression(state, { expectedRevision:0, targetClassId:"dnd.srd521.class.fighter", hpMethod:"fixed", selections:{} });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.plan.choices.length, 0);
  assert.deepEqual(result.plan.automaticGrants, ["불굴 1회","전술 통달"]);
  assert.equal(result.state.proficiencyBonus, 4);
});

test("total level 20 rejects without mutating the source state", () => {
  const state = fighter(20, { proficiencyBonus:6, hitDiceByDie:{d10:20} });
  const result = resolveProgression(state, { expectedRevision:0, targetClassId:"dnd.srd521.class.fighter", hpMethod:"fixed", selections:{} });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.match(result.error, /레벨 상한 20/);
});
