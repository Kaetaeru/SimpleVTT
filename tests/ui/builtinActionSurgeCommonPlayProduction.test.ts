import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { parseInstalledCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
} from "../../src/domain/coreClassResources";

function resourceCurrent(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,resourceId:string) {
  return snapshot.activeCharacter.resources.find((resource)=>resource.id===resourceId)?.current;
}

test("built-in Fighter Action Surge executes through generic Common Play production authority", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const builtin=snapshot.catalog.find((entry)=>entry.scope==="builtin"&&entry.contentId==="fighter.action-surge");
  assert.ok(builtin?.mechanics?.some((mechanic)=>mechanic.kind==="common-play"&&mechanic.config.id==="fighter.action-surge.activate"));

  const action=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>candidate.name==="액션 서지");
  assert.ok(action,"production Fighter action projection must expose Action Surge");
  const reference=parseInstalledCommonPlayActionId(action.id);
  assert.ok(reference,"Action Surge must dispatch through a generic Common Play action reference");
  assert.equal(reference.catalogId,builtin.id);
  assert.equal(reference.mechanicId,"fighter.action-surge.activate");
  assert.equal(reference.entryPointId,"activate");

  const featureBefore=resourceCurrent(snapshot,FIGHTER_ACTION_SURGE_RESOURCE_ID);
  const turnBefore=resourceCurrent(snapshot,FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID);
  assert.ok(featureBefore!==undefined&&featureBefore>0);
  assert.ok(turnBefore!==undefined&&turnBefore>0);

  await adapter.resolveAction(action.id,["char.aelar"]);
  snapshot=await adapter.getSnapshot();

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,action.id);
  assert.equal(resourceCurrent(snapshot,FIGHTER_ACTION_SURGE_RESOURCE_ID),featureBefore-1);
  assert.equal(resourceCurrent(snapshot,FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID),turnBefore-1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(resourceCurrent(snapshot,FIGHTER_ACTION_SURGE_RESOURCE_ID),featureBefore);
  assert.equal(resourceCurrent(snapshot,FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID),turnBefore);
  assert.deepEqual(snapshot.scene.economyByActor["char.aelar"]?.extraActions,[]);
});
