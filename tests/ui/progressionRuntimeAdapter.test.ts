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
