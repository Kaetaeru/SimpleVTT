import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/dmTurnFocusRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("T1-08: the DM's controlled actor follows the current turn in initiative", async () => {
  const adapter=new MockAdapter();
  await adapter.setReferenceRole("dm");
  let snapshot=await adapter.startInitiative();
  assert.equal(snapshot.scene.selectedActorId,snapshot.scene.currentActorId,"initiative start focuses the first actor");
  for (let step=0; step<4; step+=1) {
    snapshot=await adapter.endTurn();
    assert.equal(snapshot.scene.selectedActorId,snapshot.scene.currentActorId,`turn ${step+1} focuses the current actor`);
  }
  // Freeform: the selection stays where the DM put it.
  await adapter.endInitiative();
  await adapter.selectDmActor("combatant.goblin-b");
  snapshot=await adapter.endTurn();
  assert.equal(snapshot.scene.selectedActorId,"combatant.goblin-b");
});
