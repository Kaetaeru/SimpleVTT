import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { takeCommittedResolutionEvents } from "../../src/app/resolutionEventCommitRegistry";
import { isReadyTriggerAction } from "../../src/app/standardActionReadyState";

async function complete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<10&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) {
    assert.equal(snapshot.resolution.canAdvance,true,`resolution stalled at ${snapshot.resolution.stage}`);
    snapshot=await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

// Reproduced on real Windows H+P1+P2 (W9-02 family D, MP-D09): the Host broadcast only the reaction spend for a
// fired Ready action, so the Clients never applied the attack's damage (goblin 21 on P1/P2 vs 19 on the Host).
test("a fired Ready action commits the readied action's events together with the reaction spend",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const armed=await adapter.configureReadyAction({actorId:"char.aelar",actionId:"action.longsword",trigger:"고블린이 접근하면"});
  assert.ok(armed.resolution,"Ready must open a resolution");
  const armDone=await complete(adapter);
  assert.ok(armDone.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"));
  takeCommittedResolutionEvents(armDone.resolution!.id);

  await adapter.setCurrentActor("combatant.goblin-a");
  const trigger=(await adapter.getSnapshot()).scene.actionsByActor["char.aelar"]?.find(isReadyTriggerAction);
  assert.ok(trigger,"the readied trigger must be projected off-turn");
  const goblinBefore=(await adapter.getSnapshot()).scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
  await adapter.setQueuedD20(19);
  await adapter.resolveAction(trigger.id,["combatant.goblin-a"]);
  const fired=await complete(adapter);
  const goblinAfter=fired.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
  assert.ok(goblinAfter<goblinBefore,`the readied longsword must damage the goblin (${goblinBefore} -> ${goblinAfter})`);
  assert.equal(fired.scene.economyByActor["char.aelar"]?.reaction,false,"firing Ready spends the reaction");

  const events=takeCommittedResolutionEvents(fired.resolution!.id);
  assert.ok(events&&events.length>0,"the fired Ready resolution must expose committed events for the connected broadcast");
  const changes=events.flatMap((event)=>event.stateChanges);
  assert.ok(changes.some((change)=>change.kind==="hp"&&change.targetId==="combatant.goblin-a"&&change.before===goblinBefore&&change.after===goblinAfter),`committed events must carry the goblin's HP change; got ${JSON.stringify(changes.map((change)=>`${change.kind}:${change.targetId}`))}`);
  assert.ok(changes.some((change)=>change.kind==="economy"&&change.targetId==="char.aelar"&&change.field==="reaction"&&change.after===false),"committed events must carry the reaction spend");
});
