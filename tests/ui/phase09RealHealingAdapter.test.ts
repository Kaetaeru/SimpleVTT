import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealAtomicHealingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { resolveAtomicSelfHealing } from "../../src/app/realAtomicHealingTransactionService";

test("Second Wind atomic service rolls healing, Bonus Action, and class resource into one domain transaction", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const actor=snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!;
  const action=snapshot.scene.actionsByActor[actor.id].find((entry)=>entry.id==="action.second-wind")!;
  const result=resolveAtomicSelfHealing({
    resolutionId:"phase09.second-wind.atomic",
    action,
    actor,
    economy:snapshot.scene.economyByActor[actor.id],
    resources:snapshot.activeCharacter.resources,
    initiativeMode:true,
    healingAmount:10,
  });
  assert.equal(result.status,"committed");
  if(result.status==="committed") {
    assert.equal(result.hp,41);
    assert.equal(result.tempHp,5);
    assert.equal(result.restored,10);
    assert.equal(result.economy.bonusAction,false);
    assert.equal(result.resources.find((resource)=>resource.id==="resource.second-wind")?.current,0);
    assert.ok(result.events.some((event)=>event.stateChanges.some((change)=>change.kind==="hp"&&change.targetId==="char.aelar")));
    assert.ok(result.events.some((event)=>event.stateChanges.some((change)=>change.kind==="economy"&&change.field==="bonusAction")));
    assert.ok(result.events.some((event)=>event.stateChanges.some((change)=>change.kind==="resource"&&change.resourceId==="resource.second-wind")));
  }
});

test("Second Wind atomic service rejects the whole transaction when the class resource cannot be spent", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const actor=snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!;
  const action=snapshot.scene.actionsByActor[actor.id].find((entry)=>entry.id==="action.second-wind")!;
  const economy=structuredClone(snapshot.scene.economyByActor[actor.id]);
  const resources=snapshot.activeCharacter.resources.map((resource)=>resource.id==="resource.second-wind"?{...resource,current:0}:{...resource});
  const result=resolveAtomicSelfHealing({
    resolutionId:"phase09.second-wind.atomic.reject",action,actor,economy,resources,initiativeMode:true,healingAmount:10,
  });
  assert.equal(result.status,"rejected");
  assert.equal(actor.hp,31,"pure service input HP is not mutated on rejection");
  assert.equal(economy.bonusAction,true,"pure service input economy is not mutated on rejection");
  assert.equal(resources.find((resource)=>resource.id==="resource.second-wind")?.current,0);
});

test("Second Wind applies authoritative domain events to HP, Bonus Action, resource, and Activity", async () => {
  const adapter = new MockAdapter();
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,true);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id==="resource.second-wind")?.current,1);

  await adapter.resolveAction("action.second-wind",["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.equal(snapshot.resolution?.rollTotal,10);
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"effect-preview");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.hp,41);
  assert.equal(snapshot.activeCharacter.tempHp,5);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,false);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id==="resource.second-wind")?.current,0);
  assert.ok(snapshot.resolution?.stateChanges.includes("Aelar HP 31 → 41"));
  assert.ok(snapshot.resolution?.stateChanges.includes("추가 행동 사용"));
  assert.ok(snapshot.resolution?.stateChanges.includes("세컨드 윈드 1 → 0"));

  const activity=snapshot.activity[0];
  assert.equal(activity.id,snapshot.resolution?.id);
  assert.ok(activity.detail.some((line)=>line.startsWith("ResolutionEvent ")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar HP 31 → 41")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar economy.bonusAction true → false")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar resource.resource.second-wind 1 → 0")));
});

test("Second Wind Undo inverses HP, economy, and class resource from committed events without the before snapshot", async () => {
  const adapter=new MockAdapter();
  await adapter.resolveAction("action.second-wind",["char.aelar"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  const activityId=snapshot.activity[0]?.id;
  assert.equal(snapshot.activeCharacter.hp,41);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id==="resource.second-wind")?.current,0);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,false);

  (adapter as unknown as { lastBefore:unknown }).lastBefore=null;
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id==="resource.second-wind")?.current,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,true);
  assert.equal(snapshot.resolution,null);
  assert.equal(snapshot.activity[0]?.title,"Resolution 되돌림");
  assert.ok(snapshot.activity[0]?.detail.includes("Before snapshot 미사용"));
  assert.ok(snapshot.activity[0]?.detail.includes("HP + economy + resource inverse"));
  assert.ok(snapshot.activity.find((entry)=>entry.id===activityId)?.reversed);
});
