import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealAtomicItemAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

async function applyPotion(adapter:MockAdapter) {
  await adapter.resolveAction("action.healing-potion",["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"effect-preview");
  await adapter.advanceResolution();
  return adapter.getSnapshot();
}

async function applyWand(adapter:MockAdapter) {
  await adapter.resolveAction("action.wand",["combatant.goblin-a"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"effect-preview");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[2,2,2]);
  await adapter.advanceResolution();
  return adapter.getSnapshot();
}

test("healing potion commits healing, quantity, and Action in one domain event stream", async () => {
  const adapter=new MockAdapter();
  const snapshot=await applyPotion(adapter);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.hp,40);
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id==="item.potion.aelar")?.quantity,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("Aelar HP 31 → 40"));
  assert.ok(snapshot.resolution?.stateChanges.includes("치유 물약 수량 2 → 1"));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
  const activity=snapshot.activity[0];
  assert.equal(activity.id,snapshot.resolution?.id);
  assert.ok(activity.detail.some((line)=>line.startsWith("ResolutionEvent ")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar HP 31 → 40")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("phase09:item:item.potion.aelar:quantity")&&line.includes("2 → 1")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar economy.action true → false")));
});

test("healing potion event-native Undo restores HP, quantity, and Action without before snapshot", async () => {
  const adapter=new MockAdapter();
  await applyPotion(adapter);
  (adapter as unknown as { lastBefore:unknown }).lastBefore=null;
  await adapter.undoLastResolution();
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id==="item.potion.aelar")?.quantity,2);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.resolution,null);
  assert.ok(snapshot.activity[0]?.detail.includes("Before snapshot 미사용"));
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("item.item.potion.aelar.quantity 1 → 2")));
});

test("wand commits structured force damage, charge, and Action in one domain event stream", async () => {
  const adapter=new MockAdapter();
  const snapshot=await applyWand(adapter);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[2,2,2]);
  assert.equal(snapshot.resolution?.damageComponents[0]?.raw,9);
  assert.match(snapshot.resolution?.damageComponents[0]?.source??"",/atomic item damage transaction/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,3);
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id==="item.wand.aelar")?.charges?.current,6);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("고블린 A HP 12 → 3"));
  assert.ok(snapshot.resolution?.stateChanges.includes("마법 미사일 완드 충전 7 → 6"));
  const activity=snapshot.activity[0];
  assert.ok(activity.detail.some((line)=>line.startsWith("ResolutionEvent ")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("combatant.goblin-a HP 12 → 3")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("phase09:item:item.wand.aelar:charges")&&line.includes("7 → 6")));
});

test("wand event-native Undo restores damage, charge, and Action without before snapshot", async () => {
  const adapter=new MockAdapter();
  await applyWand(adapter);
  (adapter as unknown as { lastBefore:unknown }).lastBefore=null;
  await adapter.undoLastResolution();
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id==="item.wand.aelar")?.charges?.current,7);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.resolution,null);
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("item.item.wand.aelar.charges 6 → 7")));
});

test("item event-native Undo rejects stale quantity/charge drift instead of overwriting later state", async () => {
  const adapter=new MockAdapter();
  await applyPotion(adapter);
  const internal=adapter as unknown as { activeCharacter:{ items:Array<{ id:string;quantity:number }> } };
  const potion=internal.activeCharacter.items.find((item)=>item.id==="item.potion.aelar")!;
  potion.quantity=0;
  await adapter.undoLastResolution();
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id==="item.potion.aelar")?.quantity,0);
  assert.match(snapshot.resolution?.finalOutcome??"",/Undo 거부/);
  assert.match(snapshot.resolution?.detail.at(-1)??"",/event-native undo drift/);
});
