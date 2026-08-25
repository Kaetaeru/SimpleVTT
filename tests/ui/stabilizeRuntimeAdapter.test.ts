import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { SceneVm } from "../../src/app/contracts";

function knockOutTarget(adapter:MockAdapter,targetId="combatant.goblin-a") {
  const internal=adapter as unknown as {scene:SceneVm};
  const target=internal.scene.entities.find((entry)=>entry.id===targetId)!;
  target.hp=0;
  target.runtimeLife={deathSaves:{successes:1,failures:1},stable:false,unconscious:true,dead:false};
}

test("Medicine DC 10 stabilizes an eligible 0 HP target and Undo restores exact life/economy", async () => {
  const adapter=new MockAdapter();
  knockOutTarget(adapter);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.selectDmActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id==="action.standard.stabilize");
  assert.deepEqual(action?.eligibleTargetIds,["combatant.goblin-a"]);

  await adapter.setQueuedD20(12);
  await adapter.resolveAction("action.standard.stabilize",["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.finalOutcome,"안정화 성공");
  assert.deepEqual(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.runtimeLife,{deathSaves:{successes:0,failures:0},stable:true,unconscious:true,dead:false});
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.runtimeLife,{deathSaves:{successes:1,failures:1},stable:false,unconscious:true,dead:false});
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
});

test("failed Medicine check spends the Action without stabilizing", async () => {
  const adapter=new MockAdapter();
  knockOutTarget(adapter);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.selectDmActor("char.aelar");
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.standard.stabilize",["combatant.goblin-a"]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.finalOutcome,"안정화 실패");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.runtimeLife?.stable,false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
});
