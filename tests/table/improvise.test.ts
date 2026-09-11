import assert from "node:assert/strict";
import test from "node:test";
import { isEngaged } from "../../src/domain/engagement";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState, type RulingSpec } from "../../src/table/state";
import { GOBLIN, P1, fighter, hp, table } from "./fixtures";

/** Capability inventory §12-§13 and decisions D4/D8/D10: the improvised-action protocol and player requests. */
const P2={peerId:"peer.p2",role:"player" as const};
const chips=(runtime:TableRuntime,id:string)=>projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===id)!.status;
const suggestionOf=(runtime:TableRuntime)=>{const question=runtime.state.questions[0]; return {name:String(question.context.suggestionName),spec:JSON.parse(String(question.context.suggestion)) as RulingSpec};};

test("§13 throw a grappled enemy: the declaration is recorded, the DM gets a card with a suggestion, edits the damage (D8) and rules", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:2}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`;
  dice.push(5,5);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[gob]},P1);
  assert.ok(isEngaged(runtime.state.engagements,kael,gob));
  const declared=runtime.dispatch({type:"improvise",actorId:kael,text:"붙잡은 고블린을 다른 고블린에게 집어던진다",targetIds:[gob]},P1);
  assert.equal(declared.status,"committed",JSON.stringify(declared));
  assert.equal(runtime.state.log[0].title,"즉흥 행동 선언","recorded at once (grade N) while the DM decides");
  assert.equal(runtime.state.questions.length,1);
  assert.equal(runtime.state.questions[0].kind,"ruling-request");
  assert.equal((projectTable(runtime.state,{role:"player",peerId:P1.peerId}).scene.tableQuestions??[]).length,0,"the card is the DM's");
  assert.equal((projectTable(runtime.state,{role:"dm"}).scene.tableQuestions??[]).length,1);
  const suggestion=suggestionOf(runtime);
  assert.equal(suggestion.name,"붙잡은 대상 던지기");
  assert.deepEqual(suggestion.spec.check,{kind:"check",ability:"str",skill:"운동",dc:10});
  // 플레이어는 판정 카드를 낼 수 없다
  const byPlayer=runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec:suggestion.spec},P1);
  assert.equal(byPlayer.status,"refused");
  // DM: 제안대로 하되 피해를 2d6으로 올린다. 운동 판정 d20 15 + 7 = 22 vs DC 10 성공; 2d6 → 4 + 2
  const edited:RulingSpec={...suggestion.spec,success:{...suggestion.spec.success,damage:{dice:"2d6",type:"타격",targetIds:[gob]}}};
  dice.push(15,15,4,2,6,6);
  const ruled=runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec:edited,note:"벽에 부딪힌다"});
  assert.equal(ruled.status,"committed",JSON.stringify(ruled));
  assert.equal(hp(runtime,gob),4,"10 - (4 + 2)");
  assert.ok(chips(runtime,gob).includes("✦ 넘어짐"));
  assert.ok(!isEngaged(runtime.state.engagements,kael,gob),"thrown away: out of reach");
  assert.equal(runtime.state.questions.length,0);
  assert.equal(ruled.resolution?.compact,"붙잡은 고블린을 다른 고블린에게 집어던진다 → 대상이 던져져 넘어진다");
  assert.ok(ruled.resolution?.detail.some((line)=>/카엘 d20 15 \+7 = 22 vs DC 10 성공/.test(line)),JSON.stringify(ruled.resolution?.detail));
  assert.ok(ruled.resolution?.provenance.includes("ruling:dm"));
  assert.equal(runtime.state.log[0].ruling,"DM 판정");
  // 되돌리기는 판정 전체(피해·넘어짐·교전)를 되돌린다
  assert.equal(runtime.dispatch({type:"undo"}).status,"committed");
  assert.equal(hp(runtime,gob),10);
  assert.ok(isEngaged(runtime.state.engagements,kael,gob));
  assert.equal(runtime.state.questions.length,1,"the card is back too");
  // 그냥 성공 (굴림 없음): 서술만 있는 결과
  const verdict=runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec:{cost:"none",verdict:"success",success:{text:"고블린이 날아가 다른 고블린 위에 떨어진다",conditions:[{conditionId:"prone",targetIds:[gob,gob2]}]}}});
  assert.equal(verdict.status,"committed",JSON.stringify(verdict));
  assert.ok(chips(runtime,gob2).includes("✦ 넘어짐"));
  assert.equal(verdict.resolution?.rollKind,"effect");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§13 cost and exception (D4): a ruling that needs a spent action is refused unless the DM records the exception", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  dice.push(15,10);
  runtime.dispatch({type:"start-initiative"});
  dice.push(19,19,1,1);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(runtime.state.rules.combatants[kael].economy.action,false,"the Attack action is spent by its first attack");
  runtime.dispatch({type:"improvise",actorId:kael,text:"탁자를 걷어차 고블린 쪽으로 넘어뜨린다",targetIds:[gob]},P1);
  const spec:RulingSpec={check:{kind:"save",ability:"dex",dc:13},cost:"action",failure:{text:"탁자에 깔린다",conditions:[{conditionId:"prone"}]},success:{text:"피한다"}};
  const refusedRule=runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec});
  assert.equal(refusedRule.status==="refused"&&refusedRule.refusal.message,"행동을 이미 사용했습니다. 예외를 허용하려면 사유를 적으세요.");
  dice.push(3,3);
  const excepted=runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec:{...spec,exception:"멋진 묘사라 이번 한 번 추가 행동 없이 허용"}});
  assert.equal(excepted.status,"committed",JSON.stringify(excepted));
  assert.ok(excepted.resolution?.detail.some((line)=>line.startsWith("DM 예외: 멋진 묘사")),JSON.stringify(excepted.resolution?.detail));
  assert.ok(chips(runtime,gob).includes("✦ 넘어짐"),"the goblin failed its DEX save (3 + 2 vs 13)");
  assert.equal(dice.remaining(),0);
});

test("§13 contest and disarm; save suggestions; narration; house rules take precedence", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:{...fighter(),id:"char.sera",name:"세라"},controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",sera="char.sera",gob=`${GOBLIN}.instance-1`;
  // 무기 뺏기: 대립 판정 (운동 vs 운동). 카엘 19+7 = 26, 세라 5+7 = 12 → 세라의 롱소드가 바닥으로
  runtime.dispatch({type:"improvise",actorId:kael,text:"세라의 무기를 뺏는다",targetIds:[sera]},P1);
  assert.equal(suggestionOf(runtime).name,"무기 뺏기");
  dice.push(19,19,5,5);
  const disarm=runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec:suggestionOf(runtime).spec});
  assert.equal(disarm.status,"committed",JSON.stringify(disarm));
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===sera)?.hands,"빈손");
  assert.deepEqual(runtime.state.floor.map((entry)=>[entry.item.name,entry.droppedBy]),[["롱소드",sera]]);
  assert.ok(disarm.resolution?.detail.some((line)=>/카엘 26 vs 세라 12 → 성공/.test(line)),JSON.stringify(disarm.resolution?.detail));
  // 모래 뿌리기: 내성 제안 → 고블린 실명 1라운드
  runtime.dispatch({type:"improvise",actorId:kael,text:"모래를 고블린 눈에 뿌린다",targetIds:[gob]},P1);
  assert.equal(suggestionOf(runtime).name,"눈 가리기");
  dice.push(2,2);
  assert.equal(runtime.dispatch({type:"rule",questionId:runtime.state.questions[0].id,actorId:kael,spec:suggestionOf(runtime).spec}).status,"committed");
  assert.ok(chips(runtime,gob).includes("✦ 실명"),JSON.stringify(chips(runtime,gob)));
  // 서술: 상태를 바꾸지 않고 기록만; 남의 캐릭터로는 말할 수 없다
  const speak=runtime.dispatch({type:"narrate",actorId:kael,text:'"항복해라, 고블린!"'},P1);
  assert.equal(speak.status,"committed");
  assert.equal(runtime.state.log[0].title,"서술");
  assert.equal(runtime.dispatch({type:"narrate",actorId:sera,text:"x"},P1).status,"refused");
  assert.equal(runtime.dispatch({type:"narrate",text:"바람이 분다"}).status,"committed","the DM narrates without an actor");
  // 즉석 규칙: "던지" 키워드 → 다음 선언은 그 규칙을 먼저 제안한다
  const house:RulingSpec={check:{kind:"check",ability:"str",skill:"운동",dc:12},cost:"action",success:{text:"우리 테이블 규칙대로 던진다",damage:{dice:"1d8",type:"타격"}},failure:{text:"실패"}};
  assert.equal(runtime.dispatch({type:"remember-ruling",name:"던지기",keyword:"던",spec:house}).status,"committed");
  runtime.dispatch({type:"improvise",actorId:kael,text:"고블린을 던진다",targetIds:[gob]},P1);
  assert.equal(suggestionOf(runtime).name,"즉석 규칙 · 던지기");
  assert.equal(suggestionOf(runtime).spec.check&&"dc" in suggestionOf(runtime).spec.check!?(suggestionOf(runtime).spec.check as {dc:number}).dc:0,12);
  runtime.dispatch({type:"skip-question",questionId:runtime.state.questions[0].id});
  const ruleId=Object.keys(runtime.state.houseRules)[0];
  assert.equal(runtime.dispatch({type:"forget-ruling",ruleId}).status,"committed");
  runtime.dispatch({type:"improvise",actorId:kael,text:"고블린을 던진다",targetIds:[gob]},P1);
  assert.equal(suggestionOf(runtime).name,"물건 던져 맞히기","without a grapple the built-in table applies");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("D10 player requests: an item fix needs the DM's approval; an approved undo request undoes as the DM", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  const ask=runtime.dispatch({type:"request",actorId:kael,kind:"item-fix",text:"물약을 세 개 더 샀는데 시트에 안 넣었어요",payload:{itemId:"item.potion",quantity:5}},P1);
  assert.equal(ask.status,"committed",JSON.stringify(ask));
  assert.equal(runtime.state.questions[0]?.kind,"player-request");
  const denied=runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"deny"});
  assert.equal(denied.status,"committed");
  assert.equal(runtime.state.log[0].title,"요청 거절");
  runtime.dispatch({type:"request",actorId:kael,kind:"item-fix",text:"물약 다섯 개",payload:{itemId:"item.potion",quantity:5}},P1);
  const wrongPeer=runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"approve"},P1);
  assert.equal(wrongPeer.status,"refused","only the DM approves");
  const approved=runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"approve"});
  assert.equal(approved.status,"committed",JSON.stringify(approved));
  const sheet=runtime.state.actors[kael].source.kind==="character"?runtime.state.actors[kael].source.sheet:null;
  assert.equal(sheet?.items.find((item)=>item.id==="item.potion")?.quantity,5);
  assert.equal(runtime.state.log[0].title,"DM 재량 · 아이템·자원 정정");
  // 자원 정정: 세컨드 윈드 0 → 1
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"resource",resourceId:"resource.second-wind",delta:-1}});
  runtime.dispatch({type:"request",actorId:kael,kind:"item-fix",text:"세컨드 윈드는 아직 안 썼어요",payload:{resourceId:"resource.second-wind",current:1}},P1);
  assert.equal(runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"approve"}).status,"committed");
  assert.equal(runtime.state.rules.combatants[kael].resources[0].current,1);
  // 되돌리기 요청: 승인하면 DM의 되돌리기로 이어진다
  dice.push(19,19,5,5);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(hp(runtime,gob),1);
  runtime.dispatch({type:"request",actorId:kael,kind:"undo",text:"실수로 눌렀어요"},P1);
  const undone=runtime.dispatch({type:"answer-question",questionId:runtime.state.questions[0].id,optionId:"approve"});
  assert.equal(undone.status,"committed",JSON.stringify(undone));
  assert.equal(hp(runtime,gob),10,"the approved request undid the attack");
  assert.equal(runtime.state.questions.length,0);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
