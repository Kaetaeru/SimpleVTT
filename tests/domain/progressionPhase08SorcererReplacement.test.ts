import assert from "node:assert/strict";
import test from "node:test";
import type { ChoiceSelectionMap } from "../../src/domain/choiceDefinition";
import {
  buildProgressionPlanPhase08Sorcerer,
  resolveProgressionPhase08Sorcerer,
} from "../../src/domain/progressionPhase08Sorcerer";
import type { ProgressionCharacterState, ProgressionRequest } from "../../src/domain/progression";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import {
  SORCERER_ID,
  sorcererMetamagicReplacementFromId,
  sorcererMetamagicReplacementToId,
} from "../../src/domain/sorcererProgressionChoices";

function sorcererThree(): ProgressionCharacterState {
  return {
    revision:0,
    id:"sorcerer-replacement",
    name:"Mira",
    totalLevel:3,
    abilities:{ str:8,dex:14,con:14,int:10,wis:12,cha:18 },
    hpCurrent:20,
    hpMaximum:20,
    proficiencyBonus:2,
    classTracks:[{ classId:SORCERER_ID, className:"소서러", level:3, subclassName:"용의 마법" }],
    hitDiceByDie:{ d6:3 },
    features:["주문 시전","타고난 마법","Font of Magic","메타매직","용의 마법"],
    cantripIds:["Fire Bolt","Mage Hand","Prestidigitation","Sorcerous Burst"].map(stableSpellId),
    preparedSpellIds:["Burning Hands","Magic Missile","Charm Person","Shield","Misty Step","Web"].map(stableSpellId),
    metamagicIds:["metamagic:quickened-spell","metamagic:subtle-spell"],
    metamagicSources:{
      "metamagic:quickened-spell":"소서러 2레벨 · 메타매직 · SRD 5.2.1",
      "metamagic:subtle-spell":"소서러 2레벨 · 메타매직 · SRD 5.2.1",
    },
  };
}

function baseRequest(selections: ChoiceSelectionMap = {}): ProgressionRequest {
  return {
    expectedRevision:0,
    targetClassId:SORCERER_ID,
    hpMethod:"fixed",
    selections,
  };
}

function completeRequiredChoices(
  state: ProgressionCharacterState,
  initial: ChoiceSelectionMap,
) {
  const selections: ChoiceSelectionMap = structuredClone(initial);
  for (let pass = 0; pass < 10; pass += 1) {
    const plan = buildProgressionPlanPhase08Sorcerer(state, baseRequest(selections));
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

test("Sorcerer level-up exposes optional Metamagic replacement without blocking when skipped", () => {
  const state = sorcererThree();
  const selections = completeRequiredChoices(state, {});
  const plan = buildProgressionPlanPhase08Sorcerer(state, baseRequest(selections));
  const replacement = plan.choices.find((choice) => choice.id === sorcererMetamagicReplacementFromId(4));
  assert.ok(replacement);
  assert.equal(replacement?.required, false);
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgressionPhase08Sorcerer(state, baseRequest(selections));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.deepEqual(new Set(result.state.metamagicIds), new Set(state.metamagicIds));
  assert.equal(result.state.totalLevel, 4);
  assert.equal(state.totalLevel, 3, "source state stays immutable");
});

test("Sorcerer level-up atomically replaces one known Metamagic and rewrites current provenance", () => {
  const state = sorcererThree();
  const fromId = sorcererMetamagicReplacementFromId(4);
  const toId = sorcererMetamagicReplacementToId(4);
  const initial: ChoiceSelectionMap = {
    [fromId]:{ kind:"options", optionIds:["metamagic:quickened-spell"] },
    [toId]:{ kind:"options", optionIds:["metamagic:distant-spell"] },
  };
  const selections = completeRequiredChoices(state, initial);
  const plan = buildProgressionPlanPhase08Sorcerer(state, baseRequest(selections));
  assert.equal(plan.blocking.length, 0);
  assert.ok(plan.diffs.some((diff) => diff.label === "메타매직 교체" && diff.before === "신속 주문" && diff.after === "원거리 주문"));

  const result = resolveProgressionPhase08Sorcerer(state, baseRequest(selections));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.metamagicIds?.includes("metamagic:quickened-spell"), false);
  assert.equal(result.state.metamagicIds?.includes("metamagic:subtle-spell"), true);
  assert.equal(result.state.metamagicIds?.includes("metamagic:distant-spell"), true);
  assert.equal(result.state.metamagicSources?.["metamagic:quickened-spell"], undefined);
  assert.equal(result.state.metamagicSources?.["metamagic:distant-spell"], "소서러 4레벨 · 메타매직 교체 · SRD 5.2.1");
  assert.deepEqual(state.metamagicIds, ["metamagic:quickened-spell","metamagic:subtle-spell"]);
});

test("invalid or orphaned Metamagic replacement rejects before any progression mutation", () => {
  const state = sorcererThree();
  const fromId = sorcererMetamagicReplacementFromId(4);
  const toId = sorcererMetamagicReplacementToId(4);

  const duplicateSelections = completeRequiredChoices(state, {
    [fromId]:{ kind:"options", optionIds:["metamagic:quickened-spell"] },
    [toId]:{ kind:"options", optionIds:["metamagic:subtle-spell"] },
  });
  const duplicate = resolveProgressionPhase08Sorcerer(state, baseRequest(duplicateSelections));
  assert.equal(duplicate.status, "rejected");
  assert.equal(duplicate.state, state);
  assert.match(duplicate.status === "rejected" ? duplicate.error : "", /이미 알고 있는 메타매직/);

  const orphanSelections = completeRequiredChoices(state, {
    [toId]:{ kind:"options", optionIds:["metamagic:distant-spell"] },
  });
  const orphan = resolveProgressionPhase08Sorcerer(state, baseRequest(orphanSelections));
  assert.equal(orphan.status, "rejected");
  assert.equal(orphan.state, state);
  assert.match(orphan.status === "rejected" ? orphan.error : "", /기존 메타매직을 먼저 선택/);
});
