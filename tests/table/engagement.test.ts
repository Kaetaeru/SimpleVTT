import assert from "node:assert/strict";
import test from "node:test";
import { engagedWith, isEngaged } from "../../src/domain/engagement";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { BUGBEAR_STALKER, GOBLIN, P1, fighter, hp, table } from "./fixtures";

/**
 * P0b — engagement without positions on the V2 table (docs/design/theater-of-mind-play.md, src/domain/engagement.ts).
 * A melee attack engages the pair whether it hits or misses; ranged attacks never engage; 이탈, death, leaving the
 * table and a round without melee end it; the DM toggle and undo keep one record set that every replica shares.
 */

const partners=(runtime:TableRuntime,id:string)=>engagedWith(runtime.state.engagements,id);
const attackNamed=(runtime:TableRuntime,actorId:string,pattern:RegExp)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>action.resolutionKind==="attack"&&pattern.test(action.name))!;

test("P0b: a melee attack engages the pair on a miss as well as a hit; reach 10 is melee; a ranged attack does not engage and takes disadvantage in melee", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:2},{kind:"monster",monsterId:BUGBEAR_STALKER}]});
  const kael="char.kael",gob1=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`,bugbear=`${BUGBEAR_STALKER}.instance-1`;
  assert.deepEqual(runtime.state.engagements,[],"the table starts with no engagement");
  // 자유 진행 · 카엘 롱소드 → 고블린 1: 자연 1 빗나감 — 그래도 교전이 생긴다
  dice.push(1,1,3,3);
  const miss=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(miss.status,"committed",JSON.stringify(miss));
  assert.equal(miss.resolution?.attackOutcome,"빗나감");
  assert.equal(hp(runtime,gob1),10);
  assert.ok(isEngaged(runtime.state.engagements,kael,gob1),"a melee miss engages the pair");
  assert.deepEqual(runtime.state.engagements.map((record)=>[record.a,record.b,record.sinceRound,record.lastMeleeRound]),[[kael,gob1,1,1]],"freeform play records round 1");
  assert.ok(miss.resolution?.stateChanges.includes("교전 시작: 카엘 ↔ 고블린 전사 1"),JSON.stringify(miss.resolution?.stateChanges));
  // 옛 화면이 읽는 투영: scene.engagements와 engagedWithIds, 플레이어 화면에도 보인다
  const view=projectTable(runtime.state,{role:"player",peerId:P1.peerId});
  assert.deepEqual(view.scene.engagements,runtime.state.engagements);
  assert.deepEqual(view.scene.entities.find((entity)=>entity.id===kael)?.engagedWithIds,[gob1]);
  assert.deepEqual(view.scene.entities.find((entity)=>entity.id===gob1)?.engagedWithIds,[kael]);
  assert.equal(view.scene.entities.find((entity)=>entity.id===gob2)?.engagedWithIds,undefined,"an unengaged creature projects no list");
  // 같은 짝의 명중은 교전을 유지한다 (기록은 하나) — d20 19 (+7 = 26 vs AC 15), 1d8 → 1 (+4 = 5)
  dice.push(19,19,1,1);
  const hit=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(hit.status,"committed",JSON.stringify(hit));
  assert.equal(hit.resolution?.attackOutcome,"명중");
  assert.equal(hp(runtime,gob1),5);
  assert.ok(hit.resolution?.stateChanges.includes("교전 유지: 카엘 ↔ 고블린 전사 1"),JSON.stringify(hit.resolution?.stateChanges));
  assert.equal(runtime.state.engagements.length,1);
  // 고블린 2 단궁 → 카엘: 원거리 공격은 교전을 만들지 않는다
  const shortbow2=attackNamed(runtime,gob2,/단궁/);
  assert.equal(shortbow2.runtimeAttack?.attackMode,"ranged","the catalog's attack mode travels with the action");
  dice.push(20,20,4,4);
  const arrow=runtime.dispatch({type:"act",actorId:gob2,actionId:shortbow2.id,targetIds:[kael]});
  assert.equal(arrow.status,"committed",JSON.stringify(arrow));
  assert.equal(arrow.resolution?.naturalD20,20,"an unengaged archer rolls normally");
  assert.deepEqual(partners(runtime,gob2),[],"a ranged attack does not engage");
  // 교전 중인 고블린 1의 단궁 → 카엘: 근접 상태의 원거리 공격은 불리
  const shortbow1=attackNamed(runtime,gob1,/단궁/);
  dice.push(18,4,3,3);
  const pointBlank=runtime.dispatch({type:"act",actorId:gob1,actionId:shortbow1.id,targetIds:[kael]});
  assert.equal(pointBlank.status,"committed",JSON.stringify(pointBlank));
  assert.equal(pointBlank.resolution?.naturalD20,4,"ranged in melee keeps the lower face");
  assert.ok(pointBlank.resolution?.provenance.some((line)=>/engagement:ranged-in-melee/.test(line)),JSON.stringify(pointBlank.resolution?.provenance));
  // 버그베어 던지는 창 (근접 10피트) → 카엘: 자연 1 빗나감이어도 교전
  const javelin=attackNamed(runtime,bugbear,/창/);
  assert.equal(javelin.runtimeAttack?.rangeFeet,10);
  assert.equal(javelin.runtimeAttack?.attackMode,"melee-or-ranged");
  dice.push(1,1,1,1,1,1,1,1);
  const reach=runtime.dispatch({type:"act",actorId:bugbear,actionId:javelin.id,targetIds:[kael]});
  assert.equal(reach.status,"committed",JSON.stringify(reach));
  assert.equal(reach.resolution?.attackOutcome,"빗나감");
  assert.ok(isEngaged(runtime.state.engagements,bugbear,kael),"a reach-10 melee attack engages");
  assert.deepEqual(partners(runtime,kael).sort(),[bugbear,gob1].sort());
  // 카엘 이탈: 카엘의 모든 교전이 끝난다
  const disengage=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.disengage",targetIds:[kael]},P1);
  assert.equal(disengage.status,"committed",JSON.stringify(disengage));
  assert.deepEqual(partners(runtime,kael),[]);
  assert.deepEqual(runtime.state.engagements,[]);
  assert.ok(disengage.resolution?.stateChanges.some((line)=>line.startsWith("교전 종료 (이탈): 카엘 ↔ ")),JSON.stringify(disengage.resolution?.stateChanges));
  // 리플레이 = 상태, 복제본 = 호스트
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  const replica=new TableRuntime({sessionId:"table.test"});
  for(const event of runtime.ledger) replica.applyRemote(event);
  assert.deepEqual(replica.state.engagements,runtime.state.engagements);
  assert.deepEqual(projectTable(replica.state,{role:"player",peerId:P1.peerId}),projectTable(runtime.state,{role:"player",peerId:P1.peerId}));
  assert.equal(dice.remaining(),0);
});

test("P0b: death, leaving the table, the DM toggle and undo keep one consistent record set", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:3}]});
  const kael="char.kael",gob1=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`,gob3=`${GOBLIN}.instance-3`;
  // 명중 (5 피해) → 교전, 두 번째 명중으로 사망 → 교전 종료
  dice.push(19,19,1,1);
  const first=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(first.status,"committed",JSON.stringify(first));
  assert.equal(hp(runtime,gob1),5);
  assert.ok(isEngaged(runtime.state.engagements,kael,gob1));
  dice.push(19,19,1,1);
  const kill=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(kill.status,"committed",JSON.stringify(kill));
  assert.equal(runtime.state.rules.combatants[gob1].life.dead,true);
  assert.deepEqual(runtime.state.engagements,[],"a dead creature is engaged with no one");
  // DM 토글: 교전 지정 / 중복 거부 / 해제 / 중복 거부
  assert.equal(runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob2,on:true}}).status,"committed");
  assert.deepEqual(runtime.state.engagements.map((record)=>[record.a,record.b,record.sinceRound]),[[kael,gob2,1]]);
  assert.deepEqual(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===gob2)?.engagedWithIds,[kael]);
  const again=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob2,on:true}});
  assert.equal(again.status==="refused"&&again.refusal.message,"이미 교전 중입니다.");
  assert.equal(runtime.dispatch({type:"ruling",targetIds:[gob2],ruling:{kind:"engage",otherId:kael,on:false}}).status,"committed","the toggle is symmetric");
  assert.deepEqual(runtime.state.engagements,[]);
  const notEngaged=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob2,on:false}});
  assert.equal(notEngaged.status==="refused"&&notEngaged.refusal.message,"교전 중이 아닙니다.");
  // 되돌리기는 교전 기록도 되돌린다
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob2,on:true}});
  assert.equal(runtime.state.engagements.length,1);
  assert.equal(runtime.dispatch({type:"undo"}).status,"committed");
  assert.deepEqual(runtime.state.engagements,[]);
  // 테이블에서 제거된 크리처의 교전은 사라진다
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob2,on:true}});
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob3,on:true}});
  assert.equal(runtime.state.engagements.length,2);
  assert.equal(runtime.dispatch({type:"remove-actor",actorId:gob2}).status,"committed");
  assert.deepEqual(runtime.state.engagements.map((record)=>[record.a,record.b]),[[kael,gob3]]);
  // DM 사망 처리도 교전을 끝낸다
  assert.equal(runtime.dispatch({type:"ruling",targetIds:[gob3],ruling:{kind:"life",state:"dead"}}).status,"committed");
  assert.deepEqual(runtime.state.engagements,[]);
  // DM 피해 재량으로 죽어도 교전은 끝난다 (커널 경로)
  runtime.dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:GOBLIN}]});
  const gob4=`${GOBLIN}.instance-4`;
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:gob4,on:true}});
  assert.equal(runtime.state.engagements.length,1);
  assert.equal(runtime.dispatch({type:"ruling",targetIds:[gob4],ruling:{kind:"damage",amount:10}}).status,"committed");
  assert.equal(runtime.state.rules.combatants[gob4].life.dead,true);
  assert.deepEqual(runtime.state.engagements,[],"a killing ruling releases the engagement");
  // 자기 자신과는 교전할 수 없다
  const self=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"engage",otherId:kael,on:true}});
  assert.equal(self.status,"refused");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("P0b: a full round without melee between the pair ends the engagement at the next round start; melee in between keeps it", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:2}]});
  const kael="char.kael",gob1=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`;
  dice.push(15,10,8);
  assert.equal(runtime.dispatch({type:"start-initiative"}).status,"committed");
  assert.deepEqual(runtime.state.order,[kael,gob1,gob2]);
  // 1라운드: 카엘 → 고블린 1 빗나감 (교전 시작, lastMeleeRound 1)
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.deepEqual(runtime.state.engagements.map((record)=>[record.a,record.b,record.lastMeleeRound]),[[kael,gob1,1]]);
  const round=()=>runtime.state.round;
  const passRound=()=>{ for(let i=0;i<3;i+=1) assert.equal(runtime.dispatch({type:"end-turn"}).status,"committed"); };
  passRound();
  assert.equal(round(),2);
  assert.equal(runtime.state.engagements.length,1,"round 2 start: round-1 melee still counts");
  // 2라운드: 근접 공격 없음 → 3라운드 시작에 교전이 끝난다
  passRound();
  assert.equal(round(),3);
  assert.deepEqual(runtime.state.engagements,[],"round 3 start: the pair idled through round 2");
  assert.ok(runtime.state.log.some((entry)=>entry.title==="교전 종료 · 한 라운드 동안 근접 공격 없음"&&entry.summary==="카엘 ↔ 고블린 전사 1"),JSON.stringify(runtime.state.log.slice(0,3)));
  // 3라운드: 고블린 1 시미터 → 카엘 (교전 재개), 4라운드에 카엘이 다시 공격 → 5라운드 시작에도 유지
  assert.equal(runtime.dispatch({type:"end-turn"}).status,"committed");
  assert.equal(runtime.state.currentActorId,gob1);
  const scimitar=attackNamed(runtime,gob1,/시미터/);
  dice.push(1,1,2,2);
  const swing=runtime.dispatch({type:"act",actorId:gob1,actionId:scimitar.id,targetIds:[kael]});
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.deepEqual(runtime.state.engagements.map((record)=>[record.a,record.b,record.sinceRound,record.lastMeleeRound]),[[kael,gob1,3,3]]);
  assert.equal(runtime.dispatch({type:"end-turn"}).status,"committed");
  assert.equal(runtime.dispatch({type:"end-turn"}).status,"committed");
  assert.equal(round(),4);
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(runtime.state.engagements[0].lastMeleeRound,4);
  passRound();
  assert.equal(round(),5);
  assert.equal(runtime.state.engagements.length,1,"melee in round 4 carries the pair into round 5");
  // 이니셔티브 종료: 교전은 남고 라운드 기준은 자유 진행의 1라운드로 정규화된다
  assert.equal(runtime.dispatch({type:"end-initiative"}).status,"committed");
  assert.deepEqual(runtime.state.engagements.map((record)=>[record.a,record.b,record.sinceRound,record.lastMeleeRound]),[[kael,gob1,1,1]]);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
