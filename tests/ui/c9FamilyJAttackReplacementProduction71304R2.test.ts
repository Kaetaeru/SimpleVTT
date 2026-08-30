import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

async function ready(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.selectDmActor("char.aelar");
}

function hasStatus(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,targetId:string,text:string) {
  return snapshot.scene.entities.find((entry)=>entry.id===targetId)?.status.some((status)=>status.includes(text))??false;
}

test("renamed Unarmed grapple can replace the first attack and renamed shove can replace the Extra Attack, with Undo restoring the grant",async()=>{
  const adapter=new MockAdapter();
  await ready(adapter);
  const renamedGrapple="action.external.family-j-replacement.control-a";
  const renamedShove="action.external.family-j-replacement.control-b";
  const originalGetSnapshot=adapter.getSnapshot.bind(adapter);
  adapter.getSnapshot=async()=>{
    const snapshot=await originalGetSnapshot();
    const actions=snapshot.scene.actionsByActor["char.aelar"]??[];
    const grapple=actions.find((entry)=>entry.id==="action.unarmed-strike.grapple");
    const shove=actions.find((entry)=>entry.id==="action.unarmed-strike.shove-prone");
    if(grapple){grapple.id=renamedGrapple;grapple.name="External Control Alpha";}
    if(shove){shove.id=renamedShove;shove.name="External Control Beta";}
    return snapshot;
  };

  await adapter.setQueuedD20(1);
  await adapter.resolveAction(renamedGrapple,["combatant.goblin-a"]);
  let snapshot=await adapter.getSnapshot();
  let state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(snapshot.resolution?.actionId,renamedGrapple);
  assert.equal(hasStatus(snapshot,"combatant.goblin-a","붙잡힘"),true);
  assert.equal(state.combatants["char.aelar"].economy.action,false,"the first replaced attack must spend the standard Attack Action");
  assert.equal(state.combatants["char.aelar"].economy.extraAttacks?.length,1,"the first replaced attack must preserve one remaining attack");

  await adapter.setQueuedD20(1);
  await adapter.resolveAction(renamedShove,["combatant.goblin-b"]);
  snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(snapshot.resolution?.actionId,renamedShove);
  assert.equal(hasStatus(snapshot,"combatant.goblin-b","넘어짐"),true);
  assert.equal(state.combatants["char.aelar"].economy.action,false,"the second replaced attack must not restore or spend another standard Action");
  assert.equal(state.combatants["char.aelar"].economy.extraAttacks?.length,0,"the second replaced attack must consume the remaining attack grant");

  const revisionAfterSecond=state.revision;
  await adapter.setQueuedD20(1);
  await adapter.resolveAction(renamedGrapple,["combatant.goblin-b"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.revision,revisionAfterSecond,"a third replacement must reject once all attack slots are exhausted");
  assert.equal(hasStatus(snapshot,"combatant.goblin-b","붙잡힘"),false);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(hasStatus(snapshot,"combatant.goblin-b","넘어짐"),false,"Undo must remove the second replacement's control effect");
  assert.equal(hasStatus(snapshot,"combatant.goblin-a","붙잡힘"),true,"Undo must preserve the first replacement's earlier committed effect");
  assert.equal(state.combatants["char.aelar"].economy.action,false);
  assert.equal(state.combatants["char.aelar"].economy.extraAttacks?.length,1,"Undo must restore the consumed replacement attack grant");
});
