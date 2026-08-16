import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { takeCommittedResolutionEvents } from "../../src/app/resolutionEventCommitRegistry";

async function resolveShortbow(adapter:MockAdapter) {
  await adapter.setQueuedD20(11);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  return adapter.getSnapshot();
}

test("staged Shortbow retains the domain transaction events under the product resolution ID", async () => {
  const adapter=new MockAdapter();
  const snapshot=await resolveShortbow(adapter);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.ok(snapshot.resolution?.id);
  const events=takeCommittedResolutionEvents(snapshot.resolution!.id);
  assert.ok(events&&events.length>0);
  assert.ok(events!.some((event)=>event.stateChanges.some((change)=>change.kind==="hp"&&change.targetId==="combatant.goblin-a")));
  assert.ok(events!.some((event)=>event.stateChanges.some((change)=>change.kind==="economy"&&change.targetId==="char.aelar"&&change.field==="action")));
});
