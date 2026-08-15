import assert from "node:assert/strict";
import test from "node:test";
import type { ChoiceSelectionMap } from "../../src/domain/choiceDefinition";
import type { ProgressionCharacterState, ProgressionRequest } from "../../src/domain/progression";
import {
  buildProgressionPlanPhase08Warlock,
  resolveProgressionPhase08Warlock,
  warlockInvocationReplacementChoices,
  warlockInvocationReplacementFromId,
  warlockInvocationReplacementToId,
} from "../../src/domain/progressionPhase08Warlock";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import { WARLOCK_ID } from "../../src/domain/warlockProgressionChoices";

function warlockThree(): ProgressionCharacterState {
  return {
    revision:0,
    id:"warlock-replacement",
    name:"Vex",
    totalLevel:3,
    abilities:{ str:8,dex:14,con:14,int:10,wis:12,cha:18 },
    hpCurrent:24,
    hpMaximum:24,
    proficiencyBonus:2,
    classTracks:[{ classId:WARLOCK_ID, className:"워락", level:3, subclassName:"마족 후원자" }],
    hitDiceByDie:{ d8:3 },
    features:["계약 마법","마족 후원자"],
    cantripIds:[stableSpellId("Eldritch Blast"),stableSpellId("Chill Touch"),stableSpellId("Prestidigitation")],
    preparedSpellIds:[stableSpellId("Hex"),stableSpellId("Hellish Rebuke"),stableSpellId("Misty Step"),stableSpellId("Hold Person")],
    eldritchInvocationIds:["invocation:armor-of-shadows","invocation:devils-sight"],
    eldritchInvocationSources:{
      "invocation:armor-of-shadows":"워락 2레벨 · 섬뜩한 기원술 · SRD 5.2.1",
      "invocation:devils-sight":"워락 2레벨 · 섬뜩한 기원술 · SRD 5.2.1",
    },
    pactMagicSlotLevel:2,
    pactMagicSlotMaximum:2,
  };
}

function request(selections: ChoiceSelectionMap = {}): ProgressionRequest {
  return {
    expectedRevision:0,
    targetClassId:WARLOCK_ID,
    hpMethod:"fixed",
    selections,
    originFeatOptions:[
      { id:"dnd.srd521.feat.alert", label:"경계" },
      { id:"dnd.srd521.feat.skilled", label:"숙련됨" },
    ],
  };
}

function completeRequiredChoices(state: ProgressionCharacterState, initial: ChoiceSelectionMap) {
  const selections = structuredClone(initial);
  for (let pass = 0; pass < 12; pass += 1) {
    const plan = buildProgressionPlanPhase08Warlock(state, request(selections));
    let changed = false;
    for (const choice of plan.choices) {
      if (!choice.required || choice.status !== "ready" || selections[choice.id]) continue;
      if (choice.kind === "asi-or-feat") {
        selections[choice.id] = { kind:"asi", mode:"plus-two", primary:"str" };
        changed = true;
        continue;
      }
      const available = choice.options.filter((option) => !option.disabledReason);
      assert.ok(available.length >= choice.count, `${choice.label} needs ${choice.count} available options`);
      selections[choice.id] = { kind:"options", optionIds:available.slice(0, choice.count).map((option) => option.id) };
      changed = true;
    }
    if (!changed) return selections;
  }
  throw new Error("required progression choices did not stabilize");
}

test("Warlock level-up exposes one optional invocation replacement and skipping it leaves known invocations unchanged", () => {
  const state = warlockThree();
  const selections = completeRequiredChoices(state, {});
  const plan = buildProgressionPlanPhase08Warlock(state, request(selections));
  const from = plan.choices.find((choice) => choice.id === warlockInvocationReplacementFromId(4));
  assert.ok(from);
  assert.equal(from?.required, false);
  assert.equal(plan.choices.some((choice) => choice.id === warlockInvocationReplacementToId(4)), false);
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgressionPhase08Warlock(state, request(selections));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.deepEqual(new Set(result.state.eldritchInvocationIds), new Set(state.eldritchInvocationIds));
  assert.equal(result.state.totalLevel, 4);
  assert.equal(state.totalLevel, 3);
});

test("Warlock level-up atomically replaces one invocation and rewrites its provenance", () => {
  const state = warlockThree();
  const fromId = warlockInvocationReplacementFromId(4);
  const toId = warlockInvocationReplacementToId(4);
  const selections = completeRequiredChoices(state, {
    [fromId]:{ kind:"options", optionIds:["invocation:armor-of-shadows"] },
    [toId]:{ kind:"options", optionIds:["invocation:otherworldly-leap"] },
  });
  const plan = buildProgressionPlanPhase08Warlock(state, request(selections));
  assert.equal(plan.blocking.length, 0);
  assert.ok(plan.diffs.some((diff) => diff.label === "섬뜩한 기원술 교체" && diff.before === "그림자 갑옷" && diff.after === "이계의 도약"));

  const result = resolveProgressionPhase08Warlock(state, request(selections));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.eldritchInvocationIds?.includes("invocation:armor-of-shadows"), false);
  assert.equal(result.state.eldritchInvocationIds?.includes("invocation:otherworldly-leap"), true);
  assert.equal(result.state.eldritchInvocationSources?.["invocation:armor-of-shadows"], undefined);
  assert.equal(result.state.eldritchInvocationSources?.["invocation:otherworldly-leap"], "워락 4레벨 · 섬뜩한 기원술 교체 · SRD 5.2.1");
  assert.ok(state.eldritchInvocationIds?.includes("invocation:armor-of-shadows"), "source state remains immutable");
});

test("Repeatable invocation can be replaced with the same base on a different concrete cantrip target", () => {
  const state = warlockThree();
  const eldritch = `invocation:agonizing-blast|target=${stableSpellId("Eldritch Blast")}`;
  const chill = `invocation:agonizing-blast|target=${stableSpellId("Chill Touch")}`;
  state.eldritchInvocationIds = [eldritch,"invocation:devils-sight"];
  state.eldritchInvocationSources = { [eldritch]:"old", "invocation:devils-sight":"old" };
  const fromId = warlockInvocationReplacementFromId(4);
  const toId = warlockInvocationReplacementToId(4);
  const selections = completeRequiredChoices(state, {
    [fromId]:{ kind:"options", optionIds:[eldritch] },
    [toId]:{ kind:"options", optionIds:[chill] },
  });
  const result = resolveProgressionPhase08Warlock(state, request(selections));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.eldritchInvocationIds?.includes(eldritch), false);
  assert.equal(result.state.eldritchInvocationIds?.includes(chill), true);
});

test("an invocation that is a prerequisite for another held invocation is not replaceable", () => {
  const state = warlockThree();
  state.totalLevel = 5;
  state.classTracks[0].level = 5;
  state.hitDiceByDie.d8 = 5;
  state.eldritchInvocationIds = ["invocation:pact-of-the-blade","invocation:thirsting-blade","invocation:devils-sight"];
  const choices = warlockInvocationReplacementChoices({ state, request:request({}), targetLevel:6 });
  const from = choices.find((choice) => choice.id === warlockInvocationReplacementFromId(6));
  assert.match(from?.options.find((option) => option.id === "invocation:pact-of-the-blade")?.disabledReason ?? "", /갈증 나는 칼날.*선행/);
});

test("Lessons of the First Ones cannot be removed until feat-source provenance is separable", () => {
  const state = warlockThree();
  const lessons = "invocation:lessons-of-the-first-ones|target=dnd.srd521.feat.alert";
  state.eldritchInvocationIds = [lessons,"invocation:devils-sight"];
  state.features.push("dnd.srd521.feat.alert");
  const choices = warlockInvocationReplacementChoices({ state, request:request({}), targetLevel:4 });
  const from = choices.find((choice) => choice.id === warlockInvocationReplacementFromId(4));
  assert.match(from?.options.find((option) => option.id === lessons)?.disabledReason ?? "", /provenance/);
});
