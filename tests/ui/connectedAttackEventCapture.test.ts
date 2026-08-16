import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { takeCommittedResolutionEvents } from "../../src/app/resolutionEventCommitRegistry";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

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
  const history=runtimeResolutionEventHistory(adapter);
  assert.ok(history&&history.events.length>0,"Phase09 staged attack must retain its committed runtime event history");
  assert.equal(history!.resolutionId,snapshot.resolution!.id,"runtime event history must use the product Resolution id");
  const events=takeCommittedResolutionEvents(snapshot.resolution!.id);
  assert.ok(events&&events.length>0,"connected publication registry must receive the same committed event batch");
  assert.ok(events!.some((event)=>event.stateChanges.some((change)=>change.kind==="hp"&&change.targetId==="combatant.goblin-a")));
  assert.ok(events!.some((event)=>event.stateChanges.some((change)=>change.kind==="economy"&&change.targetId==="char.aelar"&&change.field==="action")));
});
