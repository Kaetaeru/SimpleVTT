import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/sceneConditionRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

type Internal={ scene:{ actionsByActor:Record<string,Array<{ id:string; name:string }>>; economyByActor:Record<string,{ action:boolean }>; entities:Array<{ id:string; hp:number; maxHp:number; status:string[] }> } };

async function aelarTurn() {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const longsword=internal.scene.actionsByActor["char.aelar"].find((action)=>action.name==="롱소드")!;
  return { adapter, internal, longsword };
}

test("T1-07: 엄폐 ¾ on the target raises AC; 투명 target gives disadvantage; both unseen cancel", async () => {
  const { adapter, internal, longsword }=await aelarTurn();
  await adapter.setCreatureBadge("combatant.goblin-a","cover-three-quarters",true);
  let snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.status.includes("엄폐 ¾"));
  await adapter.setQueuedD20(10); // 17 vs 15 would hit; vs 20 misses
  snapshot=await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  assert.equal(snapshot.resolution?.targetAc,20);
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감");
  assert.ok(snapshot.resolution?.provenance.some((line)=>line.includes("badge:cover:+5")));
  for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  await adapter.dismissResolution();

  // Switching to 엄폐 ½ replaces ¾.
  await adapter.setCreatureBadge("combatant.goblin-a","cover-half",true);
  snapshot=await adapter.getSnapshot();
  const goblin=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!;
  assert.ok(goblin.status.includes("엄폐 ½") && !goblin.status.includes("엄폐 ¾"));
  await adapter.setCreatureBadge("combatant.goblin-a","cover-half",false);

  // 투명 target → disadvantage.
  await adapter.setCreatureBadge("combatant.goblin-a","invisible",true);
  internal.scene.economyByActor["char.aelar"].action=true;
  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  assert.ok(snapshot.resolution?.rollStateContributions?.some((entry)=>entry.source==="badge:target-unseen:투명" && entry.state==="disadvantage"));
  assert.equal(snapshot.resolution?.authoritativeDice.length,2);
  for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  await adapter.dismissResolution();

  // Attacker 투명 too → advantage and disadvantage both present (they cancel in the roll state).
  await adapter.setCreatureBadge("char.aelar","invisible",true);
  internal.scene.economyByActor["char.aelar"].action=true;
  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  const states=(snapshot.resolution?.rollStateContributions ?? []).map((entry)=>entry.state).sort();
  assert.deepEqual(states,["advantage","disadvantage"]);
});

test("T1-07: 숨음 on the attacker gives advantage and is consumed by the attack declaration", async () => {
  const { adapter, longsword }=await aelarTurn();
  await adapter.setCreatureBadge("char.aelar","hidden",true);
  await adapter.setQueuedD20(15);
  const snapshot=await adapter.resolveAction(longsword.id,["combatant.goblin-a"]);
  assert.ok(!snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.status.includes("숨음"),"attacking reveals");
  assert.ok(snapshot.resolution?.stateChanges.some((line)=>line.includes("숨음")));
});

test("T1-07: scene conditions and narrative edits are logged, direct scene changes", async () => {
  const adapter=new MockAdapter();
  let snapshot=await adapter.setSceneCondition("darkness",true);
  assert.deepEqual(snapshot.scene.sceneConditions,["darkness"]);
  assert.equal(snapshot.activity[0]?.title,"장면 조건 · 어둠");
  snapshot=await adapter.setSceneCondition("fog",true);
  snapshot=await adapter.setSceneCondition("darkness",false);
  assert.deepEqual(snapshot.scene.sceneConditions,["fog"]);
  snapshot=await adapter.setSceneCondition("fog",false);
  assert.equal(snapshot.scene.sceneConditions,undefined);

  const goblin=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-b")!;
  snapshot=await adapter.applyNarrativeDamage(goblin.id,5);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===goblin.id)?.hp,goblin.hp-5);
  snapshot=await adapter.applyNarrativeDamage(goblin.id,"half");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===goblin.id)?.hp,goblin.hp-5-Math.floor((goblin.hp-5)/2));
  snapshot=await adapter.applyNarrativeDamage(goblin.id,-100);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===goblin.id)?.hp,goblin.maxHp,"healing caps at max HP");
  assert.ok(snapshot.activity[0]?.title.startsWith("서술 회복"));

  snapshot=await adapter.setCreatureStatus(goblin.id,"넘어짐",true);
  assert.ok(snapshot.scene.entities.find((entity)=>entity.id===goblin.id)?.status.includes("넘어짐"));
  snapshot=await adapter.setCreatureStatus(goblin.id,"넘어짐",false);
  assert.ok(!snapshot.scene.entities.find((entity)=>entity.id===goblin.id)?.status.includes("넘어짐"));
});

test("T1-07: the collapsed distance tool and the unmounted bridges are gone", () => {
  assert.equal(existsSync(new URL("../../src/MovementReactionBridge.tsx",import.meta.url)),false);
  assert.equal(existsSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url)),false);
});
