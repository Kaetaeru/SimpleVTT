import assert from "node:assert/strict";
import test from "node:test";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, cleric, fighter, hp, table } from "./fixtures";

/** Capability inventory §6 (potions), §9 (Hide, Search, Stabilize), §17 (rests). */
const P2={peerId:"peer.p2",role:"player" as const};
const tile=(runtime:TableRuntime,actorId:string,actionId:string)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>action.id===actionId);
const chips=(runtime:TableRuntime,id:string)=>projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===id)!.status;
const itemOf=(runtime:TableRuntime,actorId:string,itemId:string)=>{const actor=runtime.state.actors[actorId]; return actor.source.kind==="character"?actor.source.sheet.items.find((item)=>item.id===itemId):undefined;};

test("§17 rests: a short rest spends hit dice with the table's dice; a long rest restores HP, slots and half the hit dice; never in Initiative", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId}]});
  const kael="char.kael",sera="char.sera";
  assert.deepEqual(runtime.state.rules.combatants[kael].hitDice,[{id:"hit-die-d10",sides:10,current:5,maximum:5}],"a 5th-level fighter has five d10");
  dice.push(3,4);
  runtime.dispatch({type:"act",actorId:sera,actionId:"spell.dnd.srd521.spell.healing-word",targetIds:[kael]},P2);
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"damage",amount:20}});
  assert.equal(hp(runtime,kael),21);
  // 짧은 휴식: 카엘 히트 다이스 2개 (6, 4) + 건강 3×2 = 16 → 37; 세라는 0개
  dice.push(6,4);
  const short=runtime.dispatch({type:"rest",kind:"short",actorIds:[kael,sera],hitDice:{[kael]:2}});
  assert.equal(short.status,"committed",JSON.stringify(short));
  assert.equal(hp(runtime,kael),37);
  assert.equal(runtime.state.rules.combatants[kael].hitDice[0].current,3);
  const tooMany=runtime.dispatch({type:"rest",kind:"short",actorIds:[kael],hitDice:{[kael]:4}});
  assert.equal(tooMany.status==="refused"&&tooMany.refusal.message,"카엘의 히트 다이스가 4개 남아 있지 않습니다.");
  // 플레이어는 자기 캐릭터만 쉬게 할 수 있다
  assert.equal(runtime.dispatch({type:"rest",kind:"short",actorIds:[sera]},P1).status,"refused");
  // 긴 휴식: HP 전부, 1레벨 슬롯 3 → 4, 히트 다이스 3 → 5 (최대의 절반 회복)
  const long=runtime.dispatch({type:"rest",kind:"long",actorIds:[kael,sera]});
  assert.equal(long.status,"committed",JSON.stringify(long));
  assert.equal(hp(runtime,kael),42);
  assert.equal(runtime.state.rules.combatants[sera].resources.find((entry)=>entry.id==="spell-slot-1")?.current,4);
  assert.equal(runtime.state.rules.combatants[kael].hitDice[0].current,5);
  // 이니셔티브 중에는 쉴 수 없다
  dice.push(10,10);
  runtime.dispatch({type:"start-initiative"});
  const fighting=runtime.dispatch({type:"rest",kind:"short",actorIds:[kael]});
  assert.equal(fighting.status==="refused"&&fighting.refusal.message,"이니셔티브 중에는 쉴 수 없습니다. 먼저 이니셔티브를 종료하세요.");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§6 potions: drinking is a bonus action, administering an action; the bag loses one; §9 stabilize, hide, open checks", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:{...fighter(),hp:20},controllerPeer:P1.peerId},{kind:"character",sheet:{...cleric(),hp:5},controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",sera="char.sera",gob=`${GOBLIN}.instance-1`;
  dice.push(15,10,5);
  runtime.dispatch({type:"start-initiative"});
  assert.deepEqual(runtime.state.order,[kael,sera,gob]);
  // 마시기 (추가 행동): 2d4 (2+3) + 2 = 7 → 27; 물약 2 → 1
  dice.push(2,3);
  const drink=runtime.dispatch({type:"act",actorId:kael,actionId:"item.item.potion.drink",targetIds:[kael]},P1);
  assert.equal(drink.status,"committed",JSON.stringify(drink));
  assert.equal(hp(runtime,kael),27);
  assert.equal(itemOf(runtime,kael,"item.potion")?.quantity,1);
  assert.equal(runtime.state.rules.combatants[kael].economy.bonusAction,false);
  assert.equal(runtime.state.rules.combatants[kael].economy.action,true);
  // 먹이기 (행동) → 세라: 4+4+2 = 10 → 15; 물약 1 → 0, 타일 닫힘
  dice.push(4,4);
  const feed=runtime.dispatch({type:"act",actorId:kael,actionId:"item.item.potion.administer",targetIds:[sera]},P1);
  assert.equal(feed.status,"committed",JSON.stringify(feed));
  assert.equal(hp(runtime,sera),15);
  assert.equal(itemOf(runtime,kael,"item.potion"),undefined);
  assert.equal(tile(runtime,kael,"item.item.potion.drink"),undefined,"no potion, no tile");
  // 다음 턴: 세라가 쓰러지고 카엘이 안정화 (지혜(의학) +1: d20 12 → 13 vs DC 10)
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"},P2);
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,kael);
  runtime.dispatch({type:"ruling",targetIds:[sera],ruling:{kind:"life",state:"down"}});
  const notDown=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.stabilize",targetIds:[gob]},P1);
  assert.equal(notDown.status==="refused"&&notDown.refusal.message,"HP 0의 불안정한 대상만 안정화할 수 있습니다.");
  dice.push(12,12);
  const stabilize=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.stabilize",targetIds:[sera]},P1);
  assert.equal(stabilize.status,"committed",JSON.stringify(stabilize));
  assert.equal(runtime.state.rules.combatants[sera].life.stable,true);
  assert.ok(chips(runtime,sera).includes("안정"));
  // 다음 턴: 숨기 (민첩(은신) +2: d20 15 → 17 vs DC 15) → 숨음; 공격하면 해제
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"});
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,kael);
  dice.push(15,15);
  const hide=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.hide",targetIds:[]},P1);
  assert.equal(hide.status,"committed",JSON.stringify(hide));
  assert.ok(chips(runtime,kael).includes("✦ 숨음"),JSON.stringify(chips(runtime,kael)));
  assert.equal(runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.hide",targetIds:[]},P1).status,"refused","already hidden (and the action is spent)");
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"});
  runtime.dispatch({type:"end-turn"});
  dice.push(19,19,1,1);
  const strike=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(strike.status,"committed",JSON.stringify(strike));
  assert.ok(!chips(runtime,kael).includes("✦ 숨음"),"attacking ends hiding");
  assert.ok(strike.resolution?.stateChanges.includes("카엘 숨음 해제 (공격)"));
  // 열린 판정: 찾기 · 지각 — 결과만, DM이 판단
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"});
  runtime.dispatch({type:"end-turn"});
  dice.push(11,11);
  const search=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.search.perception",targetIds:[]},P1);
  assert.equal(search.status,"committed",JSON.stringify(search));
  assert.equal(search.resolution?.finalOutcome,"찾기 · 지각 12","no DC of its own: the total, for the DM to read");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
