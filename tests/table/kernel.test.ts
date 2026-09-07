import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { queuedDice } from "../../src/table/dice";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";

const GOBLIN="dnd.srd521.monster.goblin-warrior"; // HP 10 · AC 15 · 시미터 +1, 1d6-1 참격
const P1={peerId:"peer.p1",role:"player" as const};

function fighter():CharacterSheet {
  return {
    id:"char.kael",name:"카엘",className:"전사",subclassName:"챔피언",level:5,classLevels:[{classId:"dnd.srd521.class.fighter",className:"전사",level:5}],species:"인간",background:"군인",
    hp:31,maxHp:42,tempHp:0,ac:18,speed:30,proficiencyBonus:3,saveState:"saved",
    abilities:{str:18,dex:14,con:16,int:10,wis:12,cha:8},saves:["근력 +7","건강 +6"],skills:["운동 +7"],features:["추가 공격"],equipment:[],items:[],
    resources:[{id:"resource.second-wind",label:"세컨드 윈드",current:1,max:1,source:"전사 1레벨"}],
    attacks:[{id:"action.longsword",name:"롱소드",bonus:7,damage:"1d8 + 4 참격"}],
  } as unknown as CharacterSheet;
}

function table(queue:number[]) {
  const dice=queuedDice(queue);
  const runtime=new TableRuntime({sessionId:"table.test",dice,now:()=>"T"});
  return {runtime,dice};
}

const hp=(runtime:TableRuntime,id:string)=>runtime.state.rules.combatants[id].life.hp.current;
const actionOf=(runtime:TableRuntime,actorId:string,actionId:string,viewer:{role:"dm"|"player"}={role:"dm"})=>projectTable(runtime.state,viewer).scene.actionsByActor[actorId]?.find((action)=>action.id===actionId);

test("T2-01: a fight on the table runtime — add actors, initiative, attacks, economy, refusals, rulings, undo, replay parity", () => {
  const {runtime,dice}=table([]);
  // 액터 추가
  const added=runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:2}]});
  assert.equal(added.status,"committed");
  const ids=Object.keys(runtime.state.actors);
  assert.deepEqual(ids,["char.kael",`${GOBLIN}.instance-1`,`${GOBLIN}.instance-2`]);
  const [kael,gob1,gob2]=ids;
  assert.equal(runtime.state.actors[gob1].name,"고블린 전사 1");
  assert.equal(hp(runtime,gob1),10);
  // 이니셔티브: 카엘 d20 15 (+2) = 17, 고블린들 10, 8
  dice.push(15,10,8);
  const started=runtime.dispatch({type:"start-initiative"});
  assert.equal(started.status,"committed",JSON.stringify(started));
  assert.deepEqual(runtime.state.order,[kael,gob1,gob2]);
  assert.equal(runtime.state.currentActorId,kael);
  assert.equal(runtime.state.round,1);
  assert.equal(runtime.state.actors[kael].initiative,17);
  // 자기 자신을 상대 전용 행동의 대상으로 — 거부
  const selfTarget=runtime.dispatch({type:"act",actorId:kael,actionId:"action.unarmed-strike.damage",targetIds:[kael]});
  assert.equal(selfTarget.status==="refused"&&selfTarget.refusal.message,"자기 자신을 대상으로 할 수 없습니다.");
  // 카엘 롱소드 → 고블린 1: d20 18 (+7 = 25 vs AC 15 명중), 1d8 → 5 (+4 = 9)
  dice.push(18,3,5,1);
  const swing=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.equal(swing.resolution?.attackOutcome,"명중");
  assert.equal(swing.resolution?.attackTotal,25);
  assert.equal(swing.resolution?.targetAc,15);
  assert.equal(swing.resolution?.damageComponents[0]?.adjusted,9);
  assert.equal(hp(runtime,gob1),1);
  assert.ok(swing.resolution?.stateChanges.includes("고블린 전사 1 HP 10 → 1"),JSON.stringify(swing.resolution?.stateChanges));
  assert.deepEqual(runtime.state.actors[kael].engagement,[gob1],"a melee hit engages the pair");
  assert.equal(runtime.state.log[0].title,swing.resolution?.finalOutcome);
  // 추가 공격: 5레벨 전사는 공격 행동으로 두 번 — 행동은 썼지만 두 번째 공격은 가능
  assert.equal(runtime.state.rules.combatants[kael].economy.action,false);
  assert.equal(actionOf(runtime,kael,"action.longsword")?.available,true,"the second attack of the Attack action reads available");
  assert.equal(actionOf(runtime,kael,"action.dash")?.available,false);
  assert.equal(actionOf(runtime,kael,"action.dash")?.disabledReason,"행동을 이미 사용했습니다.");
  dice.push(18,3,5,1);
  const second=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(second.status,"committed",JSON.stringify(second));
  assert.equal(hp(runtime,gob1),0);
  assert.equal(runtime.state.rules.combatants[gob1].life.dead,true,"a monster at 0 HP dies");
  assert.deepEqual(runtime.state.actors[kael].engagement,[],"a dead target releases the engagement");
  // 세 번째 공격은 거부 — 타일 이유와 거부 이유가 같다
  const tile=actionOf(runtime,kael,"action.longsword");
  assert.equal(tile?.available,false);
  const third=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob2]},P1);
  assert.equal(third.status,"refused");
  assert.equal(third.status==="refused"&&third.refusal.message,tile?.disabledReason);
  assert.equal(third.status==="refused"&&third.refusal.message,"행동을 이미 사용했습니다.");
  // 남의 턴, 자기 자신 대상, 남의 캐릭터
  const offTurn=runtime.dispatch({type:"act",actorId:gob2,actionId:actionOf(runtime,gob2,"action.standard.dodge")!.id,targetIds:[gob2]});
  assert.equal(offTurn.status==="refused"&&offTurn.refusal.message,"현재 Actor의 턴이 아닙니다.");
  const notMine=runtime.dispatch({type:"act",actorId:gob2,actionId:"action.dash",targetIds:[]},P1);
  assert.equal(notMine.status==="refused"&&notMine.refusal.message,"자기 캐릭터만 조작할 수 있습니다.");
  const playerRuling=runtime.dispatch({type:"ruling",targetIds:[gob2],ruling:{kind:"damage",amount:3}},P1);
  assert.equal(playerRuling.status==="refused"&&playerRuling.refusal.message,"DM만 할 수 있습니다.");
  // 턴 종료: 죽은 고블린 1을 건너뛰어 고블린 2의 턴
  const ended=runtime.dispatch({type:"end-turn"},P1);
  assert.equal(ended.status,"committed",JSON.stringify(ended));
  assert.equal(runtime.state.currentActorId,gob2);
  assert.equal(runtime.state.round,1);
  // 고블린 2 시미터 → 카엘: d20 19 (+1 = 20 vs AC 18 명중), 1d6 → 4 (-1 = 3)
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob2].find((action)=>action.resolutionKind==="attack")!;
  dice.push(19,2,4,2);
  const bite=runtime.dispatch({type:"act",actorId:gob2,actionId:scimitar.id,targetIds:[kael]});
  assert.equal(bite.status,"committed",JSON.stringify(bite));
  assert.equal(hp(runtime,kael),28);
  // DM 재량: 넘어짐, 피해, 다음 공격 유리
  const prone=runtime.dispatch({type:"ruling",targetIds:[gob2],ruling:{kind:"condition",conditionId:"prone",on:true}});
  assert.equal(prone.status,"committed",JSON.stringify(prone));
  assert.ok(projectTable(runtime.state,{role:"player"}).scene.entities.find((entity)=>entity.id===gob2)?.status.includes("✦ 넘어짐"));
  assert.equal(runtime.state.log[0].title,"DM 재량 · 넘어짐 적용");
  const hurt=runtime.dispatch({type:"ruling",targetIds:[gob2],ruling:{kind:"damage",amount:3},note:"천장에서 돌이 떨어짐"});
  assert.equal(hurt.status,"committed");
  assert.equal(hp(runtime,gob2),7);
  const advantage=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"next-roll",state:"advantage",family:"attack-roll"}});
  assert.equal(advantage.status,"committed");
  assert.ok(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===kael)?.status.includes("✦ 다음 공격 굴림 유리"));
  // 되돌리기: 마지막 재량(유리)이 사라진다
  const undone=runtime.dispatch({type:"undo"});
  assert.equal(undone.status,"committed");
  assert.equal(runtime.state.rules.effects.some((effect)=>effect.tags.includes("table:next-roll")),false);
  assert.equal(runtime.state.log[0].title,"되돌리기 · DM 재량 · 다음 공격 굴림 유리");
  assert.equal(hp(runtime,gob2),7,"undo restores exactly the state before the undone command");
  // 다시 유리를 주고 카엘의 턴으로: 두 d20 중 높은 값을 쓴 뒤 표식이 소모된다
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"next-roll",state:"advantage",family:"attack-roll"}});
  const jumped=runtime.dispatch({type:"end-turn"});
  assert.equal(jumped.status,"committed");
  assert.equal(runtime.state.currentActorId,kael);
  assert.equal(runtime.state.round,2);
  dice.push(2,17,6,1);
  const lucky=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob2]},P1);
  assert.equal(lucky.status,"committed",JSON.stringify(lucky));
  assert.equal(lucky.resolution?.naturalD20,17,"advantage keeps the higher face");
  assert.equal(lucky.resolution?.attackOutcome,"명중");
  assert.equal(runtime.state.rules.effects.some((effect)=>effect.tags.includes("table:next-roll")),false,"the next-roll grant is spent");
  assert.equal(hp(runtime,gob2),0);
  // 리플레이 = 현재 상태, 복제본 = 호스트
  const replayed=replayEvents(createTableState("table.test"),runtime.ledger);
  assert.deepEqual(replayed,runtime.state);
  const replica=new TableRuntime({sessionId:"table.test"});
  for(const event of runtime.ledger) replica.applyRemote(event);
  assert.deepEqual(projectTable(replica.state,{role:"player",peerId:P1.peerId}),projectTable(runtime.state,{role:"player",peerId:P1.peerId}));
  assert.equal(dice.remaining(),0,"every scripted face was consumed in the expected order");
});

test("T2-01: standard actions, checks, healing, death saves and life rulings", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:{...fighter(),hp:3},controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  // 자유 진행: 경제 없음, 회피는 다음 공격에 불리
  const dodge=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.dodge",targetIds:[kael]},P1);
  assert.equal(dodge.status,"committed",JSON.stringify(dodge));
  assert.ok(projectTable(runtime.state,{role:"dm"}).scene.entities[0].status.includes("✦ 회피"));
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob].find((action)=>action.resolutionKind==="attack")!;
  dice.push(18,4,3,3);
  const swing=runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[kael]});
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.equal(swing.resolution?.naturalD20,4,"dodge gives the attacker disadvantage");
  assert.equal(swing.resolution?.attackOutcome,"빗나감");
  // 능력 판정: 근력 d20 11 + 4
  dice.push(11,1);
  const check=runtime.dispatch({type:"act",actorId:kael,actionId:"action.ability.str",targetIds:[]},P1);
  assert.equal(check.status,"committed",JSON.stringify(check));
  assert.equal(check.resolution?.rollTotal,15);
  // 세컨드 윈드: 1d10 → 6 + 5 = 11 회복, 자원 소모
  dice.push(6);
  const wind=runtime.dispatch({type:"act",actorId:kael,actionId:"action.second-wind",targetIds:[kael]},P1);
  assert.equal(wind.status,"committed",JSON.stringify(wind));
  assert.equal(runtime.state.rules.combatants[kael].life.hp.current,14);
  assert.equal(runtime.state.rules.combatants[kael].resources[0].current,0);
  const again=runtime.dispatch({type:"act",actorId:kael,actionId:"action.second-wind",targetIds:[kael]},P1);
  assert.equal(again.status==="refused"&&again.refusal.message,"자원이 부족합니다.");
  // DM 재량: 쓰러짐 → 죽음 내성 굴림만 가능
  const down=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"life",state:"down"}});
  assert.equal(down.status,"committed",JSON.stringify(down));
  assert.equal(runtime.state.rules.combatants[kael].life.unconscious,true);
  const attack=projectTable(runtime.state,{role:"player"}).scene.actionsByActor[kael].find((action)=>action.id==="action.longsword");
  assert.equal(attack?.disabledReason,"의식불명 · 죽음 내성 굴림만 할 수 있습니다.");
  dice.push(4);
  const save=runtime.dispatch({type:"act",actorId:kael,actionId:"action.death-save",targetIds:[]},P1);
  assert.equal(save.status,"committed",JSON.stringify(save));
  assert.equal(runtime.state.rules.combatants[kael].life.deathSaves.failures,1);
  const stable=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"life",state:"stable"}});
  assert.equal(stable.status,"committed",JSON.stringify(stable));
  assert.equal(runtime.state.rules.combatants[kael].life.stable,true);
  const noSave=runtime.dispatch({type:"act",actorId:kael,actionId:"action.death-save",targetIds:[]},P1);
  assert.equal(noSave.status==="refused"&&noSave.refusal.message,"안정된 상태입니다. 죽음 내성을 굴리지 않습니다.");
  const heal=runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"heal",amount:5}});
  assert.equal(heal.status,"committed");
  assert.equal(runtime.state.rules.combatants[kael].life.unconscious,false);
  assert.equal(runtime.state.rules.combatants[kael].life.hp.current,5);
  // 도움: 고블린이 아군이 아니므로 거부, 면역인 상태는 거부
  const help=runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.help",targetIds:[gob]},P1);
  assert.equal(help.status==="refused"&&help.refusal.message,"아군에게만 사용할 수 있습니다.");
  const twice=runtime.dispatch({type:"ruling",targetIds:[gob],ruling:{kind:"condition",conditionId:"prone",on:true}});
  assert.equal(twice.status,"committed");
  const already=runtime.dispatch({type:"ruling",targetIds:[gob],ruling:{kind:"condition",conditionId:"prone",on:true}});
  assert.equal(already.status==="refused"&&already.refusal.message,"고블린 전사 1은(는) 이미 넘어짐 상태입니다.");
  const off=runtime.dispatch({type:"ruling",targetIds:[gob],ruling:{kind:"condition",conditionId:"prone",on:false}});
  assert.equal(off.status,"committed");
  assert.equal(runtime.state.rules.effects.some((effect)=>effect.conditionId==="prone"),false);
  assert.equal(dice.remaining(),0);
});

test("T2-01: a monster save action against several targets, and the rest of the ruling palette", () => {
  const {runtime,dice}=table([]);
  const WYRMLING="dnd.srd521.monster.brass-dragon-wyrmling"; // 화염 브레스: 민첩 DC 11, 4d6 화염, 성공 시 절반
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:{...fighter(),id:"char.sera",name:"세라",abilities:{...fighter().abilities,dex:8}},controllerPeer:"peer.p2"},{kind:"monster",monsterId:WYRMLING}]});
  const dragon=`${WYRMLING}.instance-1`;
  const breath=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[dragon].find((action)=>action.resolutionKind==="saving-throw"&&/화염/.test(action.name))!;
  assert.ok(breath,"the wyrmling projects its breath weapon");
  assert.equal(breath.target,"multi-enemy");
  assert.equal(breath.saveDc,11);
  assert.deepEqual(breath.eligibleTargetIds,["char.kael","char.sera"]);
  // 피해 굴림 4d6 (8 faces queued, 4 used) = 3+4+5+6 = 18; 카엘 d20 12 (+2 = 14 성공 → 9), 세라 d20 5 (-1 = 4 실패 → 18)
  dice.push(3,4,5,6,1,1,1,1, 12,2, 5,9);
  const blast=runtime.dispatch({type:"act",actorId:dragon,actionId:breath.id,targetIds:["char.kael","char.sera"]});
  assert.equal(blast.status,"committed",JSON.stringify(blast));
  assert.equal(blast.resolution?.rollKind,"save");
  assert.deepEqual(blast.resolution?.saveResults.map((entry)=>[entry.targetName,entry.total,entry.outcome,entry.finalDamage]),[["카엘",14,"성공",9],["세라",4,"실패",18]]);
  assert.equal(hp(runtime,"char.kael"),22);
  assert.equal(hp(runtime,"char.sera"),13);
  assert.equal(dice.remaining(),0);
  // 임시 HP · 최대 HP · 탈진 · 영감 · 배지 · 교전 · 자원
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.kael"],ruling:{kind:"temp-hp",amount:5}}).status,"committed");
  assert.equal(runtime.state.rules.combatants["char.kael"].life.hp.temporary,5);
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.kael"],ruling:{kind:"max-hp",delta:-10}}).status,"committed");
  assert.equal(runtime.state.rules.combatants["char.kael"].life.hp.maximum,32);
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.sera"],ruling:{kind:"exhaustion",level:2}}).status,"committed");
  assert.equal(runtime.state.rules.effects.filter((effect)=>effect.conditionId==="exhaustion"&&effect.targetId==="char.sera").length,2);
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.sera"],ruling:{kind:"exhaustion",level:1}}).status,"committed");
  assert.equal(runtime.state.rules.effects.filter((effect)=>effect.conditionId==="exhaustion"&&effect.targetId==="char.sera").length,1);
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.kael"],ruling:{kind:"inspiration",on:true}}).status,"committed");
  assert.ok(projectTable(runtime.state,{role:"player"}).scene.entities.find((entity)=>entity.id==="char.kael")?.status.includes("✦ 영웅적 영감"));
  assert.equal(runtime.dispatch({type:"ruling",targetIds:[dragon],ruling:{kind:"badge",badge:"hidden",on:true}}).status,"committed");
  assert.ok(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===dragon)?.status.includes("숨음"));
  assert.ok(!projectTable(runtime.state,{role:"player"}).scene.entities.find((entity)=>entity.id===dragon)?.status.includes("숨음"),"players do not see the DM's hidden badge");
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.kael"],ruling:{kind:"engage",otherId:dragon,on:true}}).status,"committed");
  assert.deepEqual(runtime.state.actors[dragon].engagement,["char.kael"]);
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.kael"],ruling:{kind:"resource",resourceId:"resource.second-wind",delta:-1}}).status,"committed");
  assert.equal(runtime.state.rules.combatants["char.kael"].resources[0].current,0);
  const broke=runtime.dispatch({type:"ruling",targetIds:["char.kael"],ruling:{kind:"resource",resourceId:"resource.second-wind",delta:-1}});
  assert.equal(broke.status==="refused"&&broke.refusal.message,"세컨드 윈드이(가) 부족합니다.");
  // 사망 처리 → 부활
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.sera"],ruling:{kind:"life",state:"dead"}}).status,"committed");
  assert.equal(runtime.state.rules.combatants["char.sera"].life.dead,true);
  assert.equal(runtime.dispatch({type:"ruling",targetIds:["char.sera"],ruling:{kind:"life",state:"revive"}}).status,"committed");
  assert.equal(runtime.state.rules.combatants["char.sera"].life.dead,false);
  assert.equal(hp(runtime,"char.sera"),1);
});
