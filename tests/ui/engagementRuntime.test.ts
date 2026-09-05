import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/engagementRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ENGAGEMENT_RANGED_IN_MELEE_SOURCE } from "../../src/app/engagementContracts";
import type { ActionVm } from "../../src/app/contracts";

type Internal={ scene:{ round:number; currentActorId:string; engagements?:Array<{ a:string; b:string }>; entities:Array<{ id:string; hp:number; engagedWithIds?:string[] }>; actionsByActor:Record<string,ActionVm[]>; economyByActor:Record<string,{ action:boolean }> } };

async function complete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  if (snapshot.resolution) {
    assert.equal(snapshot.resolution.stage,"complete");
    await adapter.dismissResolution();
  }
  return snapshot;
}

async function scene() {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  return { adapter, internal };
}

function pairs(internal:Internal) {
  return (internal.scene.engagements ?? []).map((record)=>`${record.a}|${record.b}`);
}

test("T1-03: a resolved melee attack engages attacker and target; a ranged attack while engaged takes disadvantage", async () => {
  const { adapter, internal }=await scene();
  await adapter.setCurrentActor("combatant.goblin-a");
  const scimitar=internal.scene.actionsByActor["combatant.goblin-a"].find((action)=>action.name==="시미터")!;
  await adapter.setQueuedD20(3); // a miss still means the goblin closed to melee
  let snapshot=await adapter.resolveAction(scimitar.id,["char.aelar"]);
  assert.ok(snapshot.resolution?.stateChanges.some((line)=>line.startsWith("교전 시작")),JSON.stringify(snapshot.resolution?.stateChanges));
  snapshot=await complete(adapter);
  assert.deepEqual(pairs(internal),["char.aelar|combatant.goblin-a"]);
  assert.deepEqual(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.engagedWithIds,["combatant.goblin-a"]);
  assert.deepEqual(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.engagedWithIds,["char.aelar"]);

  await adapter.setCurrentActor("char.aelar");
  const shortbow=internal.scene.actionsByActor["char.aelar"].find((action)=>action.name==="숏보우")!;
  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(shortbow.id,["combatant.goblin-b"]);
  const contribution=snapshot.resolution?.rollStateContributions?.find((entry)=>entry.source.startsWith(ENGAGEMENT_RANGED_IN_MELEE_SOURCE));
  assert.ok(contribution,"ranged attack in melee carries the engagement disadvantage");
  assert.equal(contribution.state,"disadvantage");
  assert.equal(snapshot.resolution?.authoritativeDice.length,2,"two d20s were rolled");
  snapshot=await complete(adapter);
  assert.deepEqual(pairs(internal),["char.aelar|combatant.goblin-a"],"a ranged attack does not engage");

  // The melee attack stays melee: the longsword on the goblin refreshes the same pair (action economy handed back for the test).
  internal.scene.economyByActor["char.aelar"].action=true;
  const longsword=internal.scene.actionsByActor["char.aelar"].find((action)=>action.name==="롱소드")!;
  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  assert.ok(snapshot.resolution?.stateChanges.some((line)=>line.startsWith("교전 유지")));
  await complete(adapter);
  assert.equal(pairs(internal).length,1);
});

test("T1-03: the DM toggle clears the engagement and the next ranged attack rolls normally", async () => {
  const { adapter, internal }=await scene();
  await adapter.setCurrentActor("combatant.goblin-a");
  const scimitar=internal.scene.actionsByActor["combatant.goblin-a"].find((action)=>action.name==="시미터")!;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  let snapshot=await adapter.setEngagement("char.aelar","combatant.goblin-a",false);
  assert.equal(snapshot.activity[0]?.title,"교전 해제");
  assert.deepEqual(pairs(internal),[]);
  await adapter.setCurrentActor("char.aelar");
  const shortbow=internal.scene.actionsByActor["char.aelar"].find((action)=>action.name==="숏보우")!;
  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(shortbow.id,["combatant.goblin-b"]);
  assert.ok(!snapshot.resolution?.rollStateContributions?.some((entry)=>entry.source.startsWith(ENGAGEMENT_RANGED_IN_MELEE_SOURCE)));
  assert.equal(snapshot.resolution?.authoritativeDice.length,1);
  await complete(adapter);
  snapshot=await adapter.setEngagement("char.aelar","combatant.goblin-b",true);
  assert.equal(snapshot.activity[0]?.title,"교전 지정");
  assert.deepEqual(pairs(internal),["char.aelar|combatant.goblin-b"]);
});

test("T1-03: Disengage ends the actor's engagements, undo restores them, death and idle rounds end them", async () => {
  const { adapter, internal }=await scene();
  await adapter.setCurrentActor("combatant.goblin-a");
  const scimitar=internal.scene.actionsByActor["combatant.goblin-a"].find((action)=>action.name==="시미터")!;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  let snapshot=await complete(adapter);
  assert.equal(pairs(internal).length,1);

  // Undo the melee attack: the engagement it created goes with it.
  snapshot=await adapter.undoLastResolution();
  assert.deepEqual(pairs(internal),[],"undo removes the engagement the attack created");

  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  assert.equal(pairs(internal).length,1);

  // Disengage (standard action, no roll) on Aelar's turn.
  await adapter.setCurrentActor("char.aelar");
  internal.scene.actionsByActor["char.aelar"].push({
    id:"action.standard.disengage", actorId:"char.aelar", name:"이탈", category:"basic", target:"self", economy:"행동", resolutionKind:"no-roll",
    summary:"이번 턴 이동이 기회 공격을 유발하지 않습니다.", available:true, eligibleTargetIds:[], details:[],
  });
  snapshot=await adapter.resolveAction("action.standard.disengage",["char.aelar"]);
  assert.ok(snapshot.resolution?.stateChanges.some((line)=>line.startsWith("교전 종료 (이탈)")),JSON.stringify(snapshot.resolution?.stateChanges));
  await complete(adapter);
  assert.deepEqual(pairs(internal),[]);

  // Death: an engaged creature at 0 HP drops out of every engagement on the next projection.
  await adapter.setCurrentActor("combatant.goblin-a");
  internal.scene.economyByActor["combatant.goblin-a"].action=true; // test hands the action back instead of cycling turns
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  internal.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp=0;
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(pairs(internal),[]);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.engagedWithIds,undefined);

  // Idle: engage on round 1, no melee during round 2 → gone at the start of round 3.
  internal.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp=5;
  internal.scene.economyByActor["combatant.goblin-a"].action=true;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  assert.equal(pairs(internal).length,1);
  const startRound=internal.scene.round;
  for (let step=0; step<40 && internal.scene.round<startRound+1; step+=1) await adapter.endTurn();
  assert.equal(pairs(internal).length,1,"still engaged at the start of the next round");
  for (let step=0; step<40 && internal.scene.round<startRound+2; step+=1) snapshot=await adapter.endTurn();
  assert.deepEqual(pairs(internal),[],"a full round without melee ends it");
  assert.ok(snapshot.activity.some((entry)=>entry.title.startsWith("교전 종료 · 한 라운드")));
});
