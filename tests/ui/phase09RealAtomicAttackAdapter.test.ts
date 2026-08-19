import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm, SceneEntity, SceneVm } from "../../src/app/contracts";
import { resolveAtomicAttackTransaction } from "../../src/app/realAttackTransactionService";
import { phase09DeterministicAttackFaces, resolveRuntimeAttackFact, resolveRuntimeTargetingFact } from "../../src/app/realRuntimeAttackFactProvider";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";

const SHORTBOW:ActionVm = {
  id:"action.shortbow",actorId:"char.aelar",name:"숏보우",category:"weapon",target:"enemy",economy:"행동",resolutionKind:"attack",
  summary:"+5 · 1d6+2 관통",available:true,eligibleTargetIds:["combatant.goblin-a"],attackBonus:5,
  damage:[{ type:"관통", dice:"1d6", flat:2, average:6 }],details:[],
};
const ACTOR:SceneEntity = {
  id:"char.aelar",name:"Aelar",side:"ally",kind:"character",hp:31,maxHp:42,tempHp:5,ac:18,initiative:17,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],
};
const TARGET:SceneEntity = {
  id:"combatant.goblin-a",name:"고블린 A",side:"enemy",kind:"combatant",hp:12,maxHp:21,tempHp:0,ac:15,initiative:14,status:[],distance:"22피트",resistances:[],immunities:[],vulnerabilities:[],reactions:[],
};
const ECONOMY = { action:true, bonusAction:true, reaction:true, movement:30, movementMax:30 };
const SCENE:SceneVm = {
  id:"scene.ruined-gate",name:"폐허가 된 성문",round:1,currentActorId:ACTOR.id,selectedActorId:ACTOR.id,
  entities:[structuredClone(ACTOR),structuredClone(TARGET)],actionsByActor:{},economyByActor:{ [ACTOR.id]:{...ECONOMY},[TARGET.id]:{...ECONOMY} },
};

const spatialFact=()=>resolveRuntimeTargetingFact(SCENE,ACTOR.id,TARGET.id);

test("runtime attack provider derives Shortbow damage/range from canonical weapon metadata", () => {
  const fact = resolveRuntimeAttackFact(SHORTBOW,phase09DeterministicAttackFaces(SHORTBOW));
  assert.equal(fact.sourceKind,"weapon");
  assert.equal(fact.rangeFeet,80);
  assert.deepEqual(fact.damageDice,[{ source:"runtime:weapon:dnd.srd521.item.weapon.shortbow:damage",sides:6,count:1,faces:[4,4] }]);
  assert.deepEqual(fact.flatDamage,[{ source:"runtime:action:action.shortbow:damage-flat",value:2 }]);
});

test("runtime targeting is unconstrained without a module fact and consumes explicit module facts when supplied", () => {
  const scene=structuredClone(SCENE);
  const defaultFact=resolveRuntimeTargetingFact(scene,ACTOR.id,TARGET.id);
  assert.equal(defaultFact.distanceFeet,0);
  assert.equal(defaultFact.visible,true);
  assert.equal(defaultFact.cover,"none");
  assert.ok(defaultFact.provenance.some((entry)=>entry.includes("unconstrained:no-authoritative-module-fact")));

  const target=scene.entities.find((entry)=>entry.id===TARGET.id);
  assert.ok(target);
  target.distance="999피트";
  assert.equal(resolveRuntimeTargetingFact(scene,ACTOR.id,TARGET.id).distanceFeet,0,"presentation distance never becomes default range authority");

  setSpatialRelation(scene,{
    sourceId:ACTOR.id,targetId:TARGET.id,distanceFeet:90,visible:true,cover:"half",targetCanSeeAttacker:true,
    provenance:"module:test-grid:spatial:char.aelar",
  });
  const constrained=resolveRuntimeTargetingFact(scene,ACTOR.id,TARGET.id);
  assert.equal(constrained.distanceFeet,90);
  assert.equal(constrained.cover,"half");
  assert.ok(constrained.provenance.includes("module:test-grid:spatial:char.aelar"));
});

test("atomic attack service keeps preview parity, domain events, and doubles only dice on critical", () => {
  const common = {
    action:SHORTBOW,actor:ACTOR,target:TARGET,actorEconomy:ECONOMY,targetEconomy:ECONOMY,initiativeMode:true,effectiveTargetAc:15,
    attackFact:resolveRuntimeAttackFact(SHORTBOW,phase09DeterministicAttackFaces(SHORTBOW)),targetingFact:spatialFact(),
  };
  const normal = resolveAtomicAttackTransaction({ ...common,resolutionId:"attack.normal",attackD20Face:11,expectedPreview:{ total:16,outcome:"명중",critical:false } });
  assert.equal(normal.status,"committed");
  if (normal.status === "committed") {
    assert.equal(normal.damageComponent?.raw,6);assert.deepEqual(normal.damageFaces,[4]);assert.equal(normal.targetHp,6);assert.equal(normal.actorEconomy.action,false);
    assert.equal(normal.eventCount,normal.events.length);assert.ok(normal.events.length>0);
    assert.ok(normal.events.some((event)=>event.stateChanges.some((change)=>change.kind==="hp"&&change.targetId==="combatant.goblin-a")));
    assert.ok(normal.events.some((event)=>event.stateChanges.some((change)=>change.kind==="economy"&&change.targetId==="char.aelar"&&change.field==="action")));
  }
  const critical = resolveAtomicAttackTransaction({ ...common,resolutionId:"attack.critical",attackD20Face:20,expectedPreview:{ total:25,outcome:"명중",critical:true } });
  assert.equal(critical.status,"committed");
  if (critical.status === "committed") {
    assert.equal(critical.damageComponent?.raw,10,"critical is 2d6 [4,4] + flat 2, not (1d6+2) x2");
    assert.deepEqual(critical.damageFaces,[4,4]);assert.equal(critical.targetHp,2);assert.equal(critical.actorEconomy.action,false);assert.equal(critical.eventCount,critical.events.length);
  }
});

test("explicit targeting facts still let the domain reject out-of-range module constraints", () => {
  const targeting=spatialFact();
  targeting.distanceFeet=90;
  const result=resolveAtomicAttackTransaction({
    resolutionId:"attack.module-out-of-range",action:SHORTBOW,actor:ACTOR,target:TARGET,actorEconomy:ECONOMY,targetEconomy:ECONOMY,initiativeMode:true,
    attackD20Face:11,effectiveTargetAc:15,attackFact:resolveRuntimeAttackFact(SHORTBOW,phase09DeterministicAttackFaces(SHORTBOW)),targetingFact:targeting,
  });
  assert.equal(result.status,"rejected");if(result.status==="rejected") assert.match(result.error,/beyond range 80 ft/);
});

test("atomic attack rejects preview/domain drift instead of silently applying", () => {
  const result=resolveAtomicAttackTransaction({
    resolutionId:"attack.drift",action:SHORTBOW,actor:ACTOR,target:TARGET,actorEconomy:ECONOMY,targetEconomy:ECONOMY,initiativeMode:true,
    attackD20Face:11,effectiveTargetAc:15,attackFact:resolveRuntimeAttackFact(SHORTBOW,phase09DeterministicAttackFaces(SHORTBOW)),targetingFact:spatialFact(),
    expectedPreview:{ total:999,outcome:"명중",critical:false },
  });
  assert.equal(result.status,"rejected");if(result.status==="rejected") assert.match(result.error,/preview drift/);
});

async function hitShortbow(adapter:MockAdapter) {
  await adapter.setQueuedD20(11);await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation");assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  await adapter.advanceResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.resolution?.stage,"attack-result");
  await adapter.advanceResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.resolution?.stage,"damage-animation");assert.deepEqual(snapshot.resolution?.authoritativeDice,[4]);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  await adapter.advanceResolution();return adapter.getSnapshot();
}

test("MockAdapter Shortbow final apply uses unconstrained default targeting, event-native Activity, and event-native Undo", async () => {
  const adapter=new MockAdapter();const snapshot=await hitShortbow(adapter);const goblin=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a");
  assert.equal(snapshot.resolution?.stage,"complete");assert.equal(goblin?.hp,6);assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.resolution?.damageComponents[0]?.raw,6);assert.match(snapshot.resolution?.damageComponents[0]?.source??"",/atomic resolveAttack transaction/);
  assert.ok(snapshot.resolution?.provenance.some((entry)=>entry.includes("runtime:weapon:dnd.srd521.item.weapon.shortbow:damage")));
  assert.ok(snapshot.resolution?.provenance.some((entry)=>entry.includes("unconstrained:no-authoritative-module-fact")));
  assert.ok(!snapshot.resolution?.provenance.some((entry)=>entry.includes("phase09:reference-attack")));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));assert.ok(snapshot.resolution?.stateChanges.includes("고블린 A HP 12 → 6"));
  const activity=snapshot.activity[0];assert.equal(activity.id,snapshot.resolution?.id);assert.ok(activity.detail.some((line)=>line.startsWith("ResolutionEvent ")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("combatant.goblin-a HP 12 → 6")));assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar economy.action true → false")));
  (adapter as unknown as { lastBefore:unknown }).lastBefore=null;await adapter.undoLastResolution();const undone=await adapter.getSnapshot();
  assert.equal(undone.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);assert.equal(undone.scene.economyByActor["char.aelar"]?.action,true);assert.equal(undone.resolution,null);
  assert.ok(undone.activity[0]?.detail.includes("Before snapshot 미사용"));assert.ok(undone.activity.find((entry)=>entry.id===activity.id)?.reversed);
});

test("event-native Undo rejects when current scene state drifted after the committed events", async () => {
  const adapter=new MockAdapter();await hitShortbow(adapter);await adapter.applyDmAdjudication({ type:"healing-correction",value:1,targetId:"combatant.goblin-a",scope:"resolution",reason:"stale undo guard fixture" });
  let snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,7);await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,7);assert.match(snapshot.resolution?.finalOutcome??"",/Undo 거부/);assert.match(snapshot.resolution?.detail.at(-1)??"",/event-native undo drift/);
});

test("Shortbow miss still commits Action cost atomically and projects the economy event", async () => {
  const adapter=new MockAdapter();await adapter.setQueuedD20(6);await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();assert.equal(snapshot.resolution?.attackOutcome,"빗나감");await adapter.advanceResolution();snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));assert.ok(snapshot.activity[0]?.detail.some((line)=>line.startsWith("ResolutionEvent ")));
});

test("runtime Combatant attack with no spatial-module relation stays valid and commits", async () => {
  const adapter=new MockAdapter();await adapter.startInitiative();await adapter.instantiateCombatant("combatant.goblin");
  let snapshot=await adapter.getSnapshot();const actorId="combatant.goblin.instance-1";const shortbow=snapshot.scene.actionsByActor[actorId]?.find((action)=>action.name==="숏보우");assert.ok(shortbow?.runtimeAttack);
  await adapter.setCurrentActor(actorId);await adapter.setQueuedD20(20);await adapter.resolveAction(shortbow!.id,["char.aelar"]);await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();assert.equal(snapshot.resolution?.stage,"attack-result");await adapter.advanceResolution();snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");await adapter.advanceResolution();snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");assert.ok(snapshot.resolution?.provenance.some((entry)=>entry.includes("unconstrained:no-authoritative-module-fact")));
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.tempHp,0);assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,28);assert.equal(snapshot.scene.economyByActor[actorId]?.action,false);
});
