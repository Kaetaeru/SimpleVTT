import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";

const aelar=(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>)=>snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")!;

test("S1-04: DM narrative damage to 0 HP knocks a character unconscious, projects 죽음 내성 굴림 on his turn, and narrative healing brings him back", async () => {
  const adapter=new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.applyNarrativeDamage("char.aelar",999);
  const down=aelar(snapshot);
  assert.equal(down.hp,0);
  assert.equal(down.runtimeLife?.unconscious,true,`0 HP is Unconscious; got ${JSON.stringify(down.runtimeLife)}`);
  assert.equal(down.runtimeLife?.dead,false);
  const deathSave=(snapshot.scene.actionsByActor["char.aelar"]??[]).find((action)=>action.id==="action.death-save");
  assert.ok(deathSave?.available,"죽음 내성 굴림 is offered on the downed character's turn");
  const sword=(snapshot.scene.actionsByActor["char.aelar"]??[]).find((action)=>action.id==="action.longsword");
  assert.equal(sword?.available,false);
  assert.equal(sword?.disabledReason,"의식불명 · 죽음 내성 굴림만 할 수 있습니다.");
  snapshot=await adapter.applyNarrativeDamage("char.aelar",-5);
  const up=aelar(snapshot);
  assert.equal(up.hp,5);
  assert.equal(up.runtimeLife?.unconscious,false,"regaining HP ends the unconsciousness");
  assert.equal((snapshot.scene.actionsByActor["char.aelar"]??[]).some((action)=>action.id==="action.death-save"),false);
});

test("S1-04: DM narrative damage to 0 HP kills a monster", async () => {
  const adapter=new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  const snapshot=await adapter.applyNarrativeDamage("combatant.goblin-a",999);
  const goblin=snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!;
  assert.equal(goblin.hp,0);
  assert.equal(goblin.runtimeLife?.dead,true);
});
