import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08SorcererAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import {
  SORCERER_ID,
  sorcererMetamagicReplacementFromId,
  sorcererMetamagicReplacementToId,
} from "../../src/domain/sorcererProgressionChoices";

async function satisfyRequiredChoices(adapter: MockAdapter, commands: Phase07AdapterCommands) {
  for (let pass = 0; pass < 12; pass += 1) {
    const snapshot = await adapter.getSnapshot();
    const selections = snapshot.levelUpDraft?.progressionSelections ?? {};
    const choice = snapshot.progressionPlan?.choices.find((entry) => entry.required && entry.status === "ready" && !selections[entry.id]);
    if (!choice) return snapshot;
    if (choice.kind === "asi-or-feat") {
      await commands.setProgressionChoice(choice.id, { kind:"asi", mode:"plus-two", primary:"str" });
      continue;
    }
    const available = choice.options.filter((option) => !option.disabledReason);
    assert.ok(available.length >= choice.count, `${choice.label} needs ${choice.count} available options`);
    await commands.setProgressionChoice(choice.id, {
      kind:"options",
      optionIds:available.slice(0, choice.count).map((option) => option.id),
    });
  }
  throw new Error("required runtime choices did not stabilize");
}

test("Sorcerer 3 -> 4 runtime materializes optional Metamagic replacement and persists the replacement", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"소서러",
    subclassName:"용의 마법",
    level:3,
    hp:20,
    maxHp:20,
    proficiencyBonus:2,
    abilities:{ str:8,dex:14,con:14,int:10,wis:12,cha:18 },
    features:["주문 시전","타고난 마법","Font of Magic","메타매직","용의 마법"],
    cantrips:["Fire Bolt","Mage Hand","Prestidigitation","Sorcerous Burst"].map(stableSpellId),
    preparedSpells:["Burning Hands","Magic Missile","Charm Person","Shield","Misty Step","Web"].map(stableSpellId),
    classLevels:[{ classId:SORCERER_ID, className:"소서러", level:3, subclassName:"용의 마법" }],
    hitDiceByDie:{ d6:3 },
    progressionRevision:0,
    metamagicIds:["metamagic:quickened-spell","metamagic:subtle-spell"],
    metamagicSources:{
      "metamagic:quickened-spell":"소서러 2레벨 · 메타매직 · SRD 5.2.1",
      "metamagic:subtle-spell":"소서러 2레벨 · 메타매직 · SRD 5.2.1",
    },
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const commands = adapter as unknown as Phase07AdapterCommands;
  const fromId = sorcererMetamagicReplacementFromId(4);
  const toId = sorcererMetamagicReplacementToId(4);
  const fromChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === fromId);
  assert.ok(fromChoice);
  assert.equal(fromChoice?.required, false);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === toId), false);

  await commands.setProgressionChoice(fromId, { kind:"options", optionIds:["metamagic:quickened-spell"] });
  snapshot = await adapter.getSnapshot();
  const toChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === toId);
  assert.ok(toChoice);
  assert.equal(toChoice?.required, true);
  assert.equal(toChoice?.options.find((option) => option.id === "metamagic:quickened-spell")?.disabledReason, "같은 옵션으로 교체할 수 없습니다.");
  assert.equal(toChoice?.options.find((option) => option.id === "metamagic:subtle-spell")?.disabledReason, "이미 알고 있는 메타매직입니다.");

  await commands.setProgressionChoice(toId, { kind:"options", optionIds:["metamagic:distant-spell"] });
  snapshot = await satisfyRequiredChoices(adapter, commands);
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "메타매직 교체" && diff.before === "신속 주문" && diff.after === "원거리 주문"));

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 4);
  assert.equal(snapshot.activeCharacter.metamagicIds?.includes("metamagic:quickened-spell"), false);
  assert.equal(snapshot.activeCharacter.metamagicIds?.includes("metamagic:subtle-spell"), true);
  assert.equal(snapshot.activeCharacter.metamagicIds?.includes("metamagic:distant-spell"), true);
  assert.equal(snapshot.activeCharacter.metamagicSources?.["metamagic:quickened-spell"], undefined);
  assert.equal(snapshot.activeCharacter.metamagicSources?.["metamagic:distant-spell"], "소서러 4레벨 · 메타매직 교체 · SRD 5.2.1");
  assert.ok(snapshot.activity[0]?.detail.some((line) => line.includes("메타매직 교체: 신속 주문 → 원거리 주문")));
});
