import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTALLED_SUBCLASS_OPTION_PREFIX,
  buildProgressionPlan,
  installedSubclassOptionId,
  resolveProgression,
  selectedInstalledSubclassId,
  type ProgressionCharacterState,
  type ProgressionRequest,
} from "../../src/domain/progression";
import { resolveCommonPlayProgressionContributions } from "../../src/domain/commonPlayProgressionContribution";

const FIGHTER_ID = "dnd.srd521.class.fighter";
const SUBCLASS_CHOICE_ID = `progression.${FIGHTER_ID}.3.subclass`;
const INSTALLED_SUBCLASS = { id:"subclass.spellblade", label:"주문검사", description:"외부 모듈 서브클래스", classId:FIGHTER_ID };

function fighter2():ProgressionCharacterState {
  return {
    revision:0,
    id:"char.test",
    name:"테스트 전사",
    totalLevel:2,
    abilities:{ str:16, dex:14, con:14, int:10, wis:12, cha:8 },
    hpCurrent:20,
    hpMaximum:20,
    proficiencyBonus:2,
    classTracks:[{ classId:FIGHTER_ID, className:"전사", level:2 }],
    hitDiceByDie:{ d10:2 },
    features:[],
  };
}

function request(selections:ProgressionRequest["selections"],subclassOptions?:ProgressionRequest["subclassOptions"]):ProgressionRequest {
  return { expectedRevision:0, targetClassId:FIGHTER_ID, hpMethod:"fixed", selections, subclassOptions };
}

test("installed subclasses join the SRD subclass acquisition choice only for their parent class", () => {
  const plan = buildProgressionPlan(fighter2(), request({}, [INSTALLED_SUBCLASS, { ...INSTALLED_SUBCLASS, id:"subclass.other", label:"다른 클래스용", classId:"dnd.srd521.class.rogue" }]));
  const choice = plan.choices.find((entry) => entry.id === SUBCLASS_CHOICE_ID);
  assert.ok(choice);
  assert.deepEqual(choice.options.map((option) => option.id), ["subclass:챔피언", installedSubclassOptionId("subclass.spellblade")]);
  assert.equal(choice.options[1]?.label, "주문검사");
  assert.equal(choice.options[1]?.description, "외부 모듈 서브클래스");

  const withoutInstalled = buildProgressionPlan(fighter2(), request({}));
  assert.deepEqual(withoutInstalled.choices.find((entry) => entry.id === SUBCLASS_CHOICE_ID)?.options.map((option) => option.id), ["subclass:챔피언"]);
});

test("selecting an installed subclass names the track after it and reports its stable content id", () => {
  const selections = { [SUBCLASS_CHOICE_ID]:{ kind:"options" as const, optionIds:[`${INSTALLED_SUBCLASS_OPTION_PREFIX}subclass.spellblade`] } };
  const result = resolveProgression(fighter2(), request(selections, [INSTALLED_SUBCLASS]));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.classTracks[0]?.subclassName, "주문검사");
  assert.ok(result.state.features.includes("주문검사"));
  assert.equal(selectedInstalledSubclassId(result.plan.choices, selections), "subclass.spellblade");

  const srd = { [SUBCLASS_CHOICE_ID]:{ kind:"options" as const, optionIds:["subclass:챔피언"] } };
  const srdResult = resolveProgression(fighter2(), request(srd, [INSTALLED_SUBCLASS]));
  assert.equal(srdResult.status, "committed");
  if (srdResult.status !== "committed") return;
  assert.equal(srdResult.state.classTracks[0]?.subclassName, "챔피언");
  assert.equal(selectedInstalledSubclassId(srdResult.plan.choices, srd), undefined);
});

test("a subclass-owned contribution activates only while that subclass is on the track", () => {
  const contributions = [{ track:FIGHTER_ID, threshold:3, grants:["feature.spellblade.arcane-strike"], ownerSubclassId:"subclass.spellblade" }];
  const base = { revision:0, trackLevels:{ [FIGHTER_ID]:3 }, grants:[] as string[] };

  const chosen = resolveCommonPlayProgressionContributions({ ...base, subclassIds:{ [FIGHTER_ID]:"subclass.spellblade" } }, 0, contributions);
  assert.equal(chosen.status, "committed");
  if (chosen.status === "committed") assert.deepEqual(chosen.addedGrantIds, ["feature.spellblade.arcane-strike"]);

  const champion = resolveCommonPlayProgressionContributions({ ...base, subclassIds:{ [FIGHTER_ID]:"dnd.srd521.subclass.fighter.champion" } }, 0, contributions);
  assert.equal(champion.status, "committed");
  if (champion.status === "committed") assert.deepEqual(champion.addedGrantIds, []);

  const unknown = resolveCommonPlayProgressionContributions(base, 0, contributions);
  assert.equal(unknown.status, "committed");
  if (unknown.status === "committed") assert.deepEqual(unknown.addedGrantIds, [], "no subclass on the track means the subclass contribution stays inactive");

  const classOwned = resolveCommonPlayProgressionContributions(base, 0, [{ track:FIGHTER_ID, threshold:3, grants:["feature.any-fighter"] }]);
  assert.equal(classOwned.status, "committed");
  if (classOwned.status === "committed") assert.deepEqual(classOwned.addedGrantIds, ["feature.any-fighter"], "contributions without an owner keep the existing class-wide behavior");
});
