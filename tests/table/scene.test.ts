import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { TableClient } from "../../src/table/client";
import { queuedDice } from "../../src/table/dice";
import { replayEvents } from "../../src/table/events";
import { TableHost } from "../../src/table/host";
import { MemoryTableStore, stateFromSnapshot } from "../../src/table/persistence";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { MemoryTransportHub } from "../../src/table/transport";
import { GOBLIN, P1, cleric, fighter, hp, table } from "./fixtures";

/** RULES_RUNTIME_SPECS.md §4 — scenes, the bench, objects and summons, awards, whispers, saving and resuming, write-back. */
const P2={peerId:"peer.p2",role:"player" as const};

test("§4 scene: a scene change ends hiding and engagements but not conditions; benched actors keep everything and skip their turns", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",sera="char.sera",gob=`${GOBLIN}.instance-1`;
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  dice.push(15,15);
  runtime.dispatch({type:"act",actorId:sera,actionId:"action.standard.hide",targetIds:[]},P2);
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"condition",conditionId:"poisoned",on:true,duration:{kind:"hours",amount:1}}});
  assert.equal(runtime.state.engagements.length,1);
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===sera&&effect.conditionId==="invisible"));
  const scene=runtime.dispatch({type:"scene",name:"지하 성소",conditions:["어둠","안개"]});
  assert.equal(scene.status,"committed",JSON.stringify(scene));
  assert.equal(runtime.state.scene.name,"지하 성소");
  assert.deepEqual(projectTable(runtime.state,{role:"dm"}).scene.sceneReminders,["어둠","안개"]);
  assert.equal(runtime.state.engagements.length,0,"engagements belong to the scene");
  assert.ok(!runtime.state.rules.effects.some((effect)=>effect.targetId===sera&&effect.conditionId==="invisible"),"hiding belongs to the scene");
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&effect.conditionId==="poisoned"),"a condition follows the creature");
  // 대기석: 세라가 자리를 비운다 — HP·상태는 그대로, 순서에서 빠진다
  runtime.dispatch({type:"ruling",targetIds:[sera],ruling:{kind:"damage",amount:10}});
  dice.push(15,10,5);
  runtime.dispatch({type:"start-initiative"});
  assert.deepEqual(runtime.state.order,[kael,sera,gob]);
  const benched=runtime.dispatch({type:"bench",actorId:sera,present:false});
  assert.equal(benched.status,"committed",JSON.stringify(benched));
  assert.deepEqual(runtime.state.order,[kael,gob]);
  assert.equal(hp(runtime,sera),14,"kept whole");
  assert.ok(!projectTable(runtime.state,{role:"player",peerId:P1.peerId}).scene.entities.some((entity)=>entity.id===sera),"out of the scene for players");
  assert.deepEqual(projectTable(runtime.state,{role:"dm"}).scene.benched,[{id:sera,name:"세라"}]);
  runtime.dispatch({type:"end-turn"},P1);
  assert.equal(runtime.state.currentActorId,gob,"the benched actor's turn is skipped");
  assert.equal(runtime.dispatch({type:"bench",actorId:sera,present:true}).status,"committed");
  assert.deepEqual(runtime.state.order,[kael,gob,sera]);
  assert.equal(runtime.state.actors[sera].present,undefined);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§4 objects and summons: a door has AC and HP by material and size, fails saves and ignores poison; a summon acts after its owner and leaves when concentration ends", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"object",name:"나무 문",material:"wood",size:"medium"}]});
  const kael="char.kael",sera="char.sera";
  const door=Object.keys(runtime.state.actors).find((id)=>id.startsWith("object."))!;
  assert.equal(runtime.state.actors[door].kind,"object");
  assert.equal(runtime.state.actors[door].side,"neutral");
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===door)?.ac,15);
  assert.equal(hp(runtime,door),11);
  dice.push(15,15,5,5);
  const chop=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[door]},P1);
  assert.equal(chop.status,"committed",JSON.stringify(chop));
  assert.equal(hp(runtime,door),2,"15 + 7 vs AC 15 · 5 + 4 = 9");
  runtime.dispatch({type:"ruling",targetIds:[door],ruling:{kind:"damage",amount:10,damageType:"poison"}});
  assert.equal(hp(runtime,door),2,"objects are immune to poison");
  assert.equal(runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.grapple",targetIds:[door]},P1).status,"refused","an object cannot be grappled");
  // 소환: 세라가 집중 주문을 켠 채 고블린 정령을 부른다 — 주인 직후에 행동, 집중이 끊기면 사라진다
  dice.push(15,10);
  runtime.dispatch({type:"start-initiative"});
  assert.deepEqual(runtime.state.order,[kael,sera],"an object takes no turn");
  runtime.dispatch({type:"end-turn"},P1);
  assert.equal(runtime.dispatch({type:"act",actorId:sera,actionId:"spell.dnd.srd521.spell.bless",targetIds:[sera,kael]},P2).status,"committed");
  assert.ok(runtime.state.rules.concentration[sera]);
  const summoned=runtime.dispatch({type:"add-actors",specs:[{kind:"summon",monsterId:GOBLIN,ownerId:sera,name:"부름받은 정령",expiresWith:{concentration:true}}]});
  assert.equal(summoned.status,"committed",JSON.stringify(summoned));
  const spirit=Object.keys(runtime.state.actors).find((id)=>id.includes(".summon"))!;
  assert.equal(runtime.state.actors[spirit].kind,"summon");
  assert.equal(runtime.state.actors[spirit].side,"ally");
  assert.equal(runtime.state.actors[spirit].controllerPeer,P2.peerId,"the owner's player controls it");
  assert.equal(runtime.state.order.indexOf(spirit),runtime.state.order.indexOf(sera)+1,"acts right after its owner");
  runtime.dispatch({type:"ruling",targetIds:[sera],ruling:{kind:"damage",amount:30}});
  assert.equal(runtime.state.actors[spirit],undefined,"concentration ended with the owner's HP: the summon is gone");
  assert.ok(runtime.state.log.some((entry)=>entry.title==="소환 종료"));
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§4 awards and whispers: XP lands on the owner's sheet; a whisper reaches its two peers and the DM only", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId}]});
  const kael="char.kael",sera="char.sera";
  const award=runtime.dispatch({type:"award",actorIds:[kael,sera],xp:150,note:"고블린 소굴"});
  assert.equal(award.status,"committed",JSON.stringify(award));
  const kaelSheet=runtime.state.actors[kael].source.kind==="character"?runtime.state.actors[kael].source.sheet:undefined;
  assert.equal(kaelSheet?.xp,150);
  assert.equal(runtime.dispatch({type:"award",actorIds:[kael],milestone:true}).status,"committed");
  assert.equal(runtime.dispatch({type:"award",actorIds:[kael]}).status,"refused");
  const whisper=runtime.dispatch({type:"narrate",actorId:sera,text:"저 상인은 거짓말을 하고 있어",toPeer:P1.peerId},P2);
  assert.equal(whisper.status,"committed",JSON.stringify(whisper));
  const entry=runtime.state.log[0];
  assert.equal(entry.title,"귓속말 → 카엘");
  assert.equal(projectTable(runtime.state,{role:"player",peerId:P1.peerId}).activity[0]?.title,"귓속말 → 카엘");
  assert.equal(projectTable(runtime.state,{role:"player",peerId:P2.peerId}).activity[0]?.title,"귓속말 → 카엘");
  assert.equal(projectTable(runtime.state,{role:"player",peerId:"peer.p3"}).activity.some((line)=>line.title.startsWith("귓속말")),false);
  assert.equal(projectTable(runtime.state,{role:"dm"}).activity[0]?.title,"귓속말 → 카엘");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§4 saving and resuming: the Host stores a snapshot, a new Host resumes it, a player reconnecting under a new peer id can still answer its card, and HP changes reach the owner's sheet", async () => {
  const hub=new MemoryTransportHub();
  const dice=queuedDice([]);
  const store=new MemoryTableStore();
  const runtime=new TableRuntime({sessionId:"table.saved",dice,now:()=>"T"});
  const host=new TableHost(runtime,hub.host,{retention:100,store,saveEvery:3});
  const written:CharacterSheet[]=[];
  const p1=new TableClient(hub.client("peer.p1"),{participantId:"p1",name:"P1",sheet:fighter(),onDurableSheet:(sheet)=>{written.push(sheet);}});
  p1.hello();
  host.dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:GOBLIN}]});
  const gob=`${GOBLIN}.instance-1`;
  dice.push(15,5);
  host.dispatch({type:"start-initiative"});
  dice.push(1,1,2,2);
  await p1.send({type:"act",actorId:"char.kael",actionId:"action.longsword",targetIds:[gob]});
  await p1.send({type:"end-turn"});
  // 고블린이 카엘을 때린다 (HP 31 → 29): 소유자 시트에 HP가 돌아간다
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob].find((action)=>/시미터/.test(action.name))!;
  dice.push(19,19,3,3);
  host.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:["char.kael"]});
  assert.equal(runtime.state.rules.combatants["char.kael"].life.hp.current,29);
  assert.equal(written.at(-1)?.hp,29,"the owner's client wrote the new HP back");
  // 저장: 3개 이벤트마다 — 지금까지 저장된 개정이 있다
  assert.ok(store.saved.get("table.saved"),"a snapshot was stored");
  await host.save();
  assert.equal(store.saved.get("table.saved")?.state.revision,runtime.state.revision);
  // 고블린 턴: 카엘의 물러남에 기회공격 질문 → 카엘이 다른 피어 id로 재접속해도 답할 수 있다
  host.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,"char.kael");
  await p1.send({type:"declare",actorId:"char.kael",movement:"withdraw"});
  assert.equal(runtime.state.questions.length,1,"the goblin's opportunity attack card (DM answers it)");
  await host.save();
  // 새 호스트가 저장본에서 재개한다
  const hub2=new MemoryTransportHub();
  const runtime2=new TableRuntime({sessionId:"table.saved",dice,now:()=>"T"});
  runtime2.restore(stateFromSnapshot(store.load("table.saved")!));
  const host2=new TableHost(runtime2,hub2.host,{retention:100});
  assert.equal(runtime2.state.revision,runtime.state.revision);
  assert.equal(runtime2.state.currentActorId,"char.kael");
  const p1b=new TableClient(hub2.client("peer.p1b"),{participantId:"p1",name:"P1",sheet:fighter()});
  p1b.hello();
  assert.equal(runtime2.state.actors["char.kael"].controllerPeer,"peer.p1b","the reconnecting participant takes over its character");
  // 고블린의 기회공격 카드는 DM이 답한다; 카엘의 카드(죽임/기절 등)는 새 피어가 답한다 — 여기서는 DM 카드를 넘긴다
  host2.dispatch({type:"skip-question",questionId:runtime2.state.questions[0].id});
  assert.equal(runtime2.state.questions.length,0);
  // 새 피어에게 온 질문: 세라 없이 카엘이 대상이 되는 카드를 만들기 위해 고블린이 카엘을 쓰러뜨리진 않고, 준비 발동 질문을 쓴다
  await p1b.send({type:"ready",actorId:"char.kael",actionId:"action.longsword",trigger:"고블린이 다가오면",targetIds:[gob]});
  host2.dispatch({type:"trigger-ready",actorId:"char.kael"});
  const card=runtime2.state.questions.find((question)=>question.kind==="ready-trigger")!;
  assert.equal(projectTable(runtime2.state,{role:"player",peerId:"peer.p1b"}).scene.tableQuestions?.[0]?.id,card.id,"the card is addressed to the new peer id");
  const reply=await p1b.send({type:"answer-question",questionId:card.id,optionId:"hold"});
  assert.equal(reply.status,"committed",JSON.stringify(reply));
  assert.equal(runtime2.state.questions.length,0);
  host.close(); host2.close();
});
