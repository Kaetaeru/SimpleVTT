import assert from "node:assert/strict";
import test from "node:test";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { redactStateFor } from "../../src/table/redact";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, cleric, fighter, table } from "./fixtures";

/** DM_WORKSPACE.md §3 자료 · §4 토큰 드롭: an image to everyone or to one player; the 기록 tab reopens result cards. */
const P2={peerId:"peer.p2",role:"player" as const};
const PNG=`data:image/png;base64,${Buffer.from("map").toString("base64")}`;

test("handout: to everyone, then to one peer only; the other peer's wire never carries it; clear takes it down", () => {
  const {runtime}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId}]});
  assert.equal(runtime.dispatch({type:"handout",image:{name:"지도",dataUrl:"not-an-image"}}).status,"refused");
  const shown=runtime.dispatch({type:"handout",image:{name:"종탑 지도",dataUrl:PNG}});
  assert.equal(shown.status,"committed",JSON.stringify(shown));
  const view=(viewer:{role:"dm"|"player";peerId?:string})=>projectTable(viewer.role==="dm"?runtime.state:redactStateFor(runtime.state,viewer),viewer).scene.handout;
  assert.equal(view({role:"dm"})?.name,"종탑 지도");
  assert.equal(view(P1)?.name,"종탑 지도"); assert.equal(view(P2)?.name,"종탑 지도");
  const secret=runtime.dispatch({type:"handout",image:{name:"카엘의 편지",dataUrl:PNG},toPeer:P1.peerId});
  assert.equal(secret.status,"committed",JSON.stringify(secret));
  assert.equal(view(P1)?.name,"카엘의 편지","the addressed peer sees it");
  assert.equal(view(P2),undefined,"the other peer sees nothing");
  assert.equal(JSON.stringify(redactStateFor(runtime.state,P2)).includes("카엘의 편지"),false,"and its wire never carries it");
  assert.equal(runtime.state.log[0].title,"자료 → 카엘");
  assert.equal(projectTable(runtime.state,P2).activity.some((entry)=>entry.title==="자료 → 카엘"),false,"nor the log line");
  assert.equal(runtime.dispatch({type:"handout"}).status,"committed");
  assert.equal(view({role:"dm"}),undefined);
  assert.equal(runtime.dispatch({type:"handout"}).status,"refused");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
});

test("recent cards: the last result cards stay reopenable by id; players get only the public ones", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  dice.push(15,15,3,3);
  const first=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  runtime.dispatch({type:"set-roll-visibility",visibility:"dm"});
  dice.push(2,2,3,3);
  const second=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(first.status,"committed"); assert.equal(second.status,"committed");
  const dm=projectTable(runtime.state,{role:"dm"}).scene.recentCards??[];
  assert.deepEqual(dm.map((card)=>card.id),[second.resolution!.id,first.resolution!.id],"newest first");
  const player=projectTable(redactStateFor(runtime.state,P1),P1).scene.recentCards??[];
  assert.deepEqual(player.map((card)=>card.id),[first.resolution!.id],"the DM-only card is not reopenable by a player");
  assert.equal(projectTable(runtime.state,{role:"dm"}).activity.find((entry)=>entry.resolutionId===first.resolution!.id)?.title,first.resolution!.finalOutcome);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
