import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { SceneVm } from "../../src/app/contracts";
import { resetConnectedSessionTransientState } from "../../src/app/connectedSessionRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  clearReadyActionConfiguration,
  readyActionConfigurationFor,
  readyActionConfigurationsFor,
  setReadyActionConfiguration,
} from "../../src/app/standardActionReadyState";

type MutableAdapter={scene:SceneVm};

function mutableScene(adapter:MockAdapter) {
  return (adapter as unknown as MutableAdapter).scene;
}

function armFixtureReady(adapter:MockAdapter,actorId:string,actionId:string,trigger:string) {
  const scene=mutableScene(adapter);
  const actor=scene.entities.find((entry)=>entry.id===actorId);
  assert.ok(actor,`missing actor ${actorId}`);
  if (!actor.status.includes("준비 행동")) actor.status.push("준비 행동");
  scene.economyByActor[actorId]??={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  scene.economyByActor[actorId]!.reaction=true;
  setReadyActionConfiguration(adapter,{actorId,actionId,trigger});
}

test("multiple actors keep independent Ready configurations and projected triggers",async()=>{
  const adapter=new MockAdapter();
  const initial=await adapter.getSnapshot();
  const aelarId="char.aelar";
  const goblinId="combatant.goblin-a";
  const aelarAction=initial.scene.actionsByActor[aelarId]?.find((action)=>!action.id.startsWith("action.standard.ready"));
  const goblinAction=initial.scene.actionsByActor[goblinId]?.find((action)=>!action.id.startsWith("action.standard.ready"));
  assert.ok(aelarAction,"Aelar requires a prepared action fixture");
  assert.ok(goblinAction,"goblin requires a prepared action fixture");

  armFixtureReady(adapter,aelarId,aelarAction.id,"문이 열리면");
  armFixtureReady(adapter,goblinId,goblinAction.id,"Aelar가 주문을 쓰면");

  let snapshot=await adapter.getSnapshot();
  assert.equal(readyActionConfigurationFor(adapter),undefined,"multi-actor Ready must not choose an arbitrary global configuration");
  assert.equal(readyActionConfigurationFor(adapter,aelarId)?.trigger,"문이 열리면");
  assert.equal(readyActionConfigurationFor(adapter,goblinId)?.trigger,"Aelar가 주문을 쓰면");
  assert.equal(readyActionConfigurationsFor(adapter).length,2);
  assert.match(snapshot.scene.actionsByActor[aelarId]?.find((action)=>action.id==="action.standard.ready.trigger")?.summary??"",/문이 열리면/);
  assert.match(snapshot.scene.actionsByActor[goblinId]?.find((action)=>action.id==="action.standard.ready.trigger")?.summary??"",/Aelar가 주문을 쓰면/);

  clearReadyActionConfiguration(adapter,aelarId);
  snapshot=await adapter.getSnapshot();
  assert.equal(readyActionConfigurationFor(adapter,aelarId),undefined);
  assert.equal(readyActionConfigurationFor(adapter,goblinId)?.trigger,"Aelar가 주문을 쓰면");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===aelarId)?.status.includes("준비 행동"),false);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===goblinId)?.status.includes("준비 행동"),true);
  assert.equal(snapshot.scene.actionsByActor[aelarId]?.some((action)=>action.id==="action.standard.ready.trigger"),false);
  assert.equal(snapshot.scene.actionsByActor[goblinId]?.some((action)=>action.id==="action.standard.ready.trigger"),true);
});

test("connected session transient reset clears every actor Ready configuration and visible status",async()=>{
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const aelarAction=snapshot.scene.actionsByActor["char.aelar"]?.[0];
  const goblinAction=snapshot.scene.actionsByActor["combatant.goblin-a"]?.[0];
  assert.ok(aelarAction&&goblinAction);
  armFixtureReady(adapter,"char.aelar",aelarAction.id,"A");
  armFixtureReady(adapter,"combatant.goblin-a",goblinAction.id,"B");
  assert.equal(readyActionConfigurationsFor(adapter).length,2);

  resetConnectedSessionTransientState(adapter,"test reset");

  assert.equal(readyActionConfigurationsFor(adapter).length,0);
  assert.equal(readyActionConfigurationFor(adapter,"char.aelar"),undefined);
  assert.equal(readyActionConfigurationFor(adapter,"combatant.goblin-a"),undefined);
  assert.equal(mutableScene(adapter).entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),false);
  assert.equal(mutableScene(adapter).entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.includes("준비 행동"),false);
});
