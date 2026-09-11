import assert from "node:assert/strict";
import test from "node:test";
import { engagedWith } from "../../src/domain/engagement";
import { replayEvents } from "../../src/table/events";
import { handsLabel } from "../../src/table/hands";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, fighter, hp, table } from "./fixtures";

/**
 * Capability inventory §5 (posture) and §6 (hands and objects): lying down mid-fight, drawing, stowing, dropping,
 * picking up, handing over, throwing a weapon, improvising a weapon — and attacking an ally without a confirmation (D7).
 */

const P2={peerId:"peer.p2",role:"player" as const};
const sheetOf=(runtime:TableRuntime,id:string)=>{const actor=runtime.state.actors[id]; return actor.source.kind==="character"?actor.source.sheet:null;};
const itemOf=(runtime:TableRuntime,actorId:string,itemId:string)=>sheetOf(runtime,actorId)?.items.find((item)=>item.id===itemId);
const tile=(runtime:TableRuntime,actorId:string,actionId:string)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>action.id===actionId);
const chips=(runtime:TableRuntime,id:string)=>projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===id)!.status;

test("§5 posture: dropping prone is free at any time, standing costs half speed in Initiative; prone changes the rolls", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  // 자유 진행: 엎드리기 → 넘어짐, 자기 공격은 불리, 자신을 향한 근접 공격은 유리
  const down=runtime.dispatch({type:"posture",actorId:kael,posture:"prone"},P1);
  assert.equal(down.status,"committed",JSON.stringify(down));
  assert.ok(chips(runtime,kael).includes("✦ 넘어짐"));
  assert.equal(runtime.dispatch({type:"posture",actorId:kael,posture:"prone"},P1).status,"refused","already prone");
  dice.push(18,4,3,3);
  const swing=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.equal(swing.resolution?.naturalD20,4,"a prone attacker rolls with disadvantage");
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob].find((action)=>/시미터/.test(action.name))!;
  dice.push(3,17,2,2);
  const stab=runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[kael]});
  assert.equal(stab.status,"committed",JSON.stringify(stab));
  assert.equal(stab.resolution?.naturalD20,17,"a melee attack against a prone target has advantage");
  // 자유 진행에서 일어나기는 비용 없음
  const up=runtime.dispatch({type:"posture",actorId:kael,posture:"stand"},P1);
  assert.equal(up.status,"committed",JSON.stringify(up));
  assert.ok(!chips(runtime,kael).includes("✦ 넘어짐"));
  assert.equal(runtime.dispatch({type:"posture",actorId:kael,posture:"stand"},P1).status,"refused","not prone");
  // 이니셔티브: 일어나기는 이동력 절반(15피트), 두 번째는 0이 남아 거부
  dice.push(15,10);
  assert.equal(runtime.dispatch({type:"start-initiative"}).status,"committed");
  assert.equal(runtime.state.currentActorId,kael);
  assert.equal(runtime.dispatch({type:"posture",actorId:kael,posture:"prone"},P1).status,"committed");
  const stand=runtime.dispatch({type:"posture",actorId:kael,posture:"stand"},P1);
  assert.equal(stand.status,"committed",JSON.stringify(stand));
  assert.equal(runtime.state.rules.combatants[kael].economy.movement,15);
  assert.equal(runtime.dispatch({type:"posture",actorId:kael,posture:"prone"},P1).status,"committed");
  assert.equal(runtime.dispatch({type:"posture",actorId:kael,posture:"stand"},P1).status,"committed");
  assert.equal(runtime.state.rules.combatants[kael].economy.movement,0);
  assert.equal(runtime.dispatch({type:"posture",actorId:kael,posture:"prone"},P1).status,"committed");
  const stuck=runtime.dispatch({type:"posture",actorId:kael,posture:"stand"},P1);
  assert.equal(stuck.status==="refused"&&stuck.refusal.message,"일어나려면 이동력 15피트가 필요합니다. 남은 이동력: 0피트.");
  // 남의 캐릭터는 못 눕힌다; DM은 누구든
  assert.equal(runtime.dispatch({type:"posture",actorId:gob,posture:"prone"},P1).status,"refused");
  assert.equal(runtime.dispatch({type:"posture",actorId:gob,posture:"prone"}).status,"committed");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§6 hands and objects: draw, stow, drop to the floor, pick up, hand over; the weapon tile follows the hand", () => {
  const {runtime}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:{...fighter(),id:"char.sera",name:"세라"},controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",sera="char.sera",gob=`${GOBLIN}.instance-1`;
  assert.equal(projectTable(runtime.state,{role:"player"}).scene.entities.find((entity)=>entity.id===kael)?.hands,"롱소드 (주손)");
  // 롱소드를 바닥에 놓으면 손이 비고 롱소드 타일은 쓸 수 없다
  const drop=runtime.dispatch({type:"object",actorId:kael,op:"drop",itemId:"item.longsword"},P1);
  assert.equal(drop.status,"committed",JSON.stringify(drop));
  assert.equal(itemOf(runtime,kael,"item.longsword"),undefined);
  assert.equal(runtime.state.floor.length,1);
  assert.equal(runtime.state.floor[0].item.name,"롱소드");
  assert.equal(handsLabel(sheetOf(runtime,kael)!),"빈손");
  assert.deepEqual(projectTable(runtime.state,{role:"player"}).scene.floorItems?.map((entry)=>[entry.name,entry.droppedByName,entry.recoverable]),[["롱소드","카엘",true]]);
  assert.equal(tile(runtime,kael,"action.longsword")?.available,false);
  assert.equal(tile(runtime,kael,"action.longsword")?.disabledReason,"무기가 가방에 없습니다.");
  const swingWithout=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(swingWithout.status==="refused"&&swingWithout.refusal.message,"무기가 가방에 없습니다.");
  // 단검을 꺼내면(주손) 단검 타일이 열린다; 두 번째 단검은 보조손; 세 번째 물건은 손이 없다
  assert.equal(tile(runtime,kael,"action.dagger")?.disabledReason,"무기를 들고 있지 않습니다. 먼저 꺼내세요.");
  const draw=runtime.dispatch({type:"object",actorId:kael,op:"draw",itemId:"item.dagger"},P1);
  assert.equal(draw.status,"committed",JSON.stringify(draw));
  assert.equal(itemOf(runtime,kael,"item.dagger")?.wieldSlot,"main-hand");
  assert.equal(tile(runtime,kael,"action.dagger")?.available,true);
  // 세라가 롱소드를 줍는다 (다른 캐릭터의 물건도 바닥에서 주울 수 있다)
  const pick=runtime.dispatch({type:"object",actorId:sera,op:"pick-up",itemId:runtime.state.floor[0].id},P2);
  assert.equal(pick.status,"committed",JSON.stringify(pick));
  assert.equal(runtime.state.floor.length,0);
  assert.equal(sheetOf(runtime,sera)!.items.filter((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword").length,2,"sera now carries two longswords (her own and kael's)");
  // 세라가 물약 하나를 카엘에게 건넨다: 세라 1개, 카엘 3개(같은 종류는 합쳐진다)
  const give=runtime.dispatch({type:"object",actorId:sera,op:"give",itemId:"item.potion",targetId:kael},P2);
  assert.equal(give.status,"committed",JSON.stringify(give));
  assert.equal(itemOf(runtime,sera,"item.potion")?.quantity,1);
  assert.equal(itemOf(runtime,kael,"item.potion")?.quantity,3);
  // 상대편에게는 건넬 수 없다 (DM 판정), 몬스터는 가방이 없다
  const toGoblin=runtime.dispatch({type:"object",actorId:kael,op:"give",itemId:"item.potion",targetId:gob},P1);
  assert.equal(toGoblin.status==="refused"&&toGoblin.refusal.message,"캐릭터에게만 건넬 수 있습니다. 몬스터·물체는 DM 재량으로 처리하세요.");
  const goblinDraw=runtime.dispatch({type:"object",actorId:gob,op:"draw",itemId:"x"});
  assert.equal(goblinDraw.status==="refused"&&goblinDraw.refusal.message,"이 액터에게는 가방이 없습니다. DM 재량으로 처리하세요.");
  // 집어넣기; 다시 꺼내되 보조손 지정
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"stow",itemId:"item.dagger"},P1).status,"committed");
  assert.equal(itemOf(runtime,kael,"item.dagger")?.wielded,false);
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"draw",itemId:"item.dagger",slot:"off-hand"},P1).status,"committed");
  assert.equal(projectTable(runtime.state,{role:"player"}).scene.entities.find((entity)=>entity.id===kael)?.hands,"단검 (보조손)");
  // 되돌리기는 가방과 바닥을 함께 되돌린다
  assert.equal(runtime.dispatch({type:"undo"}).status,"committed");
  assert.equal(itemOf(runtime,kael,"item.dagger")?.wielded,false);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  const replica=new TableRuntime({sessionId:"table.test"});
  for(const event of runtime.ledger) replica.applyRemote(event);
  assert.deepEqual(projectTable(replica.state,{role:"player",peerId:P1.peerId}),projectTable(runtime.state,{role:"player",peerId:P1.peerId}));
});

test("§6 in Initiative: one free object interaction per turn, the second costs the Utilize action", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  dice.push(15,10);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"draw",itemId:"item.dagger"},P1).status,"committed","first interaction is free");
  assert.equal(runtime.state.rules.combatants[kael].economy.action,true);
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"stow",itemId:"item.dagger"},P1).status,"committed","second interaction spends the action");
  assert.equal(runtime.state.rules.combatants[kael].economy.action,false);
  const third=runtime.dispatch({type:"object",actorId:kael,op:"draw",itemId:"item.dagger"},P1);
  assert.equal(third.status==="refused"&&third.refusal.message,"이번 턴의 자유 상호작용을 이미 사용했고, 두 번째 상호작용에 필요한 행동도 남아 있지 않습니다.");
  const attack=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(attack.status==="refused"&&attack.refusal.message,"행동을 이미 사용했습니다.");
  // 놓기는 언제나 무료
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"drop",itemId:"item.potion"},P1).status,"committed");
  assert.equal(runtime.state.floor[0].item.quantity,1,"a consumable drops one at a time");
  // 다음 턴에 카운트가 초기화된다
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,kael);
  assert.deepEqual(runtime.state.interactions,{});
  assert.equal(runtime.dispatch({type:"object",actorId:kael,op:"draw",itemId:"item.dagger"},P1).status,"committed");
  assert.equal(runtime.state.rules.combatants[kael].economy.action,true);
  assert.equal(dice.remaining(),0);
});

test("§7 throwing: a thrown weapon flies as a ranged attack and lands on the floor; an improvised object is 1d4; allies are legal targets", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:{...fighter(),id:"char.sera",name:"세라"},controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN,count:2}]});
  const kael="char.kael",sera="char.sera",gob=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`;
  const throwTile=tile(runtime,kael,"action.dagger.throw")!;
  assert.equal(throwTile.name,"단검 던지기");
  assert.equal(throwTile.runtimeAttack?.attackMode,"ranged");
  assert.equal(throwTile.runtimeAttack?.rangeFeet,20);
  assert.equal(tile(runtime,kael,"action.dagger")?.runtimeAttack?.attackMode,"melee-or-ranged");
  assert.equal(tile(runtime,kael,"action.longsword.throw"),undefined,"a longsword has no thrown property");
  // 던지기는 꺼내는 동작을 포함한다 (손에 없어도 던질 수 있다): 19 (+7 = 26 vs AC 15) 명중, 1d4 → 3 (+4 = 7)
  dice.push(19,19,3,3);
  const fling=runtime.dispatch({type:"act",actorId:kael,actionId:"action.dagger.throw",targetIds:[gob]},P1);
  assert.equal(fling.status,"committed",JSON.stringify(fling));
  assert.equal(fling.resolution?.attackOutcome,"명중");
  assert.equal(hp(runtime,gob),3);
  assert.equal(itemOf(runtime,kael,"item.dagger")?.quantity,1,"one dagger of the stack flew");
  assert.deepEqual(runtime.state.floor.map((entry)=>[entry.item.name,entry.item.quantity,entry.recoverable]),[["단검",1,true]]);
  assert.deepEqual(engagedWith(runtime.state.engagements,kael),[],"a thrown weapon does not engage");
  assert.ok(fling.resolution?.stateChanges.includes("단검 → 바닥 (회수 가능)"),JSON.stringify(fling.resolution?.stateChanges));
  // 두 번째 단검을 던지면 가방에서 사라지고 그 타일은 닫힌다
  dice.push(1,1,1,1);
  assert.equal(runtime.dispatch({type:"act",actorId:kael,actionId:"action.dagger.throw",targetIds:[gob]},P1).status,"committed");
  assert.equal(itemOf(runtime,kael,"item.dagger"),undefined);
  assert.equal(runtime.state.floor.length,2);
  assert.equal(tile(runtime,kael,"action.dagger.throw")?.disabledReason,"무기가 가방에 없습니다.");
  // 즉흥 무기 던지기: 손에 든 롱소드를 던진다 → 1d4 + 근력, 롱소드는 바닥으로
  const improvised=tile(runtime,kael,"action.improvised.throw")!;
  assert.equal(improvised.attackBonus,4,"no proficiency on an improvised weapon");
  dice.push(19,19,2,2);
  const chair=runtime.dispatch({type:"act",actorId:kael,actionId:"action.improvised.throw",targetIds:[gob],itemId:"item.longsword"},P1);
  assert.equal(chair.status,"committed",JSON.stringify(chair));
  assert.equal(chair.resolution?.damageComponents[0]?.adjusted,6,"1d4 (2) + 4");
  assert.equal(runtime.state.rules.combatants[gob].life.dead,true,"6 damage on 3 HP");
  assert.equal(itemOf(runtime,kael,"item.longsword"),undefined);
  assert.equal(runtime.state.floor.at(-1)?.item.name,"롱소드");
  assert.equal(handsLabel(sheetOf(runtime,kael)!),"빈손");
  // 즉흥 무기 (근접) — 아무 물건이나: 아이템 없이도 굴린다
  dice.push(19,19,4,4);
  const bottle=runtime.dispatch({type:"act",actorId:kael,actionId:"action.improvised.melee",targetIds:[gob2]},P1);
  assert.equal(bottle.status,"committed",JSON.stringify(bottle));
  assert.equal(hp(runtime,gob2),2,"1d4 (4) + 4 on 10 HP");
  assert.equal(runtime.state.floor.length,3,"nothing new on the floor");
  // 아군 공격: 확인 없이 진행된다 (D7); 자기 자신은 안 된다
  assert.ok(tile(runtime,sera,"action.longsword")?.eligibleTargetIds.includes(kael));
  dice.push(19,19,1,1);
  const friendly=runtime.dispatch({type:"act",actorId:sera,actionId:"action.longsword",targetIds:[kael]},P2);
  assert.equal(friendly.status,"committed",JSON.stringify(friendly));
  assert.equal(hp(runtime,kael),31-5);
  assert.ok(engagedWith(runtime.state.engagements,sera).includes(kael),"a friendly melee attack still engages");
  const selfSwing=runtime.dispatch({type:"act",actorId:sera,actionId:"action.longsword",targetIds:[sera]},P2);
  assert.equal(selfSwing.status==="refused"&&selfSwing.refusal.message,"자기 자신을 대상으로 할 수 없습니다.");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
