import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { MovementSpatialUpdate } from "../../src/app/movementRuntimeContracts";

function movedAelarSpatial():MovementSpatialUpdate[] {
  const pairs:Array<[string,string,number]> = [
    ["char.aelar","combatant.goblin-a",90],["combatant.goblin-a","char.aelar",90],
    ["char.aelar","combatant.goblin-b",40],["combatant.goblin-b","char.aelar",40],
    ["char.aelar","combatant.wolf",25],["combatant.wolf","char.aelar",25],
    ["char.aelar","combatant.training-guardian",30],["combatant.training-guardian","char.aelar",30],
  ];
  return pairs.map(([sourceId,targetId,distanceFeet])=>({
    sourceId,targetId,distanceFeet,visible:true,cover:"none",targetCanSeeAttacker:true,
  }));
}

test("initiative start and turn advancement project domain turn runtime state into SceneVm", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.sessionMode,"initiative");
  assert.equal(snapshot.scene.round,1);
  assert.equal(snapshot.scene.currentActorId,"char.mira","highest initiative actor starts");
  for (const entity of snapshot.scene.entities) {
    assert.equal(snapshot.scene.economyByActor[entity.id]?.action,true);
    assert.equal(snapshot.scene.economyByActor[entity.id]?.bonusAction,true);
    assert.equal(snapshot.scene.economyByActor[entity.id]?.reaction,true);
    assert.equal(snapshot.scene.economyByActor[entity.id]?.movement,30);
  }

  await adapter.endTurn();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshot.scene.round,1);
  assert.ok(snapshot.activity[0]?.detail.some((entry)=>entry.includes("RulesRuntimeState revision")));
});

test("movement spends turn-runtime movement and atomically replaces the complete tracked spatial set", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  await adapter.moveActor({
    actorId:"char.aelar",
    distanceFeet:10,
    spatialUpdates:movedAelarSpatial().slice(0,2),
  });
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,30,"incomplete spatial updates must reject before movement commit");
  assert.equal(snapshot.activity[0]?.title,"이동 적용 거부");
  assert.match(snapshot.activity[0]?.summary ?? "",/complete tracked spatial updates/);

  await adapter.moveActor({
    actorId:"char.aelar",
    distanceFeet:10,
    spatialUpdates:movedAelarSpatial(),
  });
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,20);
  assert.equal(snapshot.scene.spatialByPair?.["char.aelar=>combatant.goblin-a"]?.distanceFeet,90);
  assert.equal(snapshot.scene.spatialByPair?.["combatant.goblin-a=>char.aelar"]?.distanceFeet,90);
  assert.equal(snapshot.activity[0]?.title,"이동 적용");
  assert.ok(snapshot.activity[0]?.detail.some((line)=>line.startsWith("ResolutionEvent ")&&line.includes("move")));
  assert.ok(snapshot.activity[0]?.stateChanges.includes("char.aelar movement 30 → 20"));
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("char.aelar->combatant.goblin-a distance 22 → 90ft")));

  await adapter.setQueuedD20(15);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.finalOutcome ?? "",/range|거리|90/i,"updated spatial fact must drive targeting rejection");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true,"out-of-range attack must not spend Action");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,20,"attack rejection must preserve committed movement spend");
});

test("outer atomic attack HP/economy is reconciled into turn runtime and survives later snapshots", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(15);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,6);

  await adapter.setCurrentActor("combatant.goblin-a");
  await adapter.setCurrentActor("char.aelar");
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false,"manual actor selection must not start a new turn");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,6,"runtime projection must preserve committed HP");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12,"event-native Undo is reconciled back into turn runtime");
});

test("accepted interrupt spends Reaction in turn runtime and attack Undo restores the reaction event", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(15);
  await adapter.resolveAction("action.shortbow",["combatant.training-guardian"]);
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"interrupt");
  assert.equal(snapshot.scene.economyByActor["combatant.training-guardian"]?.reaction,true);

  await adapter.respondToInterrupt(true);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  assert.equal(snapshot.resolution?.targetAc,19);
  assert.equal(snapshot.resolution?.attackOutcome,"명중");
  assert.equal(snapshot.scene.economyByActor["combatant.training-guardian"]?.reaction,false);
  assert.ok(snapshot.resolution?.detail.some((line)=>line.includes("RulesRuntimeState reaction commit")));
  assert.ok(snapshot.resolution?.provenance.some((line)=>line.includes("reaction:reaction.guard")));

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.scene.economyByActor["combatant.training-guardian"]?.reaction,false);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.training-guardian")?.tempHp,0);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.training-guardian")?.hp,28);
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("combatant.training-guardian economy.reaction true → false")));

  (adapter as unknown as { lastBefore:unknown }).lastBefore=null;
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.scene.economyByActor["combatant.training-guardian"]?.reaction,true);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.training-guardian")?.tempHp,4);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.training-guardian")?.hp,30);
  assert.equal(snapshot.resolution,null);
});

test("round wrap starts Aelar's next turn from base speed and refreshed economy", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(15);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  const count=snapshot.scene.entities.length;
  for (let index=0;index<count;index+=1) await adapter.endTurn();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshot.scene.round,2);
  assert.deepEqual(snapshot.scene.economyByActor["char.aelar"],{
    action:true,
    bonusAction:true,
    reaction:true,
    movement:30,
    movementMax:30,
  });
});

test("combatant instantiated during initiative joins runtime with Definition-backed actions instead of the Mock +3 attack", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.mira");

  await adapter.instantiateCombatant("combatant.goblin");
  snapshot=await adapter.getSnapshot();
  const added=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin.instance-1");
  assert.ok(added);
  assert.equal(snapshot.scene.currentActorId,"char.mira","adding a combatant must not restart initiative");
  assert.deepEqual(snapshot.scene.economyByActor[added!.id],{
    action:true,
    bonusAction:true,
    reaction:true,
    movement:30,
    movementMax:30,
  });
  const actions=snapshot.scene.actionsByActor[added!.id] ?? [];
  assert.equal(actions.length,2);
  const scimitar=actions.find((action)=>action.name==="시미터")!;
  const shortbow=actions.find((action)=>action.name==="숏보우")!;
  assert.equal(scimitar.attackBonus,4);
  assert.equal(scimitar.damage?.[0]?.dice,"1d6");
  assert.equal(scimitar.damage?.[0]?.flat,2);
  assert.equal(scimitar.runtimeAttack?.rangeFeet,5);
  assert.equal(shortbow.attackBonus,4);
  assert.equal(shortbow.runtimeAttack?.rangeFeet,80);
  assert.ok(!actions.some((action)=>action.attackBonus===3 && action.damage?.[0]?.flat===1),"legacy generated +3/1d6+1 attack must be gone");

  const activity=snapshot.activity.find((entry)=>entry.title==="컴배턴트 인스턴스 추가" && entry.summary===added!.name);
  assert.ok(activity?.detail.some((line)=>line.includes("RulesRuntimeState combatant materialized")));
  assert.ok(activity?.stateChanges.includes(`Runtime combatant ${added!.id} 추가`));

  await adapter.setCurrentActor(added!.id);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,added!.id,"new runtime combatant participates in initiative actor selection");
  await adapter.endTurn();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.mira","advancing from the lowest-initiative added combatant wraps the round");
  assert.equal(snapshot.scene.round,2);
});

test("ending initiative releases the runtime session and returns to freeform", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.endInitiative();
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.sessionMode,"freeform");
  assert.equal(snapshot.activity[0]?.title,"이니셔티브 종료");
});
