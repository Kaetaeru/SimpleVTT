import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09ManualMovementReactionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

async function startAelarTurn(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
}

test("current-turn controller can manually declare an opportunity attack without a movement system", async () => {
  const adapter=new MockAdapter();
  await startAelarTurn(adapter);
  await adapter.setQueuedD20(15);
  await adapter.declareManualMovementReaction({
    kind:"opportunity-attack",
    provokerId:"char.aelar",
    reactorId:"combatant.goblin-a",
    attackActionId:"action.scimitar",
    distanceFeet:5,
    visibleAtTrigger:true,
    coverAtTrigger:"none",
    targetCanSeeReactorAtTrigger:true,
  });

  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.equal(snapshot.resolution?.actorId,"combatant.goblin-a");
  assert.deepEqual(snapshot.resolution?.targetIds,["char.aelar"]);
  assert.match(snapshot.resolution?.actionName ?? "",/기회공격/);
  assert.ok(snapshot.resolution?.provenance.some((entry)=>entry.includes("manual:movement-reaction")));
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.reaction,true,"Reaction is not spent before authoritative apply");
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.action,true,"opportunity attack does not use the reactor Action");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.tempHp,5);

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  assert.equal(snapshot.resolution?.attackOutcome,"명중");

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[3]);
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.reaction,true,"staged damage has not committed yet");

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.reaction,false);
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.action,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.tempHp,0,"5 damage is absorbed by Aelar's 5 Temporary HP");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.hp,31);
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("combatant.goblin-a economy.reaction true → false")));
  assert.ok(snapshot.activity[0]?.detail.some((line)=>line.includes("reaction:manual-movement:opportunity-attack:action.scimitar")));

  (adapter as unknown as { lastBefore:unknown }).lastBefore=null;
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.reaction,true);
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.action,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.tempHp,5);
  assert.equal(snapshot.resolution,null);
  assert.ok(snapshot.activity[0]?.detail.includes("Before snapshot 미사용"));
});

test("manual trigger facts are still validated atomically by the attack domain", async () => {
  const adapter=new MockAdapter();
  await startAelarTurn(adapter);
  await adapter.setQueuedD20(15);
  await adapter.declareManualMovementReaction({
    kind:"opportunity-attack",
    provokerId:"char.aelar",
    reactorId:"combatant.goblin-a",
    attackActionId:"action.scimitar",
    distanceFeet:20,
    visibleAtTrigger:true,
    coverAtTrigger:"none",
    targetCanSeeReactorAtTrigger:true,
  });
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.finalOutcome ?? "",/range|거리|beyond/i);
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.reaction,true,"failed targeting rolls the Reaction spend back");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.tempHp,5);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.hp,31);
});

test("manual movement reaction declaration rejects a provoker who is not the current turn actor", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.declareManualMovementReaction({
    kind:"opportunity-attack",
    provokerId:"char.aelar",
    reactorId:"combatant.goblin-a",
    attackActionId:"action.scimitar",
    distanceFeet:5,
    visibleAtTrigger:true,
    coverAtTrigger:"none",
    targetCanSeeReactorAtTrigger:true,
  });
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution,null);
  assert.equal(snapshot.activity[0]?.title,"이동 반응 입력 거부");
  assert.match(snapshot.activity[0]?.summary ?? "",/현재 턴 Actor/);
});
