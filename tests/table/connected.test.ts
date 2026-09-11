import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { TableClient } from "../../src/table/client";
import { queuedDice } from "../../src/table/dice";
import { TableHost } from "../../src/table/host";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { MemoryTransportHub } from "../../src/table/transport";
import { GOBLIN, cleric, fighter } from "./fixtures";

/**
 * Capability inventory §3 and §19 (P0c/P0d): Host authority over the wire — join with a sheet, commands answered once,
 * every peer's replica equals the Host's view for that peer, hidden actors and DM-only rolls never reach a player,
 * reconnect by cursor or snapshot, the owner's durable write-back and its acknowledgement.
 */
function session() {
  const hub=new MemoryTransportHub();
  const dice=queuedDice([]);
  const runtime=new TableRuntime({sessionId:"table.connected",dice,now:()=>"T"});
  const host=new TableHost(runtime,hub.host,{retention:100});
  const written:Record<string,CharacterSheet[]>={p1:[],p2:[]};
  const p1=new TableClient(hub.client("peer.p1"),{participantId:"p1",name:"P1",sheet:fighter(),onDurableSheet:(sheet)=>{written.p1.push(sheet);}});
  const p2=new TableClient(hub.client("peer.p2"),{participantId:"p2",name:"P2",sheet:cleric(),onDurableSheet:(sheet)=>{written.p2.push(sheet);}});
  p1.hello(); p2.hello();
  return {hub,dice,runtime,host,p1,p2,written};
}
const view=(state:TableRuntime["state"],peerId:string)=>projectTable(state,{role:"player",peerId});
const parity=(host:TableHost,client:TableClient)=>assert.deepEqual(view(client.state,client.peerId!),view(host.runtime.state,client.peerId!));

test("§3 joining with a sheet puts the character on the table under its owner; commands are answered once; replicas match the Host", async () => {
  const {dice,host,p1,p2}=session();
  assert.equal(host.peers.size,2);
  assert.equal(host.runtime.state.actors["char.kael"]?.controllerPeer,"peer.p1");
  assert.equal(host.runtime.state.actors["char.sera"]?.controllerPeer,"peer.p2");
  assert.equal(p1.peerId,"peer.p1");
  parity(host,p1); parity(host,p2);
  // DM adds goblins; every replica sees them
  host.dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:GOBLIN,count:2}]});
  parity(host,p1); parity(host,p2);
  const gob1=`${GOBLIN}.instance-1`;
  // P1 attacks: the command runs once on the Host; the reply says committed; both replicas converge
  dice.push(19,19,5,5);
  const reply=await p1.send({type:"act",actorId:"char.kael",actionId:"action.longsword",targetIds:[gob1]});
  assert.equal(reply.status,"committed");
  assert.equal(host.runtime.state.rules.combatants[gob1].life.hp.current,1);
  parity(host,p1); parity(host,p2);
  assert.equal(p2.state.log[0].title,"롱소드 → 고블린 전사 1 · 명중");
  // A player cannot act for another's character: the refusal comes back to the sender only
  const notMine=await p1.send({type:"act",actorId:"char.sera",actionId:"action.mace",targetIds:[gob1]});
  assert.equal(notMine.status==="refused"&&notMine.refusal.message,"자기 캐릭터만 조작할 수 있습니다.");
  assert.equal(p1.lastRefusal?.message,"자기 캐릭터만 조작할 수 있습니다.");
  assert.equal(p2.lastRefusal,null);
  // The same command id sent twice commits once
  dice.push(19,19,1,1);
  const first=await p1.sendWithId("p1:dup",{type:"act",actorId:"char.kael",actionId:"action.longsword",targetIds:[gob1]});
  const again=await p1.sendWithId("p1:dup",{type:"act",actorId:"char.kael",actionId:"action.longsword",targetIds:[gob1]});
  assert.equal(first.status,"committed");
  assert.equal(again.status,"committed");
  assert.equal(first.cursor,again.cursor,"the duplicate was answered from memory");
  assert.equal(host.runtime.state.rules.combatants[gob1].life.dead,true);
  assert.equal(host.runtime.state.questions.length,1,"the knock-out question was asked once");
  assert.equal(dice.remaining(),0);
  parity(host,p1); parity(host,p2);
});

test("§19 privacy: a hidden actor and a DM-only roll never reach a player's payload; a reveal arrives whole; questions go to their peer", async () => {
  const {hub,dice,host,p1,p2}=session();
  host.dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:GOBLIN}]});
  const gob=`${GOBLIN}.instance-1`;
  // 숨은 고블린: 플레이어 payload 어디에도 없다
  host.dispatch({type:"set-actor",actorId:gob,patch:{hidden:true}});
  assert.equal(p1.state.actors[gob],undefined);
  assert.equal(p1.state.rules.combatants[gob],undefined);
  host.dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:GOBLIN,name:"매복 고블린"}]});
  const hiddenId=`${GOBLIN}.instance-2`;
  host.dispatch({type:"set-actor",actorId:hiddenId,patch:{hidden:true}});
  assert.equal(p1.state.actors[hiddenId],undefined);
  const wire=hub.dropped.length; // nothing dropped so far
  assert.equal(wire,0);
  // DM 전용 굴림: 카드와 기록이 플레이어에게 가지 않는다; HP 변화는 간다
  host.dispatch({type:"set-roll-visibility",visibility:"dm"});
  dice.push(19,19,4,4);
  const scimitar=projectTable(host.runtime.state,{role:"dm"}).scene.actionsByActor[gob].find((action)=>/시미터/.test(action.name))!;
  host.dispatch({type:"set-actor",actorId:gob,patch:{hidden:false}});
  assert.ok(p1.state.actors[gob],"revealed: the player learns of the goblin whole");
  assert.ok(p1.state.rules.combatants[gob]);
  host.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:["char.kael"]});
  assert.equal(host.runtime.state.rules.combatants["char.kael"].life.hp.current,28);
  assert.equal(p1.state.rules.combatants["char.kael"].life.hp.current,28,"the state change reaches the player");
  assert.equal(p1.state.activeResolution,null,"the DM-only card does not");
  assert.ok(!p1.state.log.some((entry)=>/시미터/.test(entry.title)),"nor the log line");
  assert.ok(host.runtime.state.log.some((entry)=>/시미터/.test(entry.title)));
  assert.ok(!JSON.stringify(p1.state).includes(hiddenId),"the still-hidden goblin is absent from the whole replica");
  parity(host,p1); parity(host,p2);
  // 질문은 그 플레이어에게만: 세라가 고블린과 교전 후 고블린이 물러남 → 세라(P2)에게 카드
  host.dispatch({type:"set-roll-visibility",visibility:"public"});
  dice.push(1,1,2,2);
  const mace=await p2.send({type:"act",actorId:"char.sera",actionId:"action.mace",targetIds:[gob]});
  assert.equal(mace.status,"committed");
  host.dispatch({type:"declare",actorId:gob,movement:"withdraw"});
  assert.equal(host.runtime.state.questions.length,2,"kael (engaged by the goblin's earlier attack) and sera each get a card");
  assert.equal(p2.state.questions.length,1,"P2 holds only its own card");
  assert.equal(p1.state.questions.length,1,"P1 holds only its own card");
  assert.notEqual(p1.state.questions[0].id,p2.state.questions[0].id);
  dice.push(19,19,3,3);
  const swing=await p2.send({type:"answer-question",questionId:p2.state.questions[0].id,optionId:"action.mace"});
  assert.equal(swing.status,"committed");
  assert.equal(host.runtime.state.questions.length,1);
  host.dispatch({type:"skip-question",questionId:host.runtime.state.questions[0].id});
  assert.equal(host.runtime.state.questions.length,0);
  assert.equal(p1.state.questions.length,0);
  parity(host,p1); parity(host,p2);
  assert.equal(dice.remaining(),0);
});

test("§19 reconnect: missed events arrive by cursor, an old cursor gets a snapshot, pending commands are re-sent safely", async () => {
  const {hub,dice,host,p1,p2}=session();
  host.dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:GOBLIN,count:2}]});
  const gob1=`${GOBLIN}.instance-1`;
  // P2 drops; the table moves on
  hub.disconnect("peer.p2");
  assert.equal(host.peers.get("peer.p2")?.connected,false);
  dice.push(19,19,5,5);
  await p1.send({type:"act",actorId:"char.kael",actionId:"action.longsword",targetIds:[gob1]});
  host.dispatch({type:"ruling",targetIds:["char.sera"],ruling:{kind:"damage",amount:3}});
  assert.notEqual(p2.state.revision,host.runtime.state.revision,"the absent peer missed the events");
  // Reconnect with the cursor: the replica catches up event by event
  hub.reconnect("peer.p2");
  p2.hello();
  assert.equal(p2.state.revision,host.runtime.state.revision);
  assert.equal(p2.state.rules.combatants["char.sera"].life.hp.current,21);
  parity(host,p1); parity(host,p2);
  // A command sent while offline is re-sent after the reconnect and commits once
  hub.disconnect("peer.p2");
  const offline=p2.send({type:"act",actorId:"char.sera",actionId:"action.mace",targetIds:[gob1]});
  hub.reconnect("peer.p2");
  p2.hello();
  dice.push(19,19,4,4);
  p2.resendPending();
  const reply=await offline;
  assert.equal(reply.status,"committed");
  assert.equal(host.runtime.state.rules.combatants[gob1].life.hp.current,1-6<0?0:1-6);
  parity(host,p1); parity(host,p2);
  // An old cursor beyond retention gets a snapshot
  const small=new MemoryTransportHub();
  const smallHost=new TableHost(new TableRuntime({sessionId:"t",dice:queuedDice([]),now:()=>"T"}),small.host,{retention:2});
  const late=new TableClient(small.client("peer.late"),{participantId:"late",name:"Late",sheet:fighter()});
  late.hello();
  small.disconnect("peer.late");
  for(let index=0;index<5;index+=1) smallHost.dispatch({type:"narrate",text:`장면 ${index}`});
  small.reconnect("peer.late");
  late.hello();
  assert.equal(late.state.revision,smallHost.runtime.state.revision,"a snapshot brings the late replica to the head");
  assert.deepEqual(view(late.state,"peer.late"),view(smallHost.runtime.state,"peer.late"));
  assert.equal(dice.remaining(),0);
});

test("§19 owner write-back: durable sheet changes of a player's character reach the owner's persistence hook and are acknowledged", async () => {
  const {dice,host,p1,p2,written}=session();
  dice.push(2,3);
  const drink=await p1.send({type:"act",actorId:"char.kael",actionId:"item.item.potion.drink",targetIds:["char.kael"]});
  assert.equal(drink.status,"committed");
  assert.equal(written.p1.length,1,"the owner wrote the sheet back once");
  assert.equal(written.p1[0].items.find((item)=>item.id==="item.potion")?.quantity,1);
  assert.equal(written.p2.length,0,"another player's client does not write kael's sheet");
  assert.equal(host.peers.get("peer.p1")?.ackedCursor,host.runtime.state.revision,"the Host recorded the acknowledgement");
  // A DM-approved item fix is durable too
  await p1.send({type:"request",actorId:"char.kael",kind:"item-fix",text:"화살 산 것",payload:{itemId:"item.dagger",quantity:4}});
  host.dispatch({type:"answer-question",questionId:host.runtime.state.questions[0].id,optionId:"approve"});
  assert.equal(written.p1.length,2);
  assert.equal(written.p1[1].items.find((item)=>item.id==="item.dagger")?.quantity,4);
  parity(host,p1); parity(host,p2);
  assert.equal(dice.remaining(),0);
});
