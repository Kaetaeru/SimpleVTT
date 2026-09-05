import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/srdMonsterTimingRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { srdMonsterById, srdMonsterCombatantDefinition } from "../../src/app/srdMonsterCatalog";
import { initialMonsterTiming, timedSpecsOf } from "../../src/app/srdMonsterTimingRuntimeAdapter";
import { monsterTimingBadges } from "../../src/app/monsterTimingPresentation";

type Internal={
  queuedInitiativeD20?:number|null;
  queuedRechargeD6?:number[]|null;
  scene:{ currentActorId:string; entities:Array<{ id:string; side:"ally"|"enemy"; hp:number; initiative:number; runtimeMonsterTiming?:{ legendary?:{ remaining:number; max:number }; legendaryResistance?:{ remaining:number; max:number }; recharge:Record<string,{ ready:boolean }>; uses:Record<string,{ remaining:number; max:number }> } }>; actionsByActor:Record<string,Array<{ id:string; name:string; resolutionKind:string; economy:string; available:boolean; disabledReason?:string; runtimeMonsterTiming?:{ kind:string; blocked:boolean; label:string } }>>; monsterTimingByActor?:Record<string,unknown> };
};

const DRAGON="dnd.srd521.monster.adult-red-dragon";
const OGRE="dnd.srd521.monster.ogre";

async function dragonScene() {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=20;
  await adapter.instantiateCombatant(DRAGON);
  internal.queuedInitiativeD20=1;
  await adapter.instantiateCombatant(OGRE);
  const dragon=internal.scene.entities.find((entity)=>entity.id.startsWith(`${DRAGON}.instance-`))!;
  const ogre=internal.scene.entities.find((entity)=>entity.id.startsWith(`${OGRE}.instance-`))!;
  ogre.side="ally";
  await adapter.setReferenceRole("dm"); // legendary actions are used on other creatures' turns; the DM drives monsters
  await adapter.startInitiative();
  await adapter.setCurrentActor(dragon.id);
  return { adapter, internal, dragon, ogre };
}

/** The default scene holds the party and reference goblins too; walk turns until the actor comes up. */
async function advanceToActor(adapter:MockAdapter,actorId:string) {
  let snapshot=await adapter.endTurn();
  for (let step=0; step<12 && snapshot.scene.currentActorId!==actorId; step+=1) snapshot=await adapter.endTurn();
  assert.equal(snapshot.scene.currentActorId,actorId,"turn order reached the actor");
  return snapshot;
}

async function runToComplete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  await adapter.dismissResolution();
  return snapshot;
}

test("T1-02: stat-block timing lands on the runtime specs (recharge, per-round, legendary pool and resistance)", () => {
  const dragon=srdMonsterCombatantDefinition(srdMonsterById(DRAGON)!);
  const specs=timedSpecsOf(dragon);
  const breath=specs.find((spec)=>spec.name==="화염 브레스");
  assert.deepEqual(breath?.timing.recharge,{ min:5, sides:6 });
  const legendary=specs.filter((spec)=>spec.timing.legendaryCost);
  assert.equal(legendary.length,3,"three legendary actions carry a legendary cost");
  assert.ok(legendary.some((spec)=>spec.timing.usesPerRound===1),"a legendary action that cannot repeat until the next turn");
  const state=initialMonsterTiming(dragon)!;
  assert.deepEqual(state.legendary,{ remaining:3, max:3 });
  assert.deepEqual(state.legendaryResistance,{ remaining:3, max:3 });
  assert.equal(Object.values(state.recharge)[0]?.ready,true);
  assert.ok(dragon.runtimeTextActions?.length,"text-only legendary actions are projected as runtime text actions");

  const ankheg=srdMonsterCombatantDefinition(srdMonsterById("dnd.srd521.monster.ankheg")!);
  assert.deepEqual(timedSpecsOf(ankheg).find((spec)=>spec.name==="산성 분사")?.timing.recharge,{ min:6, sides:6 });
  const ancient=srdMonsterCombatantDefinition(srdMonsterById("dnd.srd521.monster.ancient-red-dragon")!);
  assert.equal(initialMonsterTiming(ancient)?.legendaryResistance?.max,4);
  const ogre=srdMonsterCombatantDefinition(srdMonsterById(OGRE)!);
  assert.equal(initialMonsterTiming(ogre),undefined,"a monster without timed actions carries no counters");
});

test("T1-02: a used breath weapon waits for its recharge roll at the start of the dragon's turn, and undo restores it", async () => {
  const { adapter, internal, dragon, ogre }=await dragonScene();
  const actionsBefore=internal.scene.actionsByActor[dragon.id];
  const breath=actionsBefore.find((action)=>action.name==="화염 브레스")!;
  assert.equal(breath.available,true);
  assert.equal(breath.runtimeMonsterTiming?.label,"재충전 5–6 · 준비됨");

  await adapter.setQueuedD20(3);
  let snapshot=await adapter.resolveAction(breath.id,[ogre.id]);
  assert.ok(snapshot.resolution && snapshot.resolution.calculatedOutcome!=="적용 거부",snapshot.resolution?.finalOutcome);
  assert.ok(snapshot.resolution.stateChanges.some((line)=>line.includes("재충전 필요")),"resolution records the spent recharge");
  snapshot=await runToComplete(adapter);
  let projected=snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===breath.id)!;
  assert.equal(projected.available,false);
  assert.ok((projected.disabledReason ?? "").includes("재충전 대기 중"),projected.disabledReason);
  assert.ok(monsterTimingBadges(snapshot.scene.entities.find((entity)=>entity.id===dragon.id)!).some((badge)=>badge.text==="화염 브레스 재충전 중"));

  // Undo (still the latest resolution): the counter comes back even though the atomic save undo rebuilds the scene from events.
  snapshot=await adapter.undoLastResolution();
  const restored=snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===breath.id)!;
  assert.equal(restored.runtimeMonsterTiming?.blocked,false,"undo restores the recharge counter");
  assert.ok(snapshot.activity[0]?.title.includes("되돌림"),snapshot.activity[0]?.title);
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(breath.id,[ogre.id]);
  snapshot=await runToComplete(adapter);
  assert.equal(snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===breath.id)?.available,false);

  // Walk the order back to the dragon: a 2 keeps it waiting.
  internal.queuedRechargeD6=[2];
  snapshot=await advanceToActor(adapter,dragon.id);
  projected=snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===breath.id)!;
  assert.equal(projected.available,false,"a 2 does not recharge");
  assert.ok(snapshot.activity.some((entry)=>entry.title==="턴 시작 · 몬스터 재정비" && entry.detail.some((line)=>line.includes("d6 2"))));

  internal.queuedRechargeD6=[5];
  snapshot=await advanceToActor(adapter,dragon.id);
  projected=snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===breath.id)!;
  assert.equal(projected.available,true,"a 5 recharges");
  assert.equal(projected.disabledReason,undefined);

});

test("T1-02: legendary actions draw from a per-round pool that refills at the dragon's turn start", async () => {
  const { adapter, internal, dragon }=await dragonScene();
  const legendary=internal.scene.actionsByActor[dragon.id].filter((action)=>action.runtimeMonsterTiming?.kind==="legendary");
  assert.equal(legendary.length,3);
  assert.ok(legendary.every((action)=>action.economy==="없음"));
  const pounce=legendary.find((action)=>action.name==="급습")!;
  assert.equal(pounce.resolutionKind,"no-roll");

  await adapter.endTurn(); // ogre's turn: the dragon may use legendary actions at the end of other turns
  let snapshot=await adapter.resolveAction(pounce.id,[]);
  assert.ok(snapshot.resolution,"legendary text action opens an effect resolution");
  snapshot=await runToComplete(adapter);
  let entity=snapshot.scene.entities.find((entry)=>entry.id===dragon.id)!;
  assert.deepEqual(entity.runtimeMonsterTiming?.legendary,{ remaining:2, max:3 });
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("전설 행동 3 → 2")),JSON.stringify(snapshot.activity[0]));

  await adapter.resolveAction(pounce.id,[]);
  await runToComplete(adapter);
  await adapter.resolveAction(pounce.id,[]);
  snapshot=await runToComplete(adapter);
  entity=snapshot.scene.entities.find((entry)=>entry.id===dragon.id)!;
  assert.equal(entity.runtimeMonsterTiming?.legendary?.remaining,0);
  const blocked=snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===pounce.id)!;
  assert.equal(blocked.available,false);
  assert.ok((blocked.disabledReason ?? "").includes("전설 행동이 부족합니다"),blocked.disabledReason);

  snapshot=await advanceToActor(adapter,dragon.id); // pool refills at the dragon's turn start
  entity=snapshot.scene.entities.find((entry)=>entry.id===dragon.id)!;
  assert.deepEqual(entity.runtimeMonsterTiming?.legendary,{ remaining:3, max:3 });
  assert.equal(snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===pounce.id)?.available,true);
});

test("T1-02: a legendary action that cannot repeat until the next turn is blocked after one use", async () => {
  const { adapter, internal, dragon }=await dragonScene();
  const onceARound=internal.scene.actionsByActor[dragon.id].find((action)=>action.runtimeMonsterTiming?.kind==="legendary" && action.runtimeMonsterTiming.label.includes("이번 턴"))!;
  assert.ok(onceARound,"dragon has a once-per-turn legendary action");
  await adapter.endTurn();
  await adapter.resolveAction(onceARound.id,[]);
  let snapshot=await runToComplete(adapter);
  const blocked=snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===onceARound.id)!;
  assert.equal(blocked.available,false);
  assert.equal(blocked.disabledReason,"다음 턴이 시작될 때까지 다시 사용할 수 없습니다.");
  snapshot=await advanceToActor(adapter,dragon.id);
  assert.equal(snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===onceARound.id)?.available,true);
});

test("T1-02: DM spends legendary resistance and can reset every counter", async () => {
  const { adapter, internal, dragon }=await dragonScene();
  let snapshot=await adapter.useLegendaryResistance(dragon.id);
  let entity=snapshot.scene.entities.find((entry)=>entry.id===dragon.id)!;
  assert.deepEqual(entity.runtimeMonsterTiming?.legendaryResistance,{ remaining:2, max:3 });
  assert.equal(snapshot.activity[0]?.title,"전설 저항 사용");
  const breath=internal.scene.actionsByActor[dragon.id].find((action)=>action.name==="화염 브레스")!;
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(breath.id,[internal.scene.entities.find((entry)=>entry.id.startsWith(`${OGRE}.instance-`))!.id]);
  await runToComplete(adapter);
  snapshot=await adapter.resetMonsterTiming(dragon.id);
  entity=snapshot.scene.entities.find((entry)=>entry.id===dragon.id)!;
  assert.deepEqual(entity.runtimeMonsterTiming?.legendaryResistance,{ remaining:3, max:3 });
  const reset=snapshot.scene.actionsByActor[dragon.id].find((action)=>action.id===breath.id)!;
  assert.equal(reset.runtimeMonsterTiming?.blocked,false,"the recharge counter is ready again");
  assert.equal(reset.disabledReason,"행동을 이미 사용했습니다.","only the ordinary action economy still gates it this turn");
});

test("T1-02: regular text-only actions spend the action economy through the no-roll flow", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  await adapter.instantiateCombatant("dnd.srd521.monster.ankheg");
  const ankheg=internal.scene.entities.find((entity)=>entity.id.startsWith("dnd.srd521.monster.ankheg.instance-"))!;
  await adapter.startInitiative();
  await adapter.setCurrentActor(ankheg.id);
  const bite=internal.scene.actionsByActor[ankheg.id].find((action)=>action.name==="물기")!;
  assert.equal(bite.resolutionKind,"no-roll","the ankheg bite is a text action in this translation");
  assert.equal(bite.economy,"행동");
  await adapter.resolveAction(bite.id,[]);
  const snapshot=await runToComplete(adapter);
  assert.equal(snapshot.scene.economyByActor[ankheg.id]?.action,false,"the action economy was spent");
});
