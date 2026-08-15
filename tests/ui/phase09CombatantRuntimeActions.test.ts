import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";

function internalScene(adapter:MockAdapter) {
  return (adapter as unknown as { scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"] }).scene;
}

async function commitAttack(adapter:MockAdapter) {
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

const SCOUT_PAYLOAD=JSON.stringify({
  id:"combatant.local-scout",
  name:"로컬 정찰병",
  ac:14,
  maxHp:20,
  speed:35,
  proficiencyBonus:2,
  abilities:{ str:8,dex:16,con:12,int:10,wis:14,cha:10 },
  savingThrowProficiencies:["wis"],
  resistances:[],
  immunities:[],
  vulnerabilities:[],
  runtimeActions:[{
    id:"dagger",
    name:"단검",
    category:"weapon",
    sourceKind:"weapon",
    attackBonus:5,
    rangeFeet:5,
    damage:{ type:"관통",dice:"1d4",flat:3 },
  }],
});

async function instantiateScout(adapter:MockAdapter) {
  await adapter.previewCombatantImport(SCOUT_PAYLOAD);
  await adapter.activateCombatantImport();
  await adapter.startInitiative();
  await adapter.instantiateCombatant("combatant.local-scout");
  const snapshot=await adapter.getSnapshot();
  const scout=snapshot.scene.entities.find((entity)=>entity.id==="combatant.local-scout.instance-1");
  assert.ok(scout);
  return scout!;
}

test("builtin encounter Goblin shortbow materializes from its Definition and executes through authoritative attack, Activity, and Undo", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("combatant.goblin-a");
  let snapshot=await adapter.getSnapshot();
  const actions=snapshot.scene.actionsByActor["combatant.goblin-a"] ?? [];
  const scimitar=actions.find((action)=>action.name==="시미터");
  const shortbow=actions.find((action)=>action.name==="숏보우");
  assert.equal(actions.length,2);
  assert.equal(scimitar?.id,"action.scimitar","existing encounter action identity stays stable while mechanics are upgraded");
  assert.equal(scimitar?.runtimeAttack?.rangeFeet,5);
  assert.equal(shortbow?.attackBonus,4);
  assert.equal(shortbow?.damage?.[0]?.dice,"1d6");
  assert.equal(shortbow?.damage?.[0]?.flat,2);
  assert.equal(shortbow?.runtimeAttack?.rangeFeet,80);
  assert.equal(shortbow?.runtimeAttack?.damageSource,"runtime:combatant-definition:combatant.goblin:action:shortbow:damage");

  await adapter.setQueuedD20(14);
  await adapter.resolveAction(shortbow!.id,["char.aelar"]);
  snapshot=await commitAttack(adapter);
  assert.equal(snapshot.resolution?.attackTotal,18);
  assert.equal(snapshot.resolution?.damageComponents[0]?.adjusted,5);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.tempHp,0);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,31);
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.action,false);

  const activity=snapshot.activity[0];
  assert.equal(activity.id,snapshot.resolution?.id);
  assert.ok(activity.detail.some((line)=>line.includes("runtime:combatant-definition:combatant.goblin:action:shortbow:damage")));
  assert.ok(activity.detail.some((line)=>line.includes("runtime:spatial:scene.ruined-gate:reference-fixture")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar 임시 HP 5 → 0")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("combatant.goblin-a economy.action true → false")));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.tempHp,5);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,31);
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.action,true);
  assert.equal(snapshot.resolution,null);
});

test("imported Combatant attack consumes structured Definition facts plus an explicitly supplied pairwise spatial fact", async () => {
  const adapter=new MockAdapter();
  const scout=await instantiateScout(adapter);
  const scene=internalScene(adapter);
  setSpatialRelation(scene,{
    sourceId:scout.id,
    targetId:"char.mira",
    distanceFeet:5,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance:"manual:test:combatant-runtime-spatial",
  });
  await adapter.setCurrentActor(scout.id);
  let snapshot=await adapter.getSnapshot();
  const dagger=(snapshot.scene.actionsByActor[scout.id] ?? []).find((action)=>action.name==="단검");
  assert.ok(dagger?.runtimeAttack);
  assert.equal(dagger?.attackBonus,5);
  assert.equal(dagger?.damage?.[0]?.dice,"1d4");
  assert.equal(dagger?.damage?.[0]?.flat,3);
  assert.equal(dagger?.runtimeAttack?.rangeFeet,5);

  await adapter.setQueuedD20(10);
  await adapter.resolveAction(dagger!.id,["char.mira"]);
  snapshot=await commitAttack(adapter);
  assert.equal(snapshot.resolution?.attackTotal,15);
  assert.equal(snapshot.resolution?.damageComponents[0]?.adjusted,5);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.mira")?.hp,19);
  assert.equal(snapshot.scene.economyByActor[scout.id]?.action,false);
  const activity=snapshot.activity[0];
  assert.equal(activity.id,snapshot.resolution?.id);
  assert.ok(activity.detail.some((line)=>line.includes("runtime:combatant-definition:combatant.local-scout:action:dagger:damage")));
  assert.ok(activity.detail.some((line)=>line.includes("manual:test:combatant-runtime-spatial")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.mira HP 24 → 19")));
  assert.ok(activity.stateChanges.some((line)=>line.includes(`${scout.id} economy.action true → false`)));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.mira")?.hp,24);
  assert.equal(snapshot.scene.economyByActor[scout.id]?.action,true);
  assert.equal(snapshot.resolution,null);
});

test("Combatant runtime attack with no pairwise spatial fact rejects without guessing from presentation distance", async () => {
  const adapter=new MockAdapter();
  const scout=await instantiateScout(adapter);
  await adapter.setCurrentActor(scout.id);
  let snapshot=await adapter.getSnapshot();
  const dagger=(snapshot.scene.actionsByActor[scout.id] ?? []).find((action)=>action.name==="단검");
  assert.ok(dagger?.runtimeAttack);

  await adapter.setQueuedD20(15);
  await adapter.resolveAction(dagger!.id,["char.mira"]);
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.finalOutcome ?? "",/missing pairwise spatial runtime fact/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.mira")?.hp,24);
  assert.equal(snapshot.scene.economyByActor[scout.id]?.action,true);
  assert.deepEqual(snapshot.resolution?.stateChanges,[]);
});
