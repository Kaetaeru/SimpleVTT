import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/movementDeclarationRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

type Internal={ scene:{ round:number; currentActorId:string; engagements?:Array<{ a:string; b:string }>; pendingWithdrawal?:{ actorId:string; candidates:Array<{ reactorId:string; actionId:string }> }; movementDeclarations?:Record<string,{ kind:string; targetId?:string }>; entities:Array<{ id:string; status:string[]; hp:number; movementDeclaration?:{ kind:string } }>; actionsByActor:Record<string,Array<{ id:string; name:string }>>; economyByActor:Record<string,{ action:boolean; reaction:boolean }> } };

async function complete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  if (snapshot.resolution) { assert.equal(snapshot.resolution.stage,"complete"); await adapter.dismissResolution(); }
  return snapshot;
}

/** Goblin A attacks Aelar in melee so the pair is engaged, then it is Aelar's turn. */
async function engagedScene() {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor("combatant.goblin-a");
  const scimitar=internal.scene.actionsByActor["combatant.goblin-a"].find((action)=>action.name==="시미터")!;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  assert.equal(internal.scene.engagements?.length,1);
  await adapter.setCurrentActor("char.aelar");
  return { adapter, internal };
}

test("T1-05: 접근 and 그대로 are declarations only — logged, shown on the card, cleared at the actor's next turn", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.declareMovement("char.aelar","approach","combatant.goblin-b");
  assert.equal(snapshot.activity[0]?.title,"이동 · 접근");
  assert.deepEqual(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.movementDeclaration,{ kind:"approach", targetId:"combatant.goblin-b", round:1 });
  assert.equal(snapshot.scene.engagements?.length ?? 0,0,"approach does not engage by itself");
  snapshot=await adapter.declareMovement("char.aelar","stay");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.movementDeclaration?.kind,"stay");
  // Walk the order round to Aelar again: the declaration is gone.
  snapshot=await adapter.endTurn();
  for (let step=0; step<12 && snapshot.scene.currentActorId!=="char.aelar"; step+=1) snapshot=await adapter.endTurn();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.movementDeclaration,undefined);
});

test("T1-05: 물러남 while engaged prompts the DM; choosing the reactor resolves its opportunity attack and ends the engagement", async () => {
  const { adapter, internal }=await engagedScene();
  let snapshot=await adapter.declareMovement("char.aelar","withdraw");
  const prompt=snapshot.scene.pendingWithdrawal;
  assert.ok(prompt,"prompt raised");
  assert.equal(prompt.actorId,"char.aelar");
  assert.deepEqual(prompt.candidates.map((candidate)=>candidate.reactorId),["combatant.goblin-a"]);
  assert.equal(internal.scene.engagements?.length,1,"engagement holds until the prompt is answered");
  // While the prompt is open, other declarations wait.
  snapshot=await adapter.declareMovement("char.aelar","stay");
  assert.equal(snapshot.activity[0]?.title,"이동 선언 보류");

  await adapter.setQueuedD20(18);
  snapshot=await adapter.answerWithdrawalPrompt("combatant.goblin-a");
  assert.equal(snapshot.scene.pendingWithdrawal,undefined);
  assert.ok(snapshot.resolution,"opportunity attack resolution opened");
  assert.ok(snapshot.resolution.actionName.includes("기회공격"),snapshot.resolution.actionName);
  assert.equal(snapshot.resolution.actorId,"combatant.goblin-a");
  assert.deepEqual(snapshot.resolution.targetIds,["char.aelar"]);
  assert.deepEqual(internal.scene.engagements ?? [],[],"the withdrawing creature's engagements ended");
  snapshot=await complete(adapter);
  assert.equal(snapshot.scene.economyByActor["combatant.goblin-a"]?.reaction,false,"the goblin spent its reaction");
  assert.ok(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!.hp<42 || snapshot.activity.some((entry)=>entry.title.includes("기회공격")),"the attack was recorded");
});

test("T1-05: 물러남 with 없음, after 이탈, or without a reaction never prompts", async () => {
  const { adapter, internal }=await engagedScene();
  let snapshot=await adapter.declareMovement("char.aelar","withdraw");
  assert.ok(snapshot.scene.pendingWithdrawal);
  snapshot=await adapter.answerWithdrawalPrompt(null);
  assert.equal(snapshot.scene.pendingWithdrawal,undefined);
  assert.equal(snapshot.resolution,null);
  assert.deepEqual(internal.scene.engagements ?? [],[]);
  assert.ok(snapshot.activity[0]?.summary.includes("기회공격 없이"));

  // Re-engage, then 이탈 status suppresses the prompt.
  await adapter.setCurrentActor("combatant.goblin-a");
  internal.scene.economyByActor["combatant.goblin-a"].action=true;
  const scimitar=internal.scene.actionsByActor["combatant.goblin-a"].find((action)=>action.name==="시미터")!;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  await adapter.setCurrentActor("char.aelar");
  internal.scene.entities.find((entity)=>entity.id==="char.aelar")!.status.push("이탈");
  snapshot=await adapter.declareMovement("char.aelar","withdraw");
  assert.equal(snapshot.scene.pendingWithdrawal,undefined);
  assert.deepEqual(internal.scene.engagements ?? [],[]);
  assert.ok(snapshot.activity[0]?.summary.includes("이탈"));
  internal.scene.entities.find((entity)=>entity.id==="char.aelar")!.status.pop();

  // Re-engage, but the goblin has no reaction left: no prompt.
  await adapter.setCurrentActor("combatant.goblin-a");
  internal.scene.economyByActor["combatant.goblin-a"].action=true;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(scimitar.id,["char.aelar"]);
  await complete(adapter);
  await adapter.setCurrentActor("char.aelar");
  internal.scene.economyByActor["combatant.goblin-a"].reaction=false; // after the turn runtime projection so it is not re-projected
  snapshot=await adapter.declareMovement("char.aelar","withdraw");
  assert.equal(snapshot.scene.pendingWithdrawal,undefined);
  assert.deepEqual(internal.scene.engagements ?? [],[]);
});
