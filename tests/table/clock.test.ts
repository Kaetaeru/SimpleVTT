import assert from "node:assert/strict";
import test from "node:test";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, cleric, fighter, hp, table } from "./fixtures";

/** RULES_RUNTIME_SPECS.md §1 — the clock: rounds, DM time, rests, timers. */
const P2={peerId:"peer.p2",role:"player" as const};
const activeEffects=(runtime:ReturnType<typeof table>["runtime"],targetId:string)=>runtime.state.rules.effects.filter((effect)=>effect.targetId===targetId);

test("§1 clock: a round is six seconds; a one-minute condition ends after ten rounds; the DM moves time only outside Initiative; undo restores the clock", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  dice.push(15,10,5);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.rules.clock.elapsedSeconds,0);
  runtime.dispatch({type:"ruling",targetIds:[gob],ruling:{kind:"condition",conditionId:"frightened",on:true,duration:{kind:"minutes",amount:1}}});
  assert.equal(activeEffects(runtime,gob).length,1);
  const passRound=()=>{ for(let i=0;i<3;i+=1) assert.equal(runtime.dispatch({type:"end-turn"}).status,"committed"); };
  for(let round=0;round<9;round+=1) passRound();
  assert.equal(runtime.state.round,10);
  assert.equal(runtime.state.rules.clock.elapsedSeconds,54,"nine rounds passed");
  assert.equal(activeEffects(runtime,gob).length,1,"54 seconds: the minute is not over");
  passRound();
  assert.equal(runtime.state.rules.clock.elapsedSeconds,60);
  assert.equal(activeEffects(runtime,gob).length,0,"the one-minute condition expired with the tenth round");
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.clock?.elapsedSeconds,60);
  // 이니셔티브 중에는 라운드 단위만
  const hour=runtime.dispatch({type:"advance-time",preset:"1h"});
  assert.equal(hour.status==="refused"&&hour.refusal.message,"이니셔티브 중에는 라운드 단위로만 시간이 흐릅니다. 먼저 이니셔티브를 종료하세요.");
  assert.equal(runtime.dispatch({type:"advance-time",preset:"round"}).status,"committed");
  assert.equal(runtime.state.rules.clock.elapsedSeconds,66);
  runtime.dispatch({type:"end-initiative"});
  // 자유 진행: 1시간 → 08:00 시작 기준 09:01
  assert.equal(runtime.dispatch({type:"advance-time",preset:"1h",reason:"숲길을 걷는다"}).status,"committed");
  assert.equal(runtime.state.rules.clock.elapsedSeconds,3666);
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.clock?.timeOfDay,"09:01");
  assert.equal(runtime.state.log[0].title,"시간 경과 · 1시간");
  assert.equal(runtime.dispatch({type:"advance-time",preset:"to-dawn"}).status,"committed");
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.clock?.timeOfDay,"06:00");
  assert.equal(runtime.dispatch({type:"undo"}).status,"committed");
  assert.equal(runtime.state.rules.clock.elapsedSeconds,3666,"undo restores the clock");
  assert.equal(hp(runtime,kael),31);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§1 rests: a fight cancels a proposed short rest and interrupts a long one; an interrupted long rest needs a new proposal or a DM exception; a second long rest within 24 hours is warned", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId}]});
  const kael="char.kael",sera="char.sera";
  assert.equal(runtime.dispatch({type:"rest",kind:"short",actorIds:[kael,sera]}).status,"committed");
  assert.equal(runtime.state.questions.filter((question)=>question.kind==="rest").length,2);
  dice.push(15,10);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.resting,null,"a short rest interrupted by a fight is lost");
  assert.equal(runtime.state.questions.filter((question)=>question.kind==="rest").length,0);
  runtime.dispatch({type:"end-initiative"});
  assert.equal(runtime.dispatch({type:"rest",kind:"long",actorIds:[kael,sera]}).status,"committed");
  dice.push(15,10);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.resting?.interruptedAt,0,"a long rest interrupted by a fight is marked, not lost");
  runtime.dispatch({type:"end-initiative"});
  const blocked=runtime.dispatch({type:"rest-complete"});
  assert.equal(blocked.status==="refused"&&blocked.refusal.message,"긴 휴식이 이니셔티브로 중단되었습니다. 휴식을 다시 제안하거나 DM 예외(force)로 완료하세요.");
  assert.equal(runtime.dispatch({type:"rest-complete",force:true}).status,"committed");
  assert.equal(runtime.state.rules.clock.elapsedSeconds,8*3600);
  assert.equal(runtime.state.time.lastLongRest[sera],8*3600);
  // 24시간 안의 두 번째 긴 휴식: 경고만, 진행은 된다
  assert.equal(runtime.dispatch({type:"rest",kind:"long",actorIds:[kael]}).status,"committed");
  const again=runtime.dispatch({type:"rest-complete"});
  assert.equal(again.status,"committed");
  assert.ok(runtime.state.log[0].detail.some((line)=>line.startsWith("경고: 카엘의 긴 휴식이 24시간 안에 두 번째")),JSON.stringify(runtime.state.log[0]));
  // HP 0인 액터는 휴식에 낄 수 없다
  runtime.dispatch({type:"ruling",targetIds:[sera],ruling:{kind:"life",state:"down"}});
  const down=runtime.dispatch({type:"rest",kind:"short",actorIds:[kael,sera]});
  assert.equal(down.status==="refused"&&down.refusal.message,"세라은(는) HP 0이라 휴식에 참여할 수 없습니다. 치유하거나 안정 후 1d4시간을 기다리세요.");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§1 timers: a reminder opens a DM card when its time comes; a creature stabilized at 0 HP regains 1 HP after 1d4 hours", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId}]});
  const kael="char.kael",sera="char.sera";
  assert.equal(runtime.dispatch({type:"set-timer",label:"횃불 확인",inSeconds:600}).status,"committed");
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.timers?.length,1);
  assert.equal(projectTable(runtime.state,{role:"player",peerId:P1.peerId}).scene.timers,undefined,"timers are the DM's");
  assert.equal(runtime.dispatch({type:"advance-time",preset:"1min"}).status,"committed");
  assert.equal(runtime.state.questions.length,0);
  assert.equal(runtime.dispatch({type:"advance-time",preset:"10min"}).status,"committed");
  const card=runtime.state.questions.find((question)=>question.kind==="dm");
  assert.equal(card?.prompt,"알림: 횃불 확인");
  assert.equal(runtime.state.timers.length,0);
  assert.equal(runtime.dispatch({type:"answer-question",questionId:card!.id,optionId:"ok"}).status,"committed");
  // 세라가 쓰러지고 카엘이 안정화: 지혜(의학) +1, d20 12 → 13 vs DC 10; 1d4 = 2시간 뒤 1 HP
  runtime.dispatch({type:"ruling",targetIds:[sera],ruling:{kind:"life",state:"down"}});
  dice.push(12,12,2);
  const stabilize=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.stabilize",targetIds:[sera]},P1);
  assert.equal(stabilize.status,"committed",JSON.stringify(stabilize));
  assert.equal(runtime.state.rules.combatants[sera].life.stable,true);
  const recovery=runtime.state.timers.find((timer)=>timer.kind==="stable-recovery");
  assert.equal(recovery?.targetId,sera);
  assert.equal(recovery?.at,runtime.state.rules.clock.elapsedSeconds+7200);
  assert.equal(runtime.dispatch({type:"advance-time",preset:"1h"}).status,"committed");
  assert.equal(hp(runtime,sera),0);
  assert.equal(runtime.dispatch({type:"advance-time",preset:"1h"}).status,"committed");
  assert.equal(hp(runtime,sera),1,"stable at 0 HP for 1d4 hours: 1 HP");
  assert.equal(runtime.state.rules.combatants[sera].life.unconscious,false);
  assert.equal(runtime.state.timers.length,0);
  assert.ok(runtime.state.log[0].detail.includes("세라 안정 후 회복: HP 1"),JSON.stringify(runtime.state.log[0]));
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
