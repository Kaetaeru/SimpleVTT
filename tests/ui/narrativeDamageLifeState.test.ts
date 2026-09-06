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

test("S1-01: 안정화 guards refuse with a reason instead of returning the unchanged snapshot", async () => {
  const adapter=new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.selectDmActor("char.aelar");
  const refused=await adapter.resolveAction("action.standard.stabilize",["combatant.goblin-a"]);
  assert.ok(refused.refusal,"a refusal is recorded");
  assert.match(refused.refusal!.message,/안정화|불안정한 대상/);
});

test("S1-04: an effect that ends on a check is removed by an immediately-complete check (안정화) through resolution events", async () => {
  const { createEffect }=await import("../../src/domain/effects");
  const { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState }=await import("../../src/app/turnRuntimeSessionRegistry");
  const { runtimeResolutionEventHistory }=await import("../../src/app/runtimeResolutionEventHistory");
  // A second character joins the reference scene, goes down, and Aelar (helped) stabilizes him on his turn.
  const adapter=new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  (adapter as unknown as {scene:import("../../src/app/contracts").SceneVm}).scene.entities.push({id:"char.test-down",name:"테스트",side:"ally",kind:"character",hp:8,maxHp:8,tempHp:0,ac:12,initiative:5,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[]} as never);
  await adapter.getSnapshot();
  await adapter.applyNarrativeDamage("char.test-down",999);
  await adapter.setCurrentActor("char.aelar");
  await adapter.selectDmActor("char.aelar");
  const internal=adapter as unknown as {scene:import("../../src/app/contracts").SceneVm};
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene)!;
  state.effects.push(createEffect({id:"test:helped",sourceId:"action.standard.help",targetId:"char.aelar",kind:"marker",tags:["session-status"],duration:{kind:"special",key:"helped-until-next-attack-or-check"},metadata:{publicLabel:"도움 받음",sessionStatus:"도움 받음",endsOnAttack:true,endsOnCheck:true}},state.clock));
  const expected=state.revision;state.revision+=1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state),true);
  assert.ok((await adapter.getSnapshot()).scene.entities.find((entry)=>entry.id==="char.aelar")?.status.some((status)=>status.includes("도움 받음")));
  await adapter.setQueuedD20(15);
  const done=await adapter.resolveAction("action.standard.stabilize",["char.test-down"]);
  assert.equal(done.resolution?.stage,"complete",JSON.stringify(done.refusal??done.resolution));
  const events=runtimeResolutionEventHistory(adapter)?.events??[];
  assert.ok(events.some((event)=>event.stateChanges.some((change)=>change.kind==="effect"&&change.targetId==="char.aelar"&&change.after===undefined)),`the ending-effect removal is an authoritative event; got ${JSON.stringify(events.map((event)=>event.stateChanges.map((change)=>change.kind)))}`);
  assert.equal(done.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.some((status)=>status.includes("도움 받음")),false,"the Host shows the effect gone");
});
