import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/engagementRuntimeAdapter";
import "../../src/app/movementDeclarationRuntimeAdapter";
import "../../src/app/resolutionPostHocRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

type Internal={ queuedPostHocD20?:number|null; scene:{ currentActorId:string; engagements?:unknown[]; entities:Array<{ id:string; hp:number; movementDeclaration?:{ kind:string; targetId?:string } }>; actionsByActor:Record<string,Array<{ id:string; name:string }>>; economyByActor:Record<string,{ action:boolean }> } };

async function complete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

async function aelarTurn() {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const longsword=internal.scene.actionsByActor["char.aelar"].find((action)=>action.name==="롱소드")!;
  const shortbow=internal.scene.actionsByActor["char.aelar"].find((action)=>action.name==="숏보우")!;
  const initialHp=internal.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp; // the default scene goblin starts wounded
  return { adapter, internal, longsword, shortbow, initialHp };
}

const goblinHp=(snapshot:{ scene:{ entities:Array<{ id:string; hp:number }> } },id="combatant.goblin-a")=>snapshot.scene.entities.find((entity)=>entity.id===id)!.hp;

test("T1-06: 불리점 re-judges the committed hit with the same first d20 and turns it into a miss", async () => {
  const { adapter, internal, longsword, initialHp }=await aelarTurn();
  await adapter.setQueuedD20(15);
  await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  let snapshot=await complete(adapter);
  assert.equal(snapshot.resolution?.attackOutcome,"명중");
  const hpAfterHit=goblinHp(snapshot);
  assert.ok(hpAfterHit<initialHp,"the hit dealt damage");

  internal.queuedPostHocD20=2;
  snapshot=await adapter.applyPostHocToggle("disadvantage");
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.postHoc?.toggle,"disadvantage");
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감","min(15,2)+7 misses AC 15");
  assert.ok(snapshot.resolution?.rollStateContributions?.some((entry)=>entry.source==="dm:post-hoc:disadvantage"));
  assert.equal(goblinHp(snapshot),initialHp,"the original damage was undone and none re-applied");
  assert.ok(snapshot.activity.some((entry)=>entry.title==="사후 수정 · 불리점"));
  assert.ok(snapshot.activity.some((entry)=>entry.reversed),"the original resolution is marked reversed");
});

test("T1-06: 엄폐 ¾ raises the target's AC against the same roll; 이점 adds a second die", async () => {
  const { adapter, internal, longsword, initialHp }=await aelarTurn();
  await adapter.setQueuedD20(10); // 17 vs AC 15: hit
  await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  let snapshot=await complete(adapter);
  assert.equal(snapshot.resolution?.attackOutcome,"명중");
  snapshot=await adapter.applyPostHocToggle("cover-three-quarters");
  assert.equal(snapshot.resolution?.targetAc,20);
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감","17 vs 20 misses");
  assert.ok(snapshot.resolution?.provenance.some((line)=>line.includes("dm:post-hoc:cover:+5")));
  assert.equal(goblinHp(snapshot),initialHp);

  // Now advantage on top of the miss: a 19 second die hits.
  internal.queuedPostHocD20=19;
  snapshot=await adapter.applyPostHocToggle("advantage");
  assert.equal(snapshot.resolution?.attackOutcome,"명중");
  assert.equal(snapshot.resolution?.authoritativeDice.length>=1,true);
  assert.ok(goblinHp(snapshot)<initialHp,"damage applied after the advantage re-judgement");
});

test("T1-06: 판정 그대로 drops the automatic engagement disadvantage from a ranged attack", async () => {
  const { adapter, internal, shortbow }=await aelarTurn();
  // Goblin A engages Aelar first.
  await adapter.setCurrentActor("combatant.goblin-a");
  const scimitar=internal.scene.actionsByActor["combatant.goblin-a"].find((action)=>action.name==="시미터")!;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  await adapter.dismissResolution();
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(15);
  await adapter.resolveAction(shortbow.id,["combatant.goblin-b"]);
  let snapshot=await complete(adapter);
  assert.ok(snapshot.resolution?.rollStateContributions?.some((entry)=>entry.source.startsWith("engagement:ranged-in-melee")));
  snapshot=await adapter.applyPostHocToggle("plain-roll");
  assert.equal(snapshot.resolution?.postHoc?.toggle,"plain-roll");
  assert.ok(!snapshot.resolution?.rollStateContributions?.length,"no roll-state sources remain");
  assert.equal(snapshot.resolution?.attackOutcome,"명중","15+5 vs AC 14");
});

test("T1-06: 피해 절반 refunds half the damage dealt; 닿지 않음 cancels the attack and records an approach", async () => {
  const { adapter, longsword, initialHp }=await aelarTurn();
  await adapter.setQueuedD20(15);
  await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  let snapshot=await complete(adapter);
  const dealt=initialHp-goblinHp(snapshot);
  assert.ok(dealt>0);
  snapshot=await adapter.applyPostHocToggle("half-damage");
  assert.equal(goblinHp(snapshot),initialHp-dealt+Math.floor(dealt/2));
  assert.equal(snapshot.resolution?.postHoc?.toggle,"half-damage");
  assert.ok(snapshot.resolution?.finalOutcome.startsWith("피해 절반"));
  await adapter.dismissResolution();

  const internal=adapter as unknown as Internal;
  internal.scene.economyByActor["char.aelar"].action=true;
  await adapter.setQueuedD20(15);
  await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  snapshot=await complete(adapter);
  const before=goblinHp(snapshot);
  snapshot=await adapter.applyPostHocToggle("out-of-reach");
  assert.equal(snapshot.resolution,null,"the attack card is gone");
  assert.ok(goblinHp(snapshot)>before,"the damage was undone");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.movementDeclaration?.kind,"approach");
  assert.ok(snapshot.activity.some((entry)=>entry.title==="사후 수정 · 닿지 않음"));
});
