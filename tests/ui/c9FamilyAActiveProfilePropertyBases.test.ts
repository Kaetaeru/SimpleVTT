import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  ensureAdapterTurnRuntimeState,
  snapshotAdapterTurnRuntimeState,
} from "../../src/app/turnRuntimeSessionRegistry";

test("active character progression and runtime stats materialize into the shared profile property owner",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await adapter.getSnapshot();
  let state=ensureAdapterTurnRuntimeState(adapter,snapshot.scene);
  const actorId=snapshot.activeCharacter.id;
  let properties=state.combatants[actorId]?.baseProperties;
  assert.ok(properties);
  assert.equal(properties["ability.str.score"],18);
  assert.equal(properties["ability.dex.score"],14);
  assert.equal(properties["progression.character.level"],5);
  assert.equal(properties["proficiency.bonus"],3);
  assert.equal(properties["hp.current"],31);
  assert.equal(properties["hp.maximum"],42);
  assert.equal(properties["hp.temporary"],5);

  await adapter.startLevelUp(actorId);
  await adapter.commitLevelUp();
  snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  properties=state.combatants[actorId]?.baseProperties;
  assert.ok(properties);
  assert.equal(properties["ability.str.score"],20);
  assert.equal(properties["progression.character.level"],6);
  assert.equal(properties["proficiency.bonus"],3);
});
