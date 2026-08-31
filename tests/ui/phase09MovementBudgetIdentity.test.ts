import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";

test("movement budget action execution is invariant to an unknown action id",async()=>{
  const adapter=new MockAdapter();
  const scene=(adapter as unknown as {scene:SceneVm}).scene;
  const actorId="char.aelar";
  const action=scene.actionsByActor[actorId].find((entry)=>entry.movementBudgetGainFeet!==undefined)!;
  const gain=action.movementBudgetGainFeet!;
  const before=scene.economyByActor[actorId].movementMax;
  action.id="external.unknown.movement-budget";
  await adapter.resolveAction(action.id,[actorId]);
  const committed=await adapter.advanceResolution();
  assert.equal(committed.scene.economyByActor[actorId].movementMax,before+gain);
  assert.ok(committed.resolution?.provenance.some((entry)=>entry.includes(action.id)));
});
