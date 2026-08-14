import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08WarlockAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import {
  warlockInvocationReplacementFromId,
  warlockInvocationReplacementToId,
} from "../../src/domain/progressionPhase08Warlock";
import { WARLOCK_ID } from "../../src/domain/warlockProgressionChoices";

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

async function warlockThreeAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"워락",
    subclassName:"마족 후원자",
    level:3,
    hp:24,
    maxHp:24,
    proficiencyBonus:2,
    abilities:{ str:8,dex:14,con:14,int:10,wis:12,cha:18 },
    features:["계약 마법","마족 후원자"],
    cantrips:[stableSpellId("Eldritch Blast"),stableSpellId("Chill Touch"),stableSpellId("Prestidigitation")],
    preparedSpells:[stableSpellId("Hex"),stableSpellId("Hellish Rebuke"),stableSpellId("Misty Step"),stableSpellId("Hold Person")],
    classLevels:[{ classId:WARLOCK_ID, className:"워락", level:3, subclassName:"마족 후원자" }],
    hitDiceByDie:{ d8:3 },
    progressionRevision:0,
    eldritchInvocationIds:["invocation:armor-of-shadows","invocation:devils-sight"],
    eldritchInvocationSources:{
      "invocation:armor-of-shadows":"워락 2레벨 · 섬뜩한 기원술 · SRD 5.2.1",
      "invocation:devils-sight":"워락 2레벨 · 섬뜩한 기원술 · SRD 5.2.1",
    },
    pactMagicSlotLevel:2,
    pactMagicSlotMaximum:2,
  };
  return { adapter, internal };
}

test("Warlock 3 -> 4 runtime materializes optional invocation replacement and persists it to CharacterSheet", async () => {
  const { adapter } = await warlockThreeAdapter();
  await adapter.startLevelUp((await adapter.getSnapshot()).activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const commands = adapter as unknown as Phase07AdapterCommands;
  const fromId = warlockInvocationReplacementFromId(4);
  const toId = warlockInvocationReplacementToId(4);

  const fromChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === fromId);
  assert.ok(fromChoice);
  assert.equal(fromChoice?.required, false);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === toId), false);

  await commands.setProgressionChoice(fromId, { kind:"options", optionIds:["invocation:armor-of-shadows"] });
  snapshot = await adapter.getSnapshot();
  const toChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === toId);
  assert.ok(toChoice);
  assert.equal(toChoice?.required, true);
  assert.equal(toChoice?.options.find((option) => option.id === "invocation:armor-of-shadows")?.disabledReason?.includes("같은 기원술"), true);

  await commands.setProgressionChoice(toId, { kind:"options", optionIds:["invocation:otherworldly-leap"] });
  snapshot = await satisfyRequiredChoices(adapter, commands);
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "섬뜩한 기원술 교체" && diff.before === "그림자 갑옷" && diff.after === "이계의 도약"));

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 4);
  assert.equal(snapshot.activeCharacter.eldritchInvocationIds?.includes("invocation:armor-of-shadows"), false);
  assert.equal(snapshot.activeCharacter.eldritchInvocationIds?.includes("invocation:devils-sight"), true);
  assert.equal(snapshot.activeCharacter.eldritchInvocationIds?.includes("invocation:otherworldly-leap"), true);
  assert.equal(snapshot.activeCharacter.eldritchInvocationSources?.["invocation:armor-of-shadows"], undefined);
  assert.equal(snapshot.activeCharacter.eldritchInvocationSources?.["invocation:otherworldly-leap"], "워락 4레벨 · 섬뜩한 기원술 교체 · SRD 5.2.1");
  assert.ok(snapshot.activity[0]?.detail.some((line) => line.includes("섬뜩한 기원술 교체: 그림자 갑옷 → 이계의 도약")));
});

test("Warlock replacement does not leak through a save-error progression commit", async () => {
  const { adapter } = await warlockThreeAdapter();
  await adapter.startLevelUp((await adapter.getSnapshot()).activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  const fromId = warlockInvocationReplacementFromId(4);
  const toId = warlockInvocationReplacementToId(4);
  await commands.setProgressionChoice(fromId, { kind:"options", optionIds:["invocation:armor-of-shadows"] });
  await commands.setProgressionChoice(toId, { kind:"options", optionIds:["invocation:otherworldly-leap"] });
  await satisfyRequiredChoices(adapter, commands);
  await adapter.setEdgeState("save-error");

  const before = await adapter.getSnapshot();
  await adapter.commitLevelUp();
  const after = await adapter.getSnapshot();
  assert.equal(after.activeCharacter.level, before.activeCharacter.level);
  assert.deepEqual(after.activeCharacter.eldritchInvocationIds, before.activeCharacter.eldritchInvocationIds);
  assert.ok(after.levelUpDraft, "failed save keeps the draft open");
  assert.ok(after.levelUpDraft?.validation.some((entry) => /저장에 실패/.test(entry.message)));
});
