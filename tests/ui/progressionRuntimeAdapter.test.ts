import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionRuntimeAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";

test("reference Aelar level-up is sourced from Phase 07 and Fighter 5 -> 6 commits the real ASI / HP / Hit Die changes", async () => {
  const adapter = new MockAdapter();
  await adapter.startLevelUp("char.aelar");
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassId, "dnd.srd521.class.fighter");
  assert.equal(snapshot.progressionPlan?.targetClassLevel, 6);
  assert.equal(snapshot.progressionPlan?.hp.gainBeforeConRetroactive, 9);
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.kind === "asi-or-feat");
  assert.ok(choice);
  assert.ok(snapshot.progressionPlan?.blocking.length);
  const phase07 = adapter as unknown as Phase07AdapterCommands;
  await phase07.setProgressionChoice(choice!.id, { kind:"asi", mode:"plus-two", primary:"str" });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);
  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 6);
  assert.equal(snapshot.activeCharacter.maxHp, 51);
  assert.equal(snapshot.activeCharacter.hp, 31);
  assert.equal(snapshot.activeCharacter.abilities.str, 20);
  assert.equal(snapshot.activeCharacter.classLevels?.[0]?.level, 6);
  assert.equal(snapshot.activeCharacter.hitDiceByDie?.d10, 6);
  assert.equal(snapshot.activeCharacter.progressionRevision, 1);
});

test("legacy/reference character metadata is normalized into a real class track before progression", async () => {
  const adapter = new MockAdapter();
  const snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.activeCharacter.classLevels?.map((track) => [track.classId, track.level]), [["dnd.srd521.class.fighter",5]]);
  assert.equal(snapshot.activeCharacter.hitDiceByDie?.d10, 5);
});

test("Phase 08 migrates level-1 creation Expertise and persists Rogue 5 -> 6 Expertise selections", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"로그",
    subclassName:"도둑",
    level:5,
    hp:30,
    maxHp:38,
    proficiencyBonus:3,
    abilities:{ str:8, dex:18, con:14, int:14, wis:12, cha:10 },
    skills:["은신","손재주","지각","조사"],
    features:["expertise · 은신","expertise · 손재주","암습","교활한 행동"],
    classLevels:[{ classId:"dnd.srd521.class.rogue", className:"로그", level:5, subclassName:"도둑" }],
    hitDiceByDie:{ d8:5 },
    progressionRevision:0,
    creationSelections:{ "class.expertise":["expertise.은신","expertise.손재주"] },
  };
  delete internal.activeCharacter.expertiseSkills;
  delete internal.activeCharacter.expertiseSources;

  let snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.activeCharacter.expertiseSkills, ["은신","손재주"]);
  assert.equal(snapshot.activeCharacter.expertiseSources?.은신, "SRD 5.2.1 · Character Creation · 전문화");

  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassId, "dnd.srd521.class.rogue");
  assert.equal(snapshot.progressionPlan?.targetClassLevel, 6);
  const expertise = snapshot.progressionPlan?.choices.find((entry) => entry.kind === "expertise");
  assert.ok(expertise);
  assert.equal(expertise?.count, 2);
  assert.equal(expertise?.options.find((option) => option.label === "은신")?.disabledReason, "이미 전문화를 보유하고 있습니다.");

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(expertise!.id, { kind:"options", optionIds:["skill:지각","skill:조사"] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 6);
  assert.deepEqual(snapshot.activeCharacter.expertiseSkills, ["은신","손재주","지각","조사"]);
  assert.equal(snapshot.activeCharacter.expertiseSources?.지각, "로그 6레벨 · SRD 5.2.1");
  assert.equal(snapshot.activeCharacter.expertiseSources?.조사, "로그 6레벨 · SRD 5.2.1");
});
