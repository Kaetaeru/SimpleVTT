import assert from "node:assert/strict";
import test from "node:test";
import { validateChoiceDefinitions, type ChoiceSelectionMap } from "../../src/domain/choiceDefinition";
import {
  sorcererMetamagicChoiceId,
  sorcererMetamagicReplacementChoices,
  sorcererMetamagicReplacementFromId,
  sorcererMetamagicReplacementToId,
} from "../../src/domain/sorcererProgressionChoices";

const known = ["metamagic:quickened-spell","metamagic:subtle-spell"];

test("Metamagic replacement is optional when the Sorcerer gains a level", () => {
  const choices = sorcererMetamagicReplacementChoices({ targetLevel:3, knownMetamagicIds:known, selections:{} });
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, sorcererMetamagicReplacementFromId(3));
  assert.equal(choices[0].required, false);
  assert.deepEqual(validateChoiceDefinitions(choices, {}), []);
});

test("choosing a Metamagic to replace materializes a required replacement target", () => {
  const selections: ChoiceSelectionMap = {
    [sorcererMetamagicReplacementFromId(3)]:{ kind:"options", optionIds:["metamagic:quickened-spell"] },
  };
  const choices = sorcererMetamagicReplacementChoices({ targetLevel:3, knownMetamagicIds:known, selections });
  assert.equal(choices.length, 2);
  const target = choices.find((choice) => choice.id === sorcererMetamagicReplacementToId(3));
  assert.equal(target?.required, true);
  assert.equal(target?.options.find((option) => option.id === "metamagic:quickened-spell")?.disabledReason, "같은 옵션으로 교체할 수 없습니다.");
  assert.equal(target?.options.find((option) => option.id === "metamagic:subtle-spell")?.disabledReason, "이미 알고 있는 메타매직입니다.");
  assert.ok(validateChoiceDefinitions(choices, selections).some((issue) => issue.choiceId === sorcererMetamagicReplacementToId(3)));
});

test("replacement target rejects an option that is being newly added at the same level", () => {
  const selections: ChoiceSelectionMap = {
    [sorcererMetamagicChoiceId(10)]:{ kind:"options", optionIds:["metamagic:distant-spell","metamagic:heightened-spell"] },
    [sorcererMetamagicReplacementFromId(10)]:{ kind:"options", optionIds:["metamagic:quickened-spell"] },
  };
  const choices = sorcererMetamagicReplacementChoices({ targetLevel:10, knownMetamagicIds:known, selections });
  const target = choices.find((choice) => choice.id === sorcererMetamagicReplacementToId(10));
  assert.equal(target?.options.find((option) => option.id === "metamagic:distant-spell")?.disabledReason, "이번 레벨에서 새로 추가하는 메타매직과 중복됩니다.");
  const submitted: ChoiceSelectionMap = {
    ...selections,
    [sorcererMetamagicReplacementToId(10)]:{ kind:"options", optionIds:["metamagic:distant-spell"] },
  };
  assert.ok(validateChoiceDefinitions(choices, submitted).some((issue) => /중복/.test(issue.message)));
});

test("replacement target accepts a genuinely unknown Metamagic with the stable option ID", () => {
  const selections: ChoiceSelectionMap = {
    [sorcererMetamagicReplacementFromId(3)]:{ kind:"options", optionIds:["metamagic:quickened-spell"] },
    [sorcererMetamagicReplacementToId(3)]:{ kind:"options", optionIds:["metamagic:careful-spell"] },
  };
  const choices = sorcererMetamagicReplacementChoices({ targetLevel:3, knownMetamagicIds:known, selections });
  assert.deepEqual(validateChoiceDefinitions(choices, selections), []);
});
