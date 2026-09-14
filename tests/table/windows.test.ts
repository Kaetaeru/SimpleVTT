import assert from "node:assert/strict";
import test from "node:test";
import { replayEvents } from "../../src/table/events";
import { displayedAc, projectTable } from "../../src/table/project";
import type { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, cleric, fighter, hp, table } from "./fixtures";

/** RULES_RUNTIME_SPECS.md §2 — reaction windows and the DM attack-intervention palette (D42). */
const P2={peerId:"peer.p2",role:"player" as const};
const SHIELD="spell.dnd.srd521.spell.shield";
const COUNTERSPELL="spell.dnd.srd521.spell.counterspell";
const attackNamed=(runtime:TableRuntime,actorId:string,pattern:RegExp)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>action.resolutionKind==="attack"&&pattern.test(action.name))!;
const slot=(runtime:TableRuntime,id:string,level:number)=>runtime.state.rules.combatants[id].resources.find((entry)=>entry.id===`spell-slot-${level}`)?.current;
const windowQuestion=(runtime:TableRuntime)=>runtime.state.questions.find((question)=>question.kind==="reaction-window");

test("§2 hit-determined: a hit pauses before damage; Shield answers with the same d20 and turns it into a miss; declining lets the damage through", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:{...cleric(),preparedSpells:[...(cleric() as unknown as {preparedSpells:string[]}).preparedSpells,"dnd.srd521.spell.shield"]} as never,controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",sera="char.sera",gob=`${GOBLIN}.instance-1`;
  dice.push(15,10,5);
  runtime.dispatch({type:"start-initiative"});
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"},P2);
  assert.equal(runtime.state.currentActorId,gob);
  const scimitar=attackNamed(runtime,gob,/시미터/);
  dice.push(19,19,3,3);
  const swing=runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[sera]});
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.equal(hp(runtime,sera),24,"nothing committed yet: the hit waits for the window");
  assert.ok(runtime.state.pending,"a pending resolution");
  const ask=windowQuestion(runtime);
  assert.equal(ask?.toPeer,P2.peerId);
  assert.equal(ask?.context.window,"hit-determined");
  assert.ok(ask?.options.some((option)=>option.id===SHIELD),JSON.stringify(ask?.options));
  assert.equal(projectTable(runtime.state,{role:"player",peerId:P1.peerId}).scene.pendingResolution?.actorName,"고블린 전사 1");
  // 의존 명령은 기다리고, 무관한 명령은 진행한다
  const blocked=runtime.dispatch({type:"end-turn"});
  assert.equal(blocked.status==="refused"&&blocked.refusal.code,"pending-resolution");
  assert.equal(runtime.dispatch({type:"narrate",actorId:kael,text:"버텨!"},P1).status,"committed");
  // 방패: 같은 d20 19 + 1 = 20 vs AC 18 + 5 = 23 → 빗나감; 슬롯과 반응 소비
  const shield=runtime.dispatch({type:"answer-question",questionId:ask!.id,optionId:SHIELD},P2);
  assert.equal(shield.status,"committed",JSON.stringify(shield));
  assert.equal(runtime.state.pending,null);
  assert.equal(hp(runtime,sera),24);
  assert.equal(displayedAc(runtime.state,runtime.state.actors[sera]),23);
  assert.equal(slot(runtime,sera,1),3);
  assert.equal(runtime.state.rules.combatants[sera].economy.reaction,false);
  assert.equal(runtime.state.activeResolution?.attackOutcome,"빗나감");
  assert.ok(runtime.state.activeResolution?.provenance.some((line)=>line.startsWith("반응 창:")),JSON.stringify(runtime.state.activeResolution?.provenance));
  assert.equal(windowQuestion(runtime),undefined);
  // 다음 라운드: 방패는 세라의 턴 시작에 끝나고, 넘기면 피해가 들어간다 (1d6 3 − 1 = 2)
  runtime.dispatch({type:"end-turn"});
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"},P2);
  assert.equal(displayedAc(runtime.state,runtime.state.actors[sera]),18);
  dice.push(19,19,3,3);
  assert.equal(runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[sera]}).status,"committed");
  const ask2=windowQuestion(runtime)!;
  assert.equal(runtime.dispatch({type:"answer-question",questionId:ask2.id,optionId:"decline"},P2).status,"committed");
  assert.equal(hp(runtime,sera),22);
  assert.equal(runtime.state.pending,null);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§2 D42: with 공격 보류 on, a player's attack on a DM creature waits for the DM; the palette forces miss, hit, crit, cover, half damage and 닿지 않음 before or after resolution", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  assert.equal(runtime.dispatch({type:"set-setting",settings:{holdAttacks:true}}).status,"committed");
  dice.push(15,10,5);
  runtime.dispatch({type:"start-initiative"});
  dice.push(19,19,5,5);
  const swing=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.equal(hp(runtime,gob),10);
  const ask=windowQuestion(runtime)!;
  assert.equal(ask.context.window,"dm-intervention");
  assert.equal(ask.toPeer,undefined,"the DM answers");
  assert.equal(runtime.dispatch({type:"override",resolutionId:"nope",changes:{}},P1).status,"refused","players have no palette");
  // 사전 개입: 빗나감 강제
  const miss=runtime.dispatch({type:"override",resolutionId:runtime.state.pending!.id,changes:{outcome:"miss"},note:"방패에 막혔다"});
  assert.equal(miss.status,"committed",JSON.stringify(miss));
  assert.equal(runtime.state.pending,null);
  assert.equal(hp(runtime,gob),10);
  const card=runtime.state.activeResolution!;
  assert.equal(card.attackOutcome,"빗나감");
  assert.ok(card.provenance.includes("DM 개입: 빗나감 강제"),JSON.stringify(card.provenance));
  assert.equal(runtime.state.rules.combatants[kael].economy.action,false,"the action is still spent");
  // 사후 재판정: 같은 주사위로 명중 → 5 + 4 = 9
  assert.equal(runtime.dispatch({type:"override",resolutionId:card.id,changes:{outcome:"hit"}}).status,"committed");
  assert.equal(hp(runtime,gob),1);
  assert.equal(runtime.state.activeResolution?.attackOutcome,"명중");
  // 치명타 강제: 뽑아 둔 둘째 피해 눈까지 → 5 + 5 + 4 = 14 → 쓰러짐 → 죽임/기절 질문
  assert.equal(runtime.dispatch({type:"override",resolutionId:card.id,changes:{outcome:"crit"}}).status,"committed");
  assert.equal(hp(runtime,gob),0);
  assert.ok(runtime.state.questions.some((question)=>question.kind==="knock-out"));
  // 엄폐 절반: AC 17, 19 + 7 = 26 → 여전히 명중 9; 질문은 이전 상태로 돌아간다
  assert.equal(runtime.dispatch({type:"override",resolutionId:card.id,changes:{cover:"half"}}).status,"committed");
  assert.equal(hp(runtime,gob),1);
  assert.ok(!runtime.state.questions.some((question)=>question.kind==="knock-out"));
  assert.ok(runtime.state.activeResolution?.provenance.includes("DM 개입(사후): 엄폐 절반 (+2)"));
  // 피해 절반: 9 → 4
  assert.equal(runtime.dispatch({type:"override",resolutionId:card.id,changes:{damage:{mode:"half"}}}).status,"committed");
  assert.equal(hp(runtime,gob),6);
  // 닿지 않음 (D24): 접근으로 재기록되고 공격은 그대로
  assert.equal(runtime.dispatch({type:"override",resolutionId:card.id,changes:{reach:"out"}}).status,"committed");
  assert.equal(runtime.state.declarations[kael]?.kind,"approach");
  assert.equal(hp(runtime,gob),1);
  // 그 뒤에 다른 행동이 있으면 사후 재판정은 막힌다
  runtime.dispatch({type:"end-turn"},P1);
  const stale=runtime.dispatch({type:"override",resolutionId:card.id,changes:{outcome:"miss"}});
  assert.equal(stale.status==="refused"&&stale.refusal.message,"그 뒤에 다른 행동이 있었습니다. 되돌리기로 처리하세요.");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§2 save-failed: a legendary creature's failed save asks the DM; Legendary Resistance turns it into a success and spends the pool (D21)", () => {
  const {runtime,dice}=table([]);
  const ABOLETH="dnd.srd521.monster.aboleth";
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"monster",monsterId:ABOLETH}]});
  const sera="char.sera",aboleth=`${ABOLETH}.instance-1`;
  assert.equal(runtime.state.rules.combatants[aboleth].resources.find((pool)=>pool.id==="legendary-resistance")?.current,3);
  // 신성한 불꽃: 피해 1d8 (6), 아볼렛 민첩 내성 d20 5 + 3 = 8 vs DC 13 → 실패 → DM 질문
  dice.push(6,5,5);
  const cast=runtime.dispatch({type:"act",actorId:sera,actionId:"spell.dnd.srd521.spell.sacred-flame",targetIds:[aboleth]},P2);
  assert.equal(cast.status,"committed",JSON.stringify(cast));
  assert.equal(hp(runtime,aboleth),150);
  const ask=windowQuestion(runtime)!;
  assert.equal(ask.context.window,"save-failed");
  assert.equal(ask.toPeer,undefined);
  assert.equal(runtime.dispatch({type:"answer-question",questionId:ask.id,optionId:"use"}).status,"committed");
  assert.equal(hp(runtime,aboleth),150,"the save became a success: no damage");
  assert.equal(runtime.state.rules.combatants[aboleth].resources.find((pool)=>pool.id==="legendary-resistance")?.current,2);
  assert.equal(runtime.state.activeResolution?.saveResults[0]?.outcome,"성공");
  assert.ok(runtime.state.activeResolution?.provenance.includes("DM 개입: 전설 저항: 내성 성공"),JSON.stringify(runtime.state.activeResolution?.provenance));
  // 두 번째: 그대로 실패 → 6 피해
  dice.push(6,5,5);
  assert.equal(runtime.dispatch({type:"act",actorId:sera,actionId:"spell.dnd.srd521.spell.sacred-flame",targetIds:[aboleth]},P2).status,"committed");
  assert.equal(runtime.dispatch({type:"answer-question",questionId:windowQuestion(runtime)!.id,optionId:"decline"}).status,"committed");
  assert.equal(hp(runtime,aboleth),144);
  assert.equal(runtime.state.pending,null);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§2 spell-being-cast: an enemy caster with Counterspell gets the window; a failed CON save loses the spell but not the slot", () => {
  const {runtime,dice}=table([]);
  const mage={...cleric(),id:"char.mage",name:"적 마법사",level:5,classLevels:[{classId:"dnd.srd521.class.cleric",className:"클레릭",level:5}],preparedSpells:["dnd.srd521.spell.counterspell"]} as never;
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"character",sheet:mage,side:"enemy"}]});
  const kael="char.kael",sera="char.sera",enemy="char.mage";
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"damage",amount:20}});
  assert.equal(hp(runtime,kael),11);
  // 치유의 말 (2d4: 3+2) 선언 → 역마법 창 (DM이 답한다)
  dice.push(3,2);
  const cast=runtime.dispatch({type:"act",actorId:sera,actionId:"spell.dnd.srd521.spell.healing-word",targetIds:[kael]},P2);
  assert.equal(cast.status,"committed",JSON.stringify(cast));
  assert.equal(hp(runtime,kael),11,"held");
  const ask=windowQuestion(runtime)!;
  assert.equal(ask.context.window,"spell-being-cast");
  assert.equal(ask.actorId,enemy);
  assert.ok(ask.options.some((option)=>option.id===COUNTERSPELL),JSON.stringify(ask.options));
  // 역마법: 세라 건강 내성 d20 5 + 2 = 7 vs DC 14 → 실패 → 주문 무산, 세라 1레벨 슬롯 소비
  dice.push(5,5);
  const counter=runtime.dispatch({type:"answer-question",questionId:ask.id,optionId:COUNTERSPELL});
  assert.equal(counter.status,"committed",JSON.stringify(counter));
  assert.equal(hp(runtime,kael),11,"the healing never happened");
  assert.equal(slot(runtime,sera,1),3,"the slot is still spent (2024)");
  assert.equal(slot(runtime,enemy,3),1);
  assert.equal(runtime.state.pending,null);
  assert.ok(runtime.state.activeResolution?.compact.includes("역마법으로 무산"),runtime.state.activeResolution?.compact);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
