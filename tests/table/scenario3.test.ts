import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { replayEvents } from "../../src/table/events";
import { createTableSessionFacade } from "../../src/table/facade";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState, type RulingSpec } from "../../src/table/state";
import { GOBLIN, P1, fighter, hp, table } from "./fixtures";

/**
 * Scenario 3 "DM 재량" (V2 roadmap T2-07) played offline on the kernel: a natural 1 and what the DM makes of it,
 * an improvised action ruled from the suggestion, hands (drop, draw, pick up), one ruling on many targets, and undo.
 * The Windows H+P1+P2 run of the same beats is the gate's remaining evidence.
 */
const chips=(runtime:TableRuntime,id:string)=>projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===id)!.status;
const hands=(runtime:TableRuntime,id:string)=>projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===id)!.hands;
const suggestionOf=(runtime:TableRuntime)=>{const question=runtime.state.questions[0]; return {name:String(question.context.suggestionName),spec:JSON.parse(String(question.context.suggestion)) as RulingSpec};};

test("scenario 3: nat 1 → DM narrates a fumble and drops the sword; hands; improvised sand; mass 공포; undo", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:3}]});
  const kael="char.kael",gobs=[1,2,3].map((n)=>`${GOBLIN}.instance-${n}`);
  dice.push(15,10,9,8);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,kael);

  // 자연 1: 자동 빗나감. DM 재량으로 검을 떨어뜨리고 서술한다 (규칙에는 없는 재량 결과, 명시적 DM 명령).
  dice.push(1,1,3,3);
  const swing=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gobs[0]]},P1);
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.equal(runtime.state.activeResolution?.attackOutcome,"빗나감");
  assert.equal(hp(runtime,gobs[0]),10);
  assert.equal(runtime.dispatch({type:"narrate",text:"카엘의 검이 손에서 미끄러져 바닥에 떨어진다."}).status,"committed");
  const fumble=runtime.dispatch({type:"object",actorId:kael,op:"drop",itemId:"item.longsword"});
  assert.equal(fumble.status,"committed",JSON.stringify(fumble));
  assert.deepEqual(runtime.state.floor.map((entry)=>[entry.item.name,entry.droppedBy]),[["롱소드",kael]]);
  assert.equal(hands(runtime,kael),"빈손");
  assert.ok(!projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[kael].some((action)=>action.id==="action.longsword"&&action.available),"the sword tile is gone while it lies on the floor");

  // 손: 같은 턴에 단검을 뽑는다 (첫 상호작용은 무료). 이미 행동을 썼으니 두 번째 물건 상호작용은 거부된다.
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"draw",itemId:"item.dagger"},P1).status,"committed");
  assert.match(hands(runtime,kael)??"",/단검/);
  const secondInteraction=runtime.dispatch({type:"object",actorId:kael,op:"pick-up",itemId:runtime.state.floor[0].id},P1);
  assert.equal(secondInteraction.status,"refused",JSON.stringify(secondInteraction));

  // 고블린 세 턴을 넘기고 카엘의 다음 턴: 검을 집는다 (무료 상호작용).
  for(let index=0;index<4;index+=1) assert.equal(runtime.dispatch({type:"end-turn"}).status,"committed");
  assert.equal(runtime.state.currentActorId,kael);
  assert.equal(runtime.state.round,2);
  const pickUp=runtime.dispatch({type:"object",actorId:kael,op:"pick-up",itemId:runtime.state.floor[0].id},P1);
  assert.equal(pickUp.status,"committed",JSON.stringify(pickUp));
  assert.equal(runtime.state.floor.length,0);

  // 즉흥 행동: 모래를 뿌린다 → DM 카드의 제안(눈 가리기)대로 판정. 내성 실패 → 실명.
  runtime.dispatch({type:"improvise",actorId:kael,text:"모래를 고블린 눈에 뿌린다",targetIds:[gobs[0]]},P1);
  assert.equal(suggestionOf(runtime).name,"눈 가리기");
  dice.push(2,2);
  const ruled=runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec:suggestionOf(runtime).spec});
  assert.equal(ruled.status,"committed",JSON.stringify(ruled));
  assert.ok(chips(runtime,gobs[0]).includes("✦ 실명"),JSON.stringify(chips(runtime,gobs[0])));

  // 다수 대상 재량: 세 고블린 모두 공포 (한 명령).
  const mass=runtime.dispatch({type:"ruling",targetIds:gobs,ruling:{kind:"condition",conditionId:"frightened",on:true,sourceActorId:kael},note:"카엘의 포효"});
  assert.equal(mass.status,"committed",JSON.stringify(mass));
  for(const gob of gobs) assert.ok(chips(runtime,gob).includes("✦ 공포"),`${gob}: ${JSON.stringify(chips(runtime,gob))}`);
  assert.equal(projectTable(runtime.state,{role:"player",peerId:P1.peerId}).activity[0]?.title,runtime.state.log[0].title,"players see the ruling in the log");

  // 되돌리기: 마지막 재량(공포 셋)만 되돌리고 실명은 남는다.
  assert.equal(runtime.dispatch({type:"undo"}).status,"committed");
  for(const gob of gobs) assert.ok(!chips(runtime,gob).includes("✦ 공포"),`${gob}: ${JSON.stringify(chips(runtime,gob))}`);
  assert.ok(chips(runtime,gobs[0]).includes("✦ 실명"));

  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("scenario 3 through the product path: the facade hosts a solo table and the DM's mass ruling and undo reach the snapshot", async () => {
  const base=new MockAdapter();
  const facade=createTableSessionFacade(base);
  const hosted=await facade.adapter.hostSession();
  assert.equal(hosted.session.lifecycle,"live");
  await facade.adapter.instantiateCombatantGroup(GOBLIN,2,"고블린");
  const ids=facade.runtime.state.order.length?[]:Object.values(facade.runtime.state.actors).filter((actor)=>actor.source.kind==="monster").map((actor)=>actor.id);
  assert.equal(ids.length,2);
  await facade.dispatch({type:"ruling",targetIds:ids,ruling:{kind:"condition",conditionId:"frightened",on:true}});
  let snapshot=await facade.adapter.getSnapshot();
  for(const id of ids) assert.ok(snapshot.scene.entities.find((entity)=>entity.id===id)?.status.includes("✦ 공포"));
  snapshot=await facade.adapter.undoLastResolution();
  for(const id of ids) assert.ok(!snapshot.scene.entities.find((entity)=>entity.id===id)?.status.includes("✦ 공포"));
});
