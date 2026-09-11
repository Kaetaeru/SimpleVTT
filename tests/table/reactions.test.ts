import assert from "node:assert/strict";
import test from "node:test";
import { engagedWith, isEngaged } from "../../src/domain/engagement";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, fighter, hp, table } from "./fixtures";

/** Capability inventory §7 (grapple/shove), §9 (Ready), §10 (reactions as questions, D5), D9 (knock-out). */
const P2={peerId:"peer.p2",role:"player" as const};
const chips=(runtime:TableRuntime,id:string)=>projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===id)!.status;
const questionsFor=(runtime:TableRuntime,viewer:{role:"dm"|"player";peerId?:string})=>projectTable(runtime.state,viewer).scene.tableQuestions??[];

test("§10 물러남 → opportunity-attack question: answered with an attack, declined, suppressed by 이탈, skipped by the DM", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:2}]});
  const kael="char.kael",gob1=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`;
  dice.push(15,10,8);
  runtime.dispatch({type:"start-initiative"});
  // 1라운드: 카엘 → 고블린 1 빗나감 (교전), 턴 종료 → 고블린 1이 물러난다
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.ok(isEngaged(runtime.state.engagements,kael,gob1));
  runtime.dispatch({type:"end-turn"},P1);
  const withdraw=runtime.dispatch({type:"declare",actorId:gob1,movement:"withdraw"});
  assert.equal(withdraw.status,"committed",JSON.stringify(withdraw));
  assert.deepEqual(engagedWith(runtime.state.engagements,gob1),[],"the withdrawing creature leaves reach");
  assert.equal(runtime.state.questions.length,1);
  const question=runtime.state.questions[0];
  assert.equal(question.kind,"opportunity-attack");
  assert.equal(question.actorId,kael);
  assert.equal(question.toPeer,P1.peerId);
  assert.deepEqual(question.options.map((option)=>option.id),["action.longsword","action.unarmed-strike.damage","decline"],"weapons in hand plus 넘김; the stowed dagger and improvised objects are not offered");
  assert.equal(questionsFor(runtime,{role:"player",peerId:P2.peerId}).length,0,"another player does not see the card");
  assert.equal(questionsFor(runtime,{role:"player",peerId:P1.peerId}).length,1);
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.pendingWithdrawal?.candidates[0]?.actionName,"롱소드","the old boards' withdrawal contract is filled");
  // 남의 질문은 답할 수 없다; 플레이어가 롱소드로 기회공격
  const wrongPeer=runtime.dispatch({type:"answer-question",questionId:question.id,optionId:"action.longsword"},P2);
  assert.equal(wrongPeer.status==="refused"&&wrongPeer.refusal.message,"이 질문은 당신에게 온 것이 아닙니다.");
  dice.push(19,19,1,1);
  const strike=runtime.dispatch({type:"answer-question",questionId:question.id,optionId:"action.longsword"},P1);
  assert.equal(strike.status,"committed",JSON.stringify(strike));
  assert.equal(strike.resolution?.attackOutcome,"명중");
  assert.equal(hp(runtime,gob1),5);
  assert.equal(runtime.state.rules.combatants[kael].economy.reaction,false,"the opportunity attack spent the reaction");
  // (kael's action was spent on his own turn this round; the reaction is the only thing the opportunity attack took)
  assert.equal(runtime.state.questions.length,0);
  assert.ok(!isEngaged(runtime.state.engagements,kael,gob1),"an opportunity attack does not re-engage the creature that left");
  // 반응을 이미 쓴 카엘에게는 다시 묻지 않는다
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,gob2);
  dice.push(1,1,2,2);
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob2].find((action)=>/시미터/.test(action.name))!;
  runtime.dispatch({type:"act",actorId:gob2,actionId:scimitar.id,targetIds:[kael]});
  assert.ok(isEngaged(runtime.state.engagements,kael,gob2));
  assert.equal(runtime.dispatch({type:"declare",actorId:gob2,movement:"withdraw"}).status,"committed");
  assert.equal(runtime.state.questions.length,0,"no reaction left, no card");
  // 2라운드: 카엘 턴 시작에 반응이 돌아온다. 고블린 2를 공격해 교전, 고블린 2가 이탈 후 물러남 → 질문 없음
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,kael);
  assert.equal(runtime.state.rules.combatants[kael].economy.reaction,true);
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob2]},P1);
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,gob2);
  assert.equal(runtime.dispatch({type:"act",actorId:gob2,actionId:"action.standard.disengage",targetIds:[gob2]}).status,"committed");
  assert.equal(runtime.dispatch({type:"declare",actorId:gob2,movement:"withdraw"}).status,"committed");
  assert.equal(runtime.state.questions.length,0,"이탈 suppresses the opportunity attack");
  assert.ok(!isEngaged(runtime.state.engagements,kael,gob2));
  // 3라운드: 교전 후 고블린 1이 물러남 → 거절; 다시 교전 후 물러남 → DM 넘김
  runtime.dispatch({type:"end-turn"});
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"declare",actorId:gob1,movement:"withdraw"});
  assert.equal(runtime.state.questions.length,1);
  const decline=runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"decline"},P1);
  assert.equal(decline.status,"committed");
  assert.equal(runtime.state.questions.length,0);
  assert.equal(runtime.state.rules.combatants[kael].economy.reaction,true,"declining keeps the reaction");
  assert.equal(runtime.state.log[0].title,"기회공격 넘김");
  runtime.dispatch({type:"declare",actorId:gob1,movement:"approach",targetId:kael});
  assert.equal(projectTable(runtime.state,{role:"player"}).scene.entities.find((entity)=>entity.id===gob1)?.movementDeclaration?.kind,"approach");
  const engage=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob1,on:true}});
  assert.equal(engage.status,"committed");
  runtime.dispatch({type:"declare",actorId:gob1,movement:"withdraw"});
  assert.equal(runtime.state.questions.length,1);
  const skipByPlayer=runtime.dispatch({type:"skip-question",questionId:runtime.state.questions[0].id},P1);
  assert.equal(skipByPlayer.status,"refused");
  assert.equal(runtime.dispatch({type:"skip-question",questionId:runtime.state.questions[0].id}).status,"committed");
  assert.equal(runtime.state.questions.length,0);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  const replica=new TableRuntime({sessionId:"table.test"});
  for(const event of runtime.ledger) replica.applyRemote(event);
  assert.deepEqual(projectTable(replica.state,{role:"player",peerId:P1.peerId}),projectTable(runtime.state,{role:"player",peerId:P1.peerId}));
  assert.equal(dice.remaining(),0);
});

test("§7 unarmed strike options: grapple (save, free hand, size), escape, release, shove prone, shove away", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN},{kind:"monster",monsterId:"dnd.srd521.monster.adult-black-dragon"}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`,dragon="dnd.srd521.monster.adult-black-dragon.instance-1";
  const grapple=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[kael].find((action)=>action.id==="action.unarmed-strike.grapple")!;
  assert.equal(grapple.saveDc,15,"8 + PB 3 + STR 4");
  // 고블린 (근력 -1, 민첩 +2): 민첩으로 내성. d20 5 + 2 = 7 실패 → 붙잡힘
  dice.push(5,5);
  const hold=runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[gob]},P1);
  assert.equal(hold.status,"committed",JSON.stringify(hold));
  assert.equal(hold.resolution?.saveResults[0]?.outcome,"실패");
  assert.ok(chips(runtime,gob).includes("✦ 붙잡힘 (카엘)"),JSON.stringify(chips(runtime,gob)));
  assert.ok(isEngaged(runtime.state.engagements,kael,gob),"grappling is melee contact");
  const again=runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[gob]},P1);
  assert.equal(again.status==="refused"&&again.refusal.message,"이미 붙잡고 있는 대상입니다.");
  // 고블린 탈출: 근력/민첩 높은 쪽 (+2) vs DC 15. d20 20 → 성공
  dice.push(20,20);
  const escape=runtime.dispatch({type:"act",actorId:gob,actionId:"action.escape-grapple",targetIds:[]});
  assert.equal(escape.status,"committed",JSON.stringify(escape));
  assert.ok(!chips(runtime,gob).some((chip)=>chip.includes("붙잡힘")));
  const nothing=runtime.dispatch({type:"act",actorId:gob,actionId:"action.escape-grapple",targetIds:[]});
  assert.equal(nothing.status==="refused"&&nothing.refusal.message,"붙잡힌 상태가 아닙니다.");
  // 다시 붙잡고 놓아주기 (비용 없음)
  dice.push(5,5);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[gob]},P1);
  assert.ok(chips(runtime,gob).some((chip)=>chip.includes("붙잡힘")));
  assert.equal(runtime.dispatch({type:"act",actorId:kael,actionId:"action.release-grapple",targetIds:[kael]},P1).status,"committed");
  assert.ok(!chips(runtime,gob).some((chip)=>chip.includes("붙잡힘")));
  // 내성 성공은 아무 효과가 없다
  dice.push(20,20);
  const resisted=runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[gob]},P1);
  assert.equal(resisted.resolution?.saveResults[0]?.outcome,"성공");
  assert.ok(!chips(runtime,gob).some((chip)=>chip.includes("붙잡힘")));
  // 넘어뜨리기 → 넘어짐; 밀어내기 → 교전 해제
  dice.push(5,5);
  assert.equal(runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.shove-prone",targetIds:[gob]},P1).status,"committed");
  assert.ok(chips(runtime,gob).includes("✦ 넘어짐"));
  assert.equal(runtime.dispatch({type:"posture",actorId:gob,posture:"stand"}).status,"committed");
  assert.ok(isEngaged(runtime.state.engagements,kael,gob));
  dice.push(5,5);
  const push=runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.shove-push",targetIds:[gob]},P1);
  assert.equal(push.status,"committed",JSON.stringify(push));
  assert.ok(!isEngaged(runtime.state.engagements,kael,gob),"pushed 5 feet away: out of reach");
  // 빈손이 없으면 붙잡을 수 없다; 두 단계 큰 상대도
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"draw",itemId:"item.dagger",slot:"off-hand"},P1).status,"committed");
  const noHand=runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[gob]},P1);
  assert.equal(noHand.status==="refused"&&noHand.refusal.message,"붙잡으려면 빈손이 하나 필요합니다. 먼저 놓거나 집어넣으세요.");
  runtime.dispatch({type:"object",actorId:kael,op:"stow",itemId:"item.dagger"},P1);
  const tooBig=runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[dragon]},P1);
  assert.equal(tooBig.status==="refused"&&tooBig.refusal.message,"나보다 두 단계 이상 큰 대상은 붙잡거나 밀 수 없습니다.");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("D9 knock-out: a melee attack that drops a creature to 0 HP asks the attacker; 기절 leaves it unconscious and stable", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:2}]});
  const kael="char.kael",gob1=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`;
  dice.push(19,19,5,5);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(hp(runtime,gob1),1);
  dice.push(19,19,1,1);
  const blow=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(blow.status,"committed",JSON.stringify(blow));
  assert.equal(runtime.state.rules.combatants[gob1].life.dead,true);
  assert.equal(runtime.state.questions.length,1);
  assert.equal(runtime.state.questions[0].kind,"knock-out");
  assert.equal(runtime.state.questions[0].toPeer,P1.peerId);
  const spare=runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"knock-out"},P1);
  assert.equal(spare.status,"committed",JSON.stringify(spare));
  const life=runtime.state.rules.combatants[gob1].life;
  assert.equal(life.dead,false);
  assert.equal(life.unconscious,true);
  assert.equal(life.stable,true);
  assert.equal(life.hp.current,0);
  assert.ok(chips(runtime,gob1).includes("안정"));
  // 원거리 공격으로 죽이면 묻지 않는다 (D9: 근접만)
  dice.push(19,19,4,4);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.dagger.throw",targetIds:[gob2]},P1);
  assert.equal(hp(runtime,gob2),2);
  dice.push(19,19,4,4);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.dagger.throw",targetIds:[gob2]},P1);
  assert.equal(runtime.state.rules.combatants[gob2].life.dead,true);
  assert.equal(runtime.state.questions.length,0);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§9 Ready: the action is spent now, the trigger fires it later as a reaction, the readied action ends at the next turn", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  dice.push(15,10);
  runtime.dispatch({type:"start-initiative"});
  const readied=runtime.dispatch({type:"ready",actorId:kael,actionId:"action.longsword",trigger:"고블린이 다가오면",targetIds:[gob]},P1);
  assert.equal(readied.status,"committed",JSON.stringify(readied));
  assert.equal(runtime.state.rules.combatants[kael].economy.action,false,"Ready spends the action");
  assert.equal(runtime.state.readied[kael]?.trigger,"고블린이 다가오면");
  const twice=runtime.dispatch({type:"ready",actorId:kael,actionId:"action.longsword",trigger:"x"},P1);
  assert.equal(twice.status==="refused"&&twice.refusal.message,"행동을 이미 사용했습니다.");
  runtime.dispatch({type:"end-turn"},P1);
  assert.equal(runtime.state.currentActorId,gob);
  // DM: 조건 발생 → 카엘에게 질문 → 발동 (반응)
  const trigger=runtime.dispatch({type:"trigger-ready",actorId:kael});
  assert.equal(trigger.status,"committed",JSON.stringify(trigger));
  assert.equal(runtime.state.questions[0]?.kind,"ready-trigger");
  dice.push(19,19,1,1);
  const fire=runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"fire"},P1);
  assert.equal(fire.status,"committed",JSON.stringify(fire));
  assert.equal(fire.resolution?.attackOutcome,"명중");
  assert.equal(hp(runtime,gob),5);
  assert.equal(runtime.state.rules.combatants[kael].economy.reaction,false);
  assert.equal(runtime.state.readied[kael],undefined,"fired once");
  assert.equal(runtime.state.questions.length,0);
  const gone=runtime.dispatch({type:"trigger-ready",actorId:kael});
  assert.equal(gone.status==="refused"&&gone.refusal.message,"준비한 행동이 없습니다.");
  // 보류하면 준비 상태가 남고, 자기 턴이 오면 사라진다
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,kael);
  runtime.dispatch({type:"ready",actorId:kael,actionId:"action.longsword",trigger:"문이 열리면",targetIds:[gob]},P1);
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"trigger-ready",actorId:kael});
  assert.equal(runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"hold"},P1).status,"committed");
  assert.ok(runtime.state.readied[kael],"held: still readied");
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,kael);
  assert.equal(runtime.state.readied[kael],undefined,"a readied action does not survive into the next turn");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
